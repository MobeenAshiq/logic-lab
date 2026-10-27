import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { AppException } from '../common/app-exception';
import { Env } from '../config/env';

export const RATE_LIMIT_MAX = 5;
export const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

/**
 * 5 attempts per 15 minutes per key (sliding window).
 * Uses Upstash Redis when configured; otherwise an in-memory store that only
 * works for a single dev process.
 */
@Injectable()
export class RateLimitService {
  private readonly logger = new Logger(RateLimitService.name);
  private readonly upstash: Ratelimit | null;
  private readonly memory = new Map<string, number[]>();

  constructor(config: ConfigService<Env, true>) {
    const url = config.get('UPSTASH_REDIS_REST_URL', { infer: true });
    const token = config.get('UPSTASH_REDIS_REST_TOKEN', { infer: true });
    this.upstash =
      url && token
        ? new Ratelimit({
            redis: new Redis({ url, token }),
            limiter: Ratelimit.slidingWindow(RATE_LIMIT_MAX, '15 m'),
            prefix: 'logiclab:rl',
          })
        : null;
    if (!this.upstash) {
      this.logger.warn('Upstash not configured: using in-memory rate limiter');
    }
  }

  /** Counts one attempt against every key; throws 429 if any key is over the limit. */
  async consume(keys: string[]): Promise<void> {
    const results = await Promise.all(keys.map((k) => this.hit(k)));
    const blocked = results.filter((r) => !r.success);
    if (blocked.length > 0) {
      const retryAfterSeconds = Math.ceil(
        Math.max(...blocked.map((r) => r.reset - Date.now())) / 1000,
      );
      throw new AppException(HttpStatus.TOO_MANY_REQUESTS, 'RATE_LIMITED', {
        retryAfterSeconds,
      });
    }
  }

  private async hit(key: string): Promise<{ success: boolean; reset: number }> {
    if (this.upstash) {
      const { success, reset } = await this.upstash.limit(key);
      return { success, reset };
    }
    const now = Date.now();
    const hits = (this.memory.get(key) ?? []).filter(
      (ts) => now - ts < RATE_LIMIT_WINDOW_MS,
    );
    hits.push(now);
    this.memory.set(key, hits);
    return {
      success: hits.length <= RATE_LIMIT_MAX,
      reset: hits[0] + RATE_LIMIT_WINDOW_MS,
    };
  }
}
