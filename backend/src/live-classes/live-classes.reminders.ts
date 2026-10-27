import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { NotificationType } from '@prisma/client';
import { t } from '../common/i18n/en';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class LiveClassesRemindersService {
  private readonly logger = new Logger(LiveClassesRemindersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async checkUpcomingClasses() {
    const now = new Date();
    const in35Minutes = new Date(now.getTime() + 35 * 60 * 1000);

    const upcoming = await this.prisma.liveSession.findMany({
      where: {
        startsAt: {
          gte: now,
          lte: in35Minutes,
        },
        reminderSentAt: null,
      },
      include: {
        course: { select: { id: true, title: true, trackId: true } },
      },
    });

    for (const session of upcoming) {
      try {
        // Find students with active subscription or trial covering this track
        const activeSubUsers = await this.prisma.subscription.findMany({
          where: {
            status: { in: ['trial', 'active'] },
            startsAt: { lte: now },
            endsAt: { gte: now },
            OR: [
              { allTracks: true },
              { trackIds: { has: session.course.trackId } },
            ],
          },
          select: { userId: true },
        });

        const userIds = [...new Set(activeSubUsers.map((s) => s.userId))];

        await this.notifications.notifyMany(
          userIds,
          {
            type: NotificationType.live_class_soon,
            title: t.notifications.liveClassSoon(session.title),
            body: `Live class for "${session.course.title}" starts soon!`,
            link: '/student/live',
          },
          { email: true },
        );

        await this.prisma.liveSession.update({
          where: { id: session.id },
          data: { reminderSentAt: now },
        });

        this.logger.log(
          `Sent live class reminder for session "${session.title}" to ${userIds.length} students`,
        );
      } catch (err) {
        this.logger.error(
          `Failed sending reminder for live session ${session.id}: ${String(err)}`,
        );
      }
    }
  }
}
