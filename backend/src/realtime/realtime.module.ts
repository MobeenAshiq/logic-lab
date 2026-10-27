import { Controller, Get, Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import type { AuthUser } from '../auth/auth.types';
import { AllowPendingMfa, CurrentUser } from '../auth/decorators';
import { Env } from '../config/env';
import { ChatEvents } from './chat-events';
import { RealtimeGateway } from './realtime.gateway';
import { RealtimeService } from './realtime.service';
import {
  REALTIME_AUDIENCE,
  REALTIME_TOKEN_TTL_SECONDS,
  RealtimeTokenPayload,
} from './realtime.token';

/** Hands the logged-in user a 60-second token to open the socket with. */
@Controller('realtime')
export class RealtimeController {
  constructor(private readonly jwt: JwtService) {}

  @AllowPendingMfa()
  @Get('token')
  async token(@CurrentUser() user: AuthUser) {
    const payload: RealtimeTokenPayload = { sub: user.id };
    return {
      token: await this.jwt.signAsync(payload, {
        audience: REALTIME_AUDIENCE,
        expiresIn: REALTIME_TOKEN_TTL_SECONDS,
      }),
      expiresInSeconds: REALTIME_TOKEN_TTL_SECONDS,
    };
  }
}

@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        secret: config.get('JWT_ACCESS_SECRET', { infer: true }),
      }),
    }),
  ],
  controllers: [RealtimeController],
  providers: [RealtimeService, RealtimeGateway, ChatEvents],
  exports: [RealtimeService],
})
export class RealtimeModule {}
