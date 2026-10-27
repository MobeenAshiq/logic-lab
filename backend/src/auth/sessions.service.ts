import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Prisma, Role, UserStatus } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { AppException } from '../common/app-exception';
import { randomToken, safeEqual, sha256 } from '../common/crypto';
import { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { AccessTokenPayload, MfaState, PRIVILEGED_ROLES } from './auth.types';

export const STUDENT_DEVICE_LIMIT = 2;

export const REVOKE_REASON = {
  logout: 'logout',
  deviceLimit: 'device_limit',
  banned: 'banned',
  passwordReset: 'password_reset',
  refreshReuse: 'refresh_reuse',
  roleChanged: 'role_changed',
} as const;

export interface ClientMeta {
  ip: string | null;
  userAgent: string | null;
}

export interface IssuedTokens {
  sessionId: string;
  accessToken: string;
  refreshToken: string;
}

export function mfaStateFor(
  role: Role,
  totpEnabled: boolean,
  sessionMfaVerified: boolean,
): MfaState {
  if (!PRIVILEGED_ROLES.includes(role)) return 'none';
  if (!totpEnabled) return 'setup';
  return sessionMfaVerified ? 'none' : 'verify';
}

@Injectable()
export class SessionsService {
  private readonly refreshTtlMs: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    config: ConfigService<Env, true>,
  ) {
    this.refreshTtlMs =
      config.get('REFRESH_TTL_DAYS', { infer: true }) * 24 * 60 * 60 * 1000;
  }

  /**
   * Starts a session for a device. Students keep at most STUDENT_DEVICE_LIMIT
   * active sessions: the oldest ones are signed out.
   */
  async create(
    user: { id: string; role: Role },
    meta: ClientMeta,
  ): Promise<IssuedTokens> {
    const id = randomUUID();
    const secret = randomToken();

    await this.prisma.$transaction(async (tx) => {
      // Serialize logins of the same user so two parallel logins cannot both skip the limit.
      await tx.$queryRaw`SELECT 1 AS ok FROM pg_advisory_xact_lock(hashtext(${user.id}))`;

      if (user.role === Role.student) {
        const active = await tx.userSession.findMany({
          where: {
            userId: user.id,
            revokedAt: null,
            expiresAt: { gt: new Date() },
          },
          orderBy: { createdAt: 'asc' },
          select: { id: true },
        });
        const excess = active.length - (STUDENT_DEVICE_LIMIT - 1);
        if (excess > 0) {
          await tx.userSession.updateMany({
            where: { id: { in: active.slice(0, excess).map((s) => s.id) } },
            data: {
              revokedAt: new Date(),
              revokedReason: REVOKE_REASON.deviceLimit,
            },
          });
        }
      }

      await tx.userSession.create({
        data: {
          id,
          userId: user.id,
          refreshTokenHash: sha256(secret),
          ip: meta.ip,
          userAgent: meta.userAgent?.slice(0, 500) ?? null,
          expiresAt: new Date(Date.now() + this.refreshTtlMs),
        },
      });
    });

    return {
      sessionId: id,
      accessToken: await this.signAccess(user.id, id),
      refreshToken: `${id}.${secret}`,
    };
  }

  /** Rotates the refresh token. Reusing an old refresh token kills the session. */
  async refresh(refreshToken: string | undefined): Promise<IssuedTokens> {
    const [id, secret] = (refreshToken ?? '').split('.');
    if (!id || !secret || !/^[0-9a-f-]{36}$/.test(id)) {
      throw new AppException(HttpStatus.UNAUTHORIZED, 'SESSION_EXPIRED');
    }

    const session = await this.prisma.userSession.findUnique({
      where: { id },
      include: { user: { include: { profile: true } } },
    });
    this.assertUsable(session);

    if (!safeEqual(session.refreshTokenHash, sha256(secret))) {
      await this.revoke(session.id, REVOKE_REASON.refreshReuse);
      throw new AppException(HttpStatus.UNAUTHORIZED, 'SESSION_EXPIRED');
    }
    if (session.user.profile?.status === UserStatus.banned) {
      await this.revokeAllForUser(session.userId, REVOKE_REASON.banned);
      throw new AppException(HttpStatus.FORBIDDEN, 'ACCOUNT_BANNED', {
        reason: session.user.profile.bannedReason,
      });
    }

    const nextSecret = randomToken();
    await this.prisma.userSession.update({
      where: { id },
      data: {
        refreshTokenHash: sha256(nextSecret),
        lastUsedAt: new Date(),
        expiresAt: new Date(Date.now() + this.refreshTtlMs),
      },
    });

    return {
      sessionId: id,
      accessToken: await this.signAccess(session.userId, id),
      refreshToken: `${id}.${nextSecret}`,
    };
  }

  /** Throws the right error if the session is missing, revoked, or expired. */
  assertUsable<
    T extends {
      revokedAt: Date | null;
      revokedReason: string | null;
      expiresAt: Date;
    },
  >(session: T | null): asserts session is T {
    if (!session) {
      throw new AppException(HttpStatus.UNAUTHORIZED, 'SESSION_EXPIRED');
    }
    if (session.revokedReason === REVOKE_REASON.banned) {
      throw new AppException(HttpStatus.FORBIDDEN, 'ACCOUNT_BANNED');
    }
    if (session.revokedAt) {
      throw new AppException(
        HttpStatus.UNAUTHORIZED,
        session.revokedReason === REVOKE_REASON.deviceLimit
          ? 'SESSION_REVOKED_DEVICE_LIMIT'
          : 'SESSION_EXPIRED',
      );
    }
    if (session.expiresAt <= new Date()) {
      throw new AppException(HttpStatus.UNAUTHORIZED, 'SESSION_EXPIRED');
    }
  }

  async revoke(sessionId: string, reason: string) {
    await this.prisma.userSession.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: reason },
    });
  }

  async revokeAllForUser(
    userId: string,
    reason: string,
    tx: Prisma.TransactionClient = this.prisma,
  ) {
    await tx.userSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: reason },
    });
  }

  async markMfaVerified(sessionId: string) {
    await this.prisma.userSession.update({
      where: { id: sessionId },
      data: { mfaVerifiedAt: new Date() },
    });
  }

  private signAccess(userId: string, sessionId: string) {
    const payload: AccessTokenPayload = { sub: userId, sid: sessionId };
    return this.jwt.signAsync(payload);
  }
}
