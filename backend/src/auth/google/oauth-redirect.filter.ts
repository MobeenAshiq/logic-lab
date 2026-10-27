import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { AppException } from '../../common/app-exception';
import { Env } from '../../config/env';

/** The Google callback is a browser redirect, so errors go back to the login page. */
@Catch()
@Injectable()
export class OAuthRedirectFilter implements ExceptionFilter {
  private readonly logger = new Logger(OAuthRedirectFilter.name);

  private readonly frontendUrl: string;

  constructor(config: ConfigService<Env, true>) {
    this.frontendUrl = config.get('FRONTEND_URL', { infer: true });
  }

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    const code =
      exception instanceof AppException
        ? exception.code
        : 'GOOGLE_LOGIN_FAILED';
    if (!(exception instanceof AppException)) {
      this.logger.warn(`Google login failed: ${String(exception)}`);
    }
    res.redirect(`${this.frontendUrl}/login?error=${code}`);
  }
}
