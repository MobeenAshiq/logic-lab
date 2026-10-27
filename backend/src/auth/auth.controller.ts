import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { t } from '../common/i18n/en';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { Env } from '../config/env';
import { RateLimit } from '../rate-limit/rate-limit.guard';
import {
  emailOnlySchema,
  loginSchema,
  mfaCodeSchema,
  resetPasswordSchema,
  signupSchema,
  verifyEmailSchema,
} from './auth.schemas';
import type {
  LoginInput,
  ResetPasswordInput,
  SignupInput,
  VerifyEmailInput,
} from './auth.schemas';
import { AuthService, LoginResult } from './auth.service';
import type { AuthUser, GoogleIdentity } from './auth.types';
import {
  clearAuthCookies,
  CookieSettings,
  REFRESH_COOKIE,
  setAuthCookies,
} from './cookies';
import { AllowPendingMfa, CurrentUser, Public } from './decorators';
import { GoogleOAuthGuard } from './google/google-oauth.guard';
import { OAuthRedirectFilter } from './google/oauth-redirect.filter';
import { MfaService } from './mfa.service';
import { ClientMeta, SessionsService } from './sessions.service';

function clientMeta(req: Request): ClientMeta {
  return { ip: req.ip ?? null, userAgent: req.get('user-agent') ?? null };
}

@Controller('auth')
export class AuthController {
  private readonly cookies: CookieSettings;
  private readonly frontendUrl: string;

  constructor(
    private readonly auth: AuthService,
    private readonly sessions: SessionsService,
    private readonly mfa: MfaService,
    config: ConfigService<Env, true>,
  ) {
    this.cookies = {
      secure: config.get('COOKIE_SECURE', { infer: true }),
      accessTtlSeconds: config.get('JWT_ACCESS_TTL_SECONDS', { infer: true }),
      refreshTtlDays: config.get('REFRESH_TTL_DAYS', { infer: true }),
    };
    this.frontendUrl = config.get('FRONTEND_URL', { infer: true });
  }

  @Public()
  @RateLimit('otp-send')
  @Post('signup')
  async signup(@Body(new ZodValidationPipe(signupSchema)) body: SignupInput) {
    await this.auth.signup(body);
    return { message: t.messages.CODE_SENT, next: 'verify-email' };
  }

  @Public()
  @RateLimit('otp-verify')
  @HttpCode(HttpStatus.OK)
  @Post('verify-email')
  async verifyEmail(
    @Body(new ZodValidationPipe(verifyEmailSchema)) body: VerifyEmailInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.respondWithSession(
      res,
      await this.auth.verifyEmail(body, clientMeta(req)),
    );
  }

  @Public()
  @RateLimit('otp-send')
  @HttpCode(HttpStatus.OK)
  @Post('resend-code')
  async resendCode(
    @Body(new ZodValidationPipe(emailOnlySchema)) body: { email: string },
  ) {
    await this.auth.resendVerificationCode(body.email);
    return { message: t.messages.CODE_SENT };
  }

  @Public()
  @RateLimit('login')
  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(
    @Body(new ZodValidationPipe(loginSchema)) body: LoginInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.respondWithSession(
      res,
      await this.auth.login(body, clientMeta(req)),
    );
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const cookies = req.cookies as Record<string, string | undefined>;
    try {
      const tokens = await this.sessions.refresh(cookies[REFRESH_COOKIE]);
      setAuthCookies(res, tokens, this.cookies);
      return { ok: true };
    } catch (err) {
      clearAuthCookies(res, this.cookies.secure);
      throw err;
    }
  }

  @AllowPendingMfa()
  @HttpCode(HttpStatus.OK)
  @Post('logout')
  async logout(
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.auth.logout(user.sessionId);
    clearAuthCookies(res, this.cookies.secure);
    return { message: t.messages.LOGGED_OUT };
  }

  @Public()
  @RateLimit('reset-send')
  @HttpCode(HttpStatus.OK)
  @Post('forgot-password')
  async forgotPassword(
    @Body(new ZodValidationPipe(emailOnlySchema)) body: { email: string },
  ) {
    await this.auth.forgotPassword(body.email);
    return { message: t.messages.RESET_SENT };
  }

  @Public()
  @RateLimit('reset')
  @HttpCode(HttpStatus.OK)
  @Post('reset-password')
  async resetPassword(
    @Body(new ZodValidationPipe(resetPasswordSchema)) body: ResetPasswordInput,
  ) {
    await this.auth.resetPassword(body);
    return { message: t.messages.PASSWORD_RESET };
  }

  // --- Google OAuth (browser redirects) ---

  @Public()
  @UseGuards(GoogleOAuthGuard)
  @Get('google')
  google() {
    // GoogleOAuthGuard redirects to Google.
  }

  @Public()
  @UseGuards(GoogleOAuthGuard)
  @UseFilters(OAuthRedirectFilter)
  @Get('google/callback')
  async googleCallback(@Req() req: Request, @Res() res: Response) {
    const result = await this.auth.loginWithGoogle(
      req.user as GoogleIdentity,
      clientMeta(req),
    );
    setAuthCookies(res, result.tokens, this.cookies);
    res.redirect(`${this.frontendUrl}/auth/callback?mfa=${result.mfa}`);
  }

  // --- Two-factor authentication (mentors and admins) ---

  @AllowPendingMfa()
  @Post('mfa/setup')
  mfaSetup(@CurrentUser() user: AuthUser) {
    return this.mfa.setup(user);
  }

  @AllowPendingMfa()
  @RateLimit('mfa')
  @HttpCode(HttpStatus.OK)
  @Post('mfa/enable')
  async mfaEnable(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(mfaCodeSchema)) body: { code: string },
    @Req() req: Request,
  ) {
    await this.mfa.enable(user, body.code, req.ip ?? null);
    return { mfa: 'none' };
  }

  @AllowPendingMfa()
  @RateLimit('mfa')
  @HttpCode(HttpStatus.OK)
  @Post('mfa/verify')
  async mfaVerify(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(mfaCodeSchema)) body: { code: string },
  ) {
    await this.mfa.verify(user, body.code);
    return { mfa: 'none' };
  }

  private respondWithSession(res: Response, result: LoginResult) {
    setAuthCookies(res, result.tokens, this.cookies);
    return { user: result.user, mfa: result.mfa };
  }
}
