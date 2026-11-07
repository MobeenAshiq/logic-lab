import { HttpStatus, Injectable } from '@nestjs/common';
import { AiFlagStatus, Prisma } from '@prisma/client';
import { AiKeysService } from '../ai/ai-keys.service';
import { utcDay } from '../ai/ai-quota.service';
import { AuditService } from '../audit/audit.service';
import { AppException } from '../common/app-exception';
import { AI_PROVIDERS } from '../lib/ai';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import type { AdminFlagsInput, AdminSessionsInput } from './mentor.schemas';

const userSelect = {
  id: true,
  email: true,
  profile: { select: { fullName: true } },
} as const;

@Injectable()
export class AdminAiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly keys: AiKeysService,
    private readonly audit: AuditService,
  ) {}

  /** API usage vs. free quotas, plus mentor activity and safety counts. */
  async overview(days: number) {
    const today = utcDay();
    const since = new Date(today.getTime() - (days - 1) * 86_400_000);
    const [
      config,
      keys,
      usage,
      sessionsToday,
      messagesToday,
      activeUsers,
      openFlags,
      flagsToday,
    ] = await Promise.all([
      this.settings.get('ai_mentor'),
      this.keys.status(),
      this.prisma.aiProviderUsage.findMany({
        where: { day: { gte: since } },
        orderBy: { day: 'asc' },
      }),
      this.prisma.aiSession.count({ where: { createdAt: { gte: today } } }),
      this.prisma.aiChatLog.count({
        where: { createdAt: { gte: today }, senderType: 'user' },
      }),
      this.prisma.aiSession.findMany({
        where: { lastMessageAt: { gte: today } },
        distinct: ['userId'],
        select: { userId: true },
      }),
      this.prisma.securityFlagLog.count({ where: { reviewedAt: null } }),
      this.prisma.securityFlagLog.count({
        where: { timestamp: { gte: today } },
      }),
    ]);

    const daysList = Array.from(
      { length: days },
      (_, i) => new Date(since.getTime() + i * 86_400_000),
    );
    const providers = AI_PROVIDERS.map((provider) => {
      const rows = usage.filter((u) => u.provider === provider);
      const todayRow = rows.find((r) => r.day.getTime() === today.getTime());
      const cap = config.dailyCaps[provider];
      const position = config.providerOrder.indexOf(provider);
      return {
        provider,
        model: config.models[provider],
        key: keys.find((k) => k.provider === provider)!,
        order: position === -1 ? null : position + 1,
        dailyCap: cap,
        today: {
          requests: todayRow?.requests ?? 0,
          failures: todayRow?.failures ?? 0,
          rateLimited: todayRow?.rateLimited ?? 0,
          tokensIn: todayRow?.tokensIn ?? 0,
          tokensOut: todayRow?.tokensOut ?? 0,
          remaining:
            cap > 0 ? Math.max(0, cap - (todayRow?.requests ?? 0)) : null,
        },
        status: !keys.find((k) => k.provider === provider)?.configured
          ? 'no_key'
          : cap > 0 && (todayRow?.requests ?? 0) >= cap
            ? 'capped'
            : (todayRow?.rateLimited ?? 0) > 0
              ? 'rate_limited'
              : 'ok',
        daily: daysList.map((day) => {
          const row = rows.find((r) => r.day.getTime() === day.getTime());
          return {
            day: day.toISOString().slice(0, 10),
            requests: row?.requests ?? 0,
            failures: row?.failures ?? 0,
            rateLimited: row?.rateLimited ?? 0,
            tokens: (row?.tokensIn ?? 0) + (row?.tokensOut ?? 0),
          };
        }),
      };
    });

    return {
      enabled: config.enabled,
      resetsAt: new Date(today.getTime() + 86_400_000),
      providers,
      mentor: {
        sessionsToday,
        messagesToday,
        activeUsersToday: activeUsers.length,
      },
      safety: { openFlags, flagsToday },
    };
  }

  async sessions(query: AdminSessionsInput) {
    const where: Prisma.AiSessionWhereInput = {
      ...(query.search
        ? {
            OR: [
              {
                user: {
                  email: { contains: query.search, mode: 'insensitive' },
                },
              },
              {
                user: {
                  profile: {
                    fullName: { contains: query.search, mode: 'insensitive' },
                  },
                },
              },
              { title: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(query.flagged
        ? { messages: { some: { flagStatus: { not: AiFlagStatus.none } } } }
        : {}),
    };
    const [total, rows] = await Promise.all([
      this.prisma.aiSession.count({ where }),
      this.prisma.aiSession.findMany({
        where,
        orderBy: { lastMessageAt: 'desc' },
        take: query.pageSize,
        skip: (query.page - 1) * query.pageSize,
        select: {
          id: true,
          title: true,
          stackType: true,
          lastMessageAt: true,
          createdAt: true,
          user: { select: userSelect },
          course: { select: { title: true } },
          module: { select: { title: true } },
          _count: { select: { messages: true, flags: true } },
        },
      }),
    ]);
    return { total, page: query.page, pageSize: query.pageSize, items: rows };
  }

  async session(id: string) {
    const session = await this.prisma.aiSession.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        stackType: true,
        lastMessageAt: true,
        createdAt: true,
        user: { select: userSelect },
        course: { select: { title: true } },
        module: { select: { title: true } },
        messages: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            senderType: true,
            content: true,
            tokensUsed: true,
            provider: true,
            model: true,
            flagStatus: true,
            createdAt: true,
          },
        },
      },
    });
    if (!session)
      throw new AppException(HttpStatus.NOT_FOUND, 'AI_SESSION_NOT_FOUND');
    return session;
  }

  async flags(query: AdminFlagsInput) {
    const where: Prisma.SecurityFlagLogWhereInput = {
      ...(query.status === 'open'
        ? { reviewedAt: null }
        : query.status === 'reviewed'
          ? { reviewedAt: { not: null } }
          : {}),
      ...(query.category ? { category: query.category } : {}),
    };
    const [total, items] = await Promise.all([
      this.prisma.securityFlagLog.count({ where }),
      this.prisma.securityFlagLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        take: query.pageSize,
        skip: (query.page - 1) * query.pageSize,
        include: { user: { select: userSelect } },
      }),
    ]);
    return { total, page: query.page, pageSize: query.pageSize, items };
  }

  async reviewFlag(
    id: string,
    actorId: string,
    reviewed: boolean,
    ip: string | null,
  ) {
    const flag = await this.prisma.securityFlagLog.findUnique({
      where: { id },
    });
    if (!flag)
      throw new AppException(HttpStatus.NOT_FOUND, 'AI_FLAG_NOT_FOUND');
    const updated = await this.prisma.securityFlagLog.update({
      where: { id },
      data: reviewed
        ? { reviewedAt: new Date(), reviewedBy: actorId }
        : { reviewedAt: null, reviewedBy: null },
    });
    await this.audit.log({
      actorId,
      action: reviewed ? 'ai.flag_reviewed' : 'ai.flag_reopened',
      targetType: 'security_flag',
      targetId: id,
      metadata: { userId: flag.userId, category: flag.category },
      ip,
    });
    return updated;
  }
}
