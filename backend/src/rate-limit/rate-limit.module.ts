import { Global, Module } from '@nestjs/common';
import { RateLimitService } from './rate-limit.service';

// RateLimitGuard is registered globally in AuthModule (after AuthGuard).
@Global()
@Module({
  providers: [RateLimitService],
  exports: [RateLimitService],
})
export class RateLimitModule {}
