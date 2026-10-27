import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthTokenPurpose, Profile, User, UserStatus } from '@prisma/client';
import { compare, hash, hashSync } from 'bcryptjs';
import { AppException } from '../common/app-exception';
import {
  hmac,
  randomOtp,
  randomToken,
  safeEqual,
  sha256,
} from '../common/crypto';
import { Env } from '../config/env';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  LoginInput,
  ResetPasswordInput,
  SignupInput,
  VerifyEmailInput,
} from './auth.schemas';
import { GoogleIdentity, MfaState } from './auth.types';
import {
  ClientMeta,
  IssuedTokens,
  mfaStateFor,
  REVOKE_REASON,
  SessionsService,
} from './sessions.service';

const BCRYPT_ROUNDS = 12;
const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const RESET_TTL_MS = 30 * 60 * 1000;
// Compared against when the user does not exist, so response time does not reveal it.
const DUMMY_HASH = hashSync(randomToken(), BCRYPT_ROUNDS);

type UserWithProfile = User & { profile: Profile | null };

export interface PublicUser {
  id: string;
  email: string;
  fullName: string;
  avatarUrl: string | null;
  role: Profile['role'];
  status: Profile['status'];
  emailVerified: boolean;
  mfaEnabled: boolean;
}

export interface LoginResult {
  user: PublicUser;
  mfa: MfaState;
  tokens: IssuedTokens;
}

export function toPublicUser(user: UserWithProfile): PublicUser {
  if (!user.profile) throw new Error(`Profile missing for user ${user.id}`);
  return {
    id: user.id,
    email: user.email,
    fullName: user.profile.fullName,
    avatarUrl: user.profile.avatarUrl,
    role: user.profile.role,
    status: user.profile.status,
    emailVerified: user.emailVerifiedAt !== null,
    mfaEnabled: user.totpEnabledAt !== null,
  };
}

@Injectable()
export class AuthService {
  private readonly hashKey: string;
  private readonly frontendUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: SessionsService,
    private readonly mail: MailService,
    config: ConfigService<Env, true>,
  ) {
    this.hashKey = config.get('JWT_ACCESS_SECRET', { infer: true });
    this.frontendUrl = config.get('FRONTEND_URL', { infer: true });
  }

  async signup(input: SignupInput): Promise<void> {
    const existing = await this.prisma.user.findUnique({
      where: { email: input.email },
      include: { profile: true },
    });
    if (existing) {
      // Unverified accounts just get a fresh code; the password is not overwritten.
      if (!existing.emailVerifiedAt && existing.passwordHash) {
        await this.sendVerificationCode(existing);
        return;
      }
      throw new AppException(HttpStatus.CONFLICT, 'EMAIL_TAKEN');
    }

    const passwordHash = await hash(input.password, BCRYPT_ROUNDS);
    const user = await this.prisma.$transaction(async (tx) => {
      // The on_user_created trigger inserts the profile row (role = student).
      const created = await tx.user.create({
        data: { email: input.email, passwordHash },
      });
      await tx.profile.update({
        where: { id: created.id },
        data: { fullName: input.fullName },
      });
      return tx.user.findUniqueOrThrow({
        where: { id: created.id },
        include: { profile: true },
      });
    });
    await this.sendVerificationCode(user);
  }

  async resendVerificationCode(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { profile: true },
    });
    if (user && !user.emailVerifiedAt) await this.sendVerificationCode(user);
  }

  /** Verifies the email and logs the user in. */
  async verifyEmail(
    input: VerifyEmailInput,
    meta: ClientMeta,
  ): Promise<LoginResult> {
    const user = await this.prisma.user.findUnique({
      where: { email: input.email },
      include: { profile: true },
    });
    if (!user || user.emailVerifiedAt) {
      throw new AppException(HttpStatus.BAD_REQUEST, 'INVALID_CODE');
    }

    const token = await this.prisma.authToken.findFirst({
      where: {
        userId: user.id,
        purpose: AuthTokenPurpose.verify_email,
        consumedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });
    if (
      !token ||
      token.expiresAt <= new Date() ||
      token.attempts >= OTP_MAX_ATTEMPTS
    ) {
      throw new AppException(HttpStatus.BAD_REQUEST, 'INVALID_CODE');
    }
    if (!safeEqual(token.tokenHash, hmac(input.code, this.hashKey))) {
      await this.prisma.authToken.update({
        where: { id: token.id },
        data: { attempts: { increment: 1 } },
      });
      throw new AppException(HttpStatus.BAD_REQUEST, 'INVALID_CODE');
    }

    const verified = await this.prisma.$transaction(async (tx) => {
      await tx.authToken.update({
        where: { id: token.id },
        data: { consumedAt: new Date() },
      });
      return tx.user.update({
        where: { id: user.id },
        data: { emailVerifiedAt: new Date() },
        include: { profile: true },
      });
    });
    return this.startSession(verified, meta);
  }

  async login(input: LoginInput, meta: ClientMeta): Promise<LoginResult> {
    const user = await this.prisma.user.findUnique({
      where: { email: input.email },
      include: { profile: true },
    });
    const ok = await compare(input.password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !user.passwordHash || !ok) {
      throw new AppException(HttpStatus.UNAUTHORIZED, 'INVALID_CREDENTIALS');
    }
    if (!user.emailVerifiedAt) {
      throw new AppException(HttpStatus.FORBIDDEN, 'EMAIL_NOT_VERIFIED');
    }
    return this.startSession(user, meta);
  }

  /** Finds or creates the account for a Google identity (linking by email). */
  async loginWithGoogle(
    identity: GoogleIdentity,
    meta: ClientMeta,
  ): Promise<LoginResult> {
    if (!identity.emailVerified) {
      throw new AppException(HttpStatus.FORBIDDEN, 'GOOGLE_EMAIL_NOT_VERIFIED');
    }
    const email = identity.email.trim().toLowerCase();

    const user = await this.prisma.$transaction(async (tx) => {
      const existing =
        (await tx.user.findUnique({
          where: { googleId: identity.googleId },
          include: { profile: true },
        })) ??
        (await tx.user.findUnique({
          where: { email },
          include: { profile: true },
        }));

      if (existing) {
        return tx.user.update({
          where: { id: existing.id },
          data: {
            googleId: identity.googleId,
            emailVerifiedAt: existing.emailVerifiedAt ?? new Date(),
          },
          include: { profile: true },
        });
      }

      const created = await tx.user.create({
        data: {
          email,
          googleId: identity.googleId,
          emailVerifiedAt: new Date(),
        },
      });
      await tx.profile.update({
        where: { id: created.id },
        data: { fullName: identity.fullName, avatarUrl: identity.avatarUrl },
      });
      return tx.user.findUniqueOrThrow({
        where: { id: created.id },
        include: { profile: true },
      });
    });

    return this.startSession(user, meta);
  }

  /** Always succeeds from the caller's point of view (no account enumeration). */
  async forgotPassword(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { profile: true },
    });
    if (!user || user.profile?.status === UserStatus.banned) return;

    const secret = randomToken();
    const token = await this.prisma.$transaction(async (tx) => {
      await tx.authToken.updateMany({
        where: {
          userId: user.id,
          purpose: AuthTokenPurpose.reset_password,
          consumedAt: null,
        },
        data: { consumedAt: new Date() },
      });
      return tx.authToken.create({
        data: {
          userId: user.id,
          purpose: AuthTokenPurpose.reset_password,
          tokenHash: sha256(secret),
          expiresAt: new Date(Date.now() + RESET_TTL_MS),
        },
      });
    });

    const link = `${this.frontendUrl}/reset-password?token=${encodeURIComponent(`${token.id}.${secret}`)}`;
    await this.mail.sendPasswordReset(
      user.email,
      user.profile?.fullName ?? '',
      link,
    );
  }

  async resetPassword(input: ResetPasswordInput): Promise<void> {
    const [id, secret] = input.token.split('.');
    const token =
      id && secret && /^[0-9a-f-]{36}$/.test(id)
        ? await this.prisma.authToken.findUnique({ where: { id } })
        : null;
    if (
      !token ||
      token.purpose !== AuthTokenPurpose.reset_password ||
      token.consumedAt ||
      token.expiresAt <= new Date() ||
      !safeEqual(token.tokenHash, sha256(secret))
    ) {
      throw new AppException(HttpStatus.BAD_REQUEST, 'INVALID_RESET_TOKEN');
    }

    const passwordHash = await hash(input.password, BCRYPT_ROUNDS);
    await this.prisma.$transaction(async (tx) => {
      await tx.authToken.update({
        where: { id: token.id },
        data: { consumedAt: new Date() },
      });
      const user = await tx.user.findUniqueOrThrow({
        where: { id: token.userId },
      });
      await tx.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          // Clicking the emailed link proves ownership of the address.
          emailVerifiedAt: user.emailVerifiedAt ?? new Date(),
        },
      });
      await this.sessions.revokeAllForUser(
        user.id,
        REVOKE_REASON.passwordReset,
        tx,
      );
    });
  }

  logout(sessionId: string) {
    return this.sessions.revoke(sessionId, REVOKE_REASON.logout);
  }

  async me(userId: string): Promise<PublicUser> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { profile: true },
    });
    return toPublicUser(user);
  }

  private async startSession(
    user: UserWithProfile,
    meta: ClientMeta,
  ): Promise<LoginResult> {
    const publicUser = toPublicUser(user);
    if (publicUser.status === UserStatus.banned) {
      throw new AppException(HttpStatus.FORBIDDEN, 'ACCOUNT_BANNED', {
        reason: user.profile?.bannedReason ?? null,
      });
    }
    const tokens = await this.sessions.create(
      { id: user.id, role: publicUser.role },
      meta,
    );
    return {
      user: publicUser,
      mfa: mfaStateFor(publicUser.role, publicUser.mfaEnabled, false),
      tokens,
    };
  }

  private async sendVerificationCode(user: UserWithProfile) {
    const code = randomOtp();
    await this.prisma.$transaction(async (tx) => {
      await tx.authToken.updateMany({
        where: {
          userId: user.id,
          purpose: AuthTokenPurpose.verify_email,
          consumedAt: null,
        },
        data: { consumedAt: new Date() },
      });
      await tx.authToken.create({
        data: {
          userId: user.id,
          purpose: AuthTokenPurpose.verify_email,
          tokenHash: hmac(code, this.hashKey),
          expiresAt: new Date(Date.now() + OTP_TTL_MS),
        },
      });
    });
    await this.mail.sendVerificationCode(
      user.email,
      user.profile?.fullName ?? '',
      code,
    );
  }
}
