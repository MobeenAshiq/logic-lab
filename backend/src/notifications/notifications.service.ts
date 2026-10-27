import { Injectable, Logger } from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';

/** Types that can also be sent by email (each can be switched off by the user). */
export const EMAIL_TYPES = [
  NotificationType.grade_returned,
  NotificationType.quiz_graded,
  NotificationType.new_doubt,
  NotificationType.chat_reply,
  NotificationType.live_class_soon,
] as const;
export type EmailType = (typeof EMAIL_TYPES)[number];

export interface NotifyInput {
  type: NotificationType;
  title: string;
  body?: string;
  link?: string | null;
}

function isEmailType(type: NotificationType): type is EmailType {
  return (EMAIL_TYPES as readonly NotificationType[]).includes(type);
}

/**
 * In-app notifications (bell, pushed live over the socket) plus email for the
 * important ones, respecting each user's preferences. Never throws: a failed
 * notification must not fail the action that caused it.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
    private readonly mail: MailService,
  ) {}

  async notify(
    userId: string,
    input: NotifyInput,
    opts: { email?: boolean } = {},
  ) {
    try {
      const n = await this.prisma.notification.create({
        data: {
          userId,
          type: input.type,
          title: input.title.slice(0, 200),
          body: (input.body ?? '').slice(0, 1000),
          link: input.link ?? null,
        },
      });
      this.realtime.toUser(userId, 'notification:new', n);
      if (
        opts.email &&
        isEmailType(input.type) &&
        (await this.wantsEmail(userId, input.type))
      ) {
        const user = await this.prisma.user.findUnique({
          where: { id: userId },
          select: { email: true },
        });
        if (user) {
          await this.mail.sendNotification(
            user.email,
            n.title,
            n.body || n.title,
            n.link,
          );
        }
      }
      return n;
    } catch (err) {
      this.logger.error(`notify(${input.type}) failed: ${String(err)}`);
      return null;
    }
  }

  async notifyMany(
    userIds: Iterable<string>,
    input: NotifyInput,
    opts: { email?: boolean } = {},
  ) {
    await Promise.all(
      [...new Set(userIds)].map((id) => this.notify(id, input, opts)),
    );
  }

  async list(userId: string, opts: { unreadOnly: boolean; before?: string }) {
    const [items, unread] = await Promise.all([
      this.prisma.notification.findMany({
        where: {
          userId,
          ...(opts.unreadOnly && { readAt: null }),
          ...(opts.before && { createdAt: { lt: new Date(opts.before) } }),
        },
        orderBy: { createdAt: 'desc' },
        take: 30,
      }),
      this.prisma.notification.count({ where: { userId, readAt: null } }),
    ]);
    return { items, unread };
  }

  async markRead(userId: string, id: string) {
    await this.prisma.notification.updateMany({
      where: { id, userId, readAt: null },
      data: { readAt: new Date() },
    });
    return this.unreadCount(userId);
  }

  async markAllRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { unread: 0 };
  }

  private async unreadCount(userId: string) {
    return {
      unread: await this.prisma.notification.count({
        where: { userId, readAt: null },
      }),
    };
  }

  // --- Email preferences ---

  async preferences(userId: string) {
    const row = await this.prisma.notificationPreference.findUnique({
      where: { userId },
    });
    const stored = (row?.email ?? {}) as Partial<Record<EmailType, boolean>>;
    return Object.fromEntries(
      EMAIL_TYPES.map((t) => [t, stored[t] ?? true]),
    ) as Record<EmailType, boolean>;
  }

  async updatePreferences(
    userId: string,
    email: Partial<Record<EmailType, boolean>>,
  ) {
    const merged = { ...(await this.preferences(userId)), ...email };
    await this.prisma.notificationPreference.upsert({
      where: { userId },
      create: { userId, email: merged },
      update: { email: merged },
    });
    return merged;
  }

  private async wantsEmail(userId: string, type: EmailType) {
    return (await this.preferences(userId))[type];
  }
}
