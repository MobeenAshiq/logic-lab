import {
  CanActivate,
  ExecutionContext,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Role, UserStatus } from '@prisma/client';
import { Response } from 'express';
import { AppException } from '../common/app-exception';
import { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { AccessTokenPayload, AuthedRequest } from './auth.types';
import { ACCESS_COOKIE, clearAuthCookies } from './cookies';
import { ALLOW_PENDING_MFA_KEY, IS_PUBLIC_KEY, ROLES_KEY } from './decorators';
import {
  mfaStateFor,
  REVOKE_REASON,
  SessionsService,
} from './sessions.service';

const TOUCH_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Global guard (the "middleware" of the plan). For every non-public route it:
 * 1. verifies the access token and that its session is still active,
 * 2. loads the role and status from the database,
 * 3. logs banned users out,
 * 4. blocks mentors/admins until 2FA is done,
 * 5. enforces @Roles(...).
 */
@Injectable()
export class AuthGuard implements CanActivate {
  private readonly cookieSecure: boolean;

  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly sessions: SessionsService,
    config: ConfigService<Env, true>,
  ) {
    this.cookieSecure = config.get('COOKIE_SECURE', { infer: true });
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) {
      return true;
    }

    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const res = context.switchToHttp().getResponse<Response>();

    try {
      await this.authenticate(req);
    } catch (err) {
      if (
        err instanceof AppException &&
        (err.getStatus() === Number(HttpStatus.UNAUTHORIZED) ||
          err.code === 'ACCOUNT_BANNED')
      ) {
        clearAuthCookies(res, this.cookieSecure);
      }
      throw err;
    }
    const auth = req.auth!;

    const allowPendingMfa = this.reflector.getAllAndOverride<boolean>(
      ALLOW_PENDING_MFA_KEY,
      targets,
    );
    if (auth.mfa !== 'none' && !allowPendingMfa) {
      throw new AppException(
        HttpStatus.FORBIDDEN,
        auth.mfa === 'setup' ? 'MFA_SETUP_REQUIRED' : 'MFA_VERIFY_REQUIRED',
        { mfa: auth.mfa },
      );
    }

    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(
      ROLES_KEY,
      targets,
    );
    if (roles && !roles.includes(auth.role)) {
      throw new AppException(HttpStatus.FORBIDDEN, 'FORBIDDEN_ROLE');
    }
    return true;
  }

  private async authenticate(req: AuthedRequest) {
    const token = this.extractToken(req);
    if (!token) {
      throw new AppException(HttpStatus.UNAUTHORIZED, 'UNAUTHENTICATED');
    }

    let payload: AccessTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<AccessTokenPayload>(token);
    } catch {
      throw new AppException(HttpStatus.UNAUTHORIZED, 'SESSION_EXPIRED');
    }

    const session = await this.prisma.userSession.findUnique({
      where: { id: payload.sid },
      include: { user: { include: { profile: true } } },
    });
    this.sessions.assertUsable(session);
    const profile = session.user.profile;
    if (session.userId !== payload.sub || !profile) {
      throw new AppException(HttpStatus.UNAUTHORIZED, 'SESSION_EXPIRED');
    }

    if (profile.status === UserStatus.banned) {
      await this.sessions.revokeAllForUser(
        session.userId,
        REVOKE_REASON.banned,
      );
      throw new AppException(HttpStatus.FORBIDDEN, 'ACCOUNT_BANNED', {
        reason: profile.bannedReason,
      });
    }

    req.auth = {
      id: session.userId,
      email: session.user.email,
      role: profile.role,
      sessionId: session.id,
      mfa: mfaStateFor(
        profile.role,
        session.user.totpEnabledAt !== null,
        session.mfaVerifiedAt !== null,
      ),
    };

    if (Date.now() - session.lastUsedAt.getTime() > TOUCH_INTERVAL_MS) {
      await this.prisma.userSession.update({
        where: { id: session.id },
        data: { lastUsedAt: new Date() },
      });
    }
  }

  private extractToken(req: AuthedRequest): string | undefined {
    const cookies = req.cookies as Record<string, string | undefined>;
    const fromCookie = cookies?.[ACCESS_COOKIE];
    if (fromCookie) return fromCookie;
    const header = req.headers.authorization;
    return header?.startsWith('Bearer ') ? header.slice(7) : undefined;
  }
}
