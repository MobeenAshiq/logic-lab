import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SubscriptionStatus } from '@prisma/client';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { addDays } from './pricing';

const LIVE = [SubscriptionStatus.trial, SubscriptionStatus.active];

const REMINDERS = [
  // 3-day reminder when 1-3 days are left, 1-day reminder in the last day.
  { days: 3, field: 'reminder3dSentAt', from: 1, to: 3 },
  { days: 1, field: 'reminder1dSentAt', from: 0, to: 1 },
] as const;

/**
 * Hourly job (runs inside the API process): marks ended subscriptions as
 * expired and emails expiry reminders 3 days and 1 day before the end.
 * Safe to run on several instances: each reminder is claimed before sending.
 */
@Injectable()
export class RemindersService {
  private readonly logger = new Logger(RemindersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async runScheduled() {
    try {
      await this.run();
    } catch (err) {
      this.logger.error(`Reminder job failed: ${String(err)}`);
    }
  }

  async run(now = new Date()) {
    const expired = await this.prisma.subscription.updateMany({
      where: { status: { in: LIVE }, endsAt: { lte: now } },
      data: { status: SubscriptionStatus.expired },
    });

    let sent = 0;
    for (const r of REMINDERS) {
      const due = await this.prisma.subscription.findMany({
        where: {
          status: { in: LIVE },
          endsAt: { gt: addDays(now, r.from), lte: addDays(now, r.to) },
          [r.field]: null,
        },
        include: { user: { include: { profile: true } } },
      });

      for (const sub of due) {
        // Claim first so a second instance does not send it again.
        const { count } = await this.prisma.subscription.updateMany({
          where: { id: sub.id, [r.field]: null },
          data: { [r.field]: now },
        });
        if (count === 0 || !sub.endsAt) continue;

        // Already renewed: access continues after this one ends.
        const continues = await this.prisma.subscription.count({
          where: {
            userId: sub.userId,
            status: SubscriptionStatus.active,
            endsAt: { gt: sub.endsAt },
          },
        });
        if (continues > 0) continue;

        await this.mail.sendExpiryReminder(
          sub.user.email,
          sub.user.profile?.fullName ?? '',
          r.days,
          sub.endsAt,
        );
        sent++;
      }
    }
    return { expired: expired.count, remindersSent: sent };
  }
}
