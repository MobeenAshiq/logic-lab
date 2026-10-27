import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Env } from '../config/env';
import { RateLimitGuard } from '../rate-limit/rate-limit.guard';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { GoogleStrategy } from './google/google.strategy';
import { MfaService } from './mfa.service';
import { SessionsService } from './sessions.service';

@Module({
  imports: [
    PassportModule.register({ session: false }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        secret: config.get('JWT_ACCESS_SECRET', { infer: true }),
        signOptions: {
          expiresIn: config.get('JWT_ACCESS_TTL_SECONDS', { infer: true }),
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    SessionsService,
    MfaService,
    GoogleStrategy,
    // Order matters: authenticate first, so the rate limiter can also key by user.
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: RateLimitGuard },
  ],
  exports: [AuthService, SessionsService],
})
export class AuthModule {}
