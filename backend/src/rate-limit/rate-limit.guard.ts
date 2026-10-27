import {
  CanActivate,
  ExecutionContext,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthedRequest } from '../auth/auth.types';
import { RateLimitService } from './rate-limit.service';

const RATE_LIMIT_KEY = 'rateLimitBucket';

/** Limits the endpoint per IP, per `body.email`, and per logged-in user. */
export const RateLimit = (bucket: string) =>
  SetMetadata(RATE_LIMIT_KEY, bucket);

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly limiter: RateLimitService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const bucket = this.reflector.get<string | undefined>(
      RATE_LIMIT_KEY,
      context.getHandler(),
    );
    if (!bucket) return true;

    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const keys = [`${bucket}:ip:${req.ip ?? 'unknown'}`];
    const body: unknown = req.body;
    if (body && typeof body === 'object' && 'email' in body) {
      const email = body.email;
      if (typeof email === 'string') {
        keys.push(`${bucket}:email:${email.trim().toLowerCase()}`);
      }
    }
    if (req.auth) keys.push(`${bucket}:user:${req.auth.id}`);

    await this.limiter.consume(keys);
    return true;
  }
}
