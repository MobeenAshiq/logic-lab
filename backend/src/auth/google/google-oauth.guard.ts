import { ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import { Request, Response } from 'express';
import { AppException } from '../../common/app-exception';
import { randomToken, safeEqual } from '../../common/crypto';
import { Env } from '../../config/env';
import { OAUTH_STATE_COOKIE } from '../cookies';

const STATE_TTL_MS = 10 * 60 * 1000;

/**
 * Runs the Google OAuth flow without server sessions. The `state` parameter is
 * kept in a short-lived httpOnly cookie to stop login CSRF.
 */
@Injectable()
export class GoogleOAuthGuard extends AuthGuard('google') {
  private readonly configured: boolean;
  private readonly cookieSecure: boolean;

  constructor(config: ConfigService<Env, true>) {
    super();
    this.configured = Boolean(
      config.get('GOOGLE_CLIENT_ID', { infer: true }) &&
      config.get('GOOGLE_CLIENT_SECRET', { infer: true }),
    );
    this.cookieSecure = config.get('COOKIE_SECURE', { infer: true });
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (!this.configured) {
      throw new AppException(
        HttpStatus.SERVICE_UNAVAILABLE,
        'GOOGLE_NOT_CONFIGURED',
      );
    }
    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();

    if (this.isCallback(req)) {
      const cookies = req.cookies as Record<string, string | undefined>;
      const expected = cookies[OAUTH_STATE_COOKIE];
      const received = req.query.state;
      res.clearCookie(OAUTH_STATE_COOKIE, { path: '/' });
      if (
        !expected ||
        typeof received !== 'string' ||
        !safeEqual(expected, received)
      ) {
        throw new AppException(HttpStatus.BAD_REQUEST, 'OAUTH_STATE_MISMATCH');
      }
    }
    return (await super.canActivate(context)) as boolean;
  }

  getAuthenticateOptions(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<Request>();
    if (this.isCallback(req)) return { session: false };

    const state = randomToken(16);
    context
      .switchToHttp()
      .getResponse<Response>()
      .cookie(OAUTH_STATE_COOKIE, state, {
        httpOnly: true,
        secure: this.cookieSecure,
        sameSite: 'lax',
        path: '/',
        maxAge: STATE_TTL_MS,
      });
    return { session: false, state, prompt: 'select_account' };
  }

  private isCallback(req: Request) {
    return req.path.endsWith('/callback');
  }
}
