import { HttpStatus, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { ADMIN_ROLES, type AuthUser } from '../auth/auth.types';
import { AppException } from '../common/app-exception';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';

export function utcDay(date = new Date()) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

export type QuotaInfo =
  { unlimited: true } | { limit: number; used: number; remaining: number };

/** Per-user daily AI request allowance (shared by the tutor, code review, mentor chat…). Admins are unlimited. */
@Injectable()
export class AiQuotaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
  ) {}

  private async limit() {
    return (await this.settings.get('ai_daily_limit')).studentMessages;
  }

  /** Counts one request for `userId`; throws 429 when today's allowance is used up. */
  async reserveUser(userId: string): Promise<QuotaInfo> {
    const limit = await this.limit();
    const day = utcDay();
    const exhausted = () =>
      new AppException(HttpStatus.TOO_MANY_REQUESTS, 'AI_DAILY_LIMIT_REACHED', {
        limit,
        remaining: 0,
      });
    if (limit === 0) throw exhausted();
    const changed = await this.prisma.$queryRaw<{ count: number }[]>`
      INSERT INTO ai_usage (id, user_id, day, count, created_at, updated_at)
      VALUES (${randomUUID()}::uuid, ${userId}::uuid, ${day}::date, 1, now(), now())
      ON CONFLICT (user_id, day) DO UPDATE
        SET count = ai_usage.count + 1, updated_at = now()
        WHERE ai_usage.count < ${limit}
      RETURNING count
    `;
    if (!changed.length) throw exhausted();
    return {
      limit,
      used: changed[0].count,
      remaining: Math.max(0, limit - changed[0].count),
    };
  }

  reserve(auth: AuthUser): Promise<QuotaInfo> {
    if (ADMIN_ROLES.includes(auth.role))
      return Promise.resolve({ unlimited: true });
    return this.reserveUser(auth.id);
  }

  /** Gives back a reserved request (e.g. the guardrail blocked it before any provider call). */
  async refund(auth: AuthUser) {
    if (ADMIN_ROLES.includes(auth.role)) return;
    await this.prisma.aiUsage.updateMany({
      where: { userId: auth.id, day: utcDay(), count: { gt: 0 } },
      data: { count: { decrement: 1 } },
    });
  }

  async usage(auth: AuthUser) {
    if (ADMIN_ROLES.includes(auth.role)) return { unlimited: true as const };
    const day = utcDay();
    const [limit, record] = await Promise.all([
      this.limit(),
      this.prisma.aiUsage.findUnique({
        where: { userId_day: { userId: auth.id, day } },
      }),
    ]);
    const used = record?.count ?? 0;
    return {
      limit,
      used,
      remaining: Math.max(0, limit - used),
      resetsAt: new Date(day.getTime() + 86_400_000),
    };
  }
}
