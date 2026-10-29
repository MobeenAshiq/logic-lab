import { Injectable, Logger } from '@nestjs/common';
import { PointReason, Prisma, Role, UserStatus } from '@prisma/client';
import { t } from '../common/i18n/en';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  LEADERBOARD_ROOM,
  RealtimeService,
} from '../realtime/realtime.service';
import { SettingsService } from '../settings/settings.service';

const PKT_OFFSET_MS = 5 * 60 * 60 * 1000;
const LEADERBOARD_SIZE = 50;

/** Season key and bounds for the Pakistan-time month containing `date`. */
export function monthOf(date = new Date()) {
  const local = new Date(date.getTime() + PKT_OFFSET_MS);
  const y = local.getUTCFullYear();
  const m = local.getUTCMonth();
  return {
    key: `${y}-${String(m + 1).padStart(2, '0')}`,
    startsAt: new Date(Date.UTC(y, m, 1) - PKT_OFFSET_MS),
    endsAt: new Date(Date.UTC(y, m + 1, 1) - PKT_OFFSET_MS),
  };
}

function isUniqueViolation(err: unknown) {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002'
  );
}

/**
 * The only way points change. Called from server code when something happens
 * (quiz passed, answer accepted...), never from an HTTP endpoint, so points
 * cannot be added from the browser. Each (user, reason, source) counts once.
 */
@Injectable()
export class PointsService {
  private readonly logger = new Logger(PointsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly realtime: RealtimeService,
    private readonly notifications: NotificationsService,
  ) {}

  /** The current month's season (created on first use). */
  async currentSeason(now = new Date()) {
    const m = monthOf(now);
    return this.prisma.season.upsert({
      where: { key: m.key },
      create: m,
      update: {},
    });
  }

  /**
   * Awards the configured points for `reason`. Only students earn points.
   * Returns the event, or null if it was already awarded / not applicable.
   */
  async award(
    userId: string,
    reason: PointReason,
    sourceId: string,
    opts: { trackId?: string | null } = {},
  ) {
    try {
      const profile = await this.prisma.profile.findUnique({
        where: { id: userId },
        select: { role: true },
      });
      if (profile?.role !== Role.student) return null;
      const rules = await this.settings.get('point_rules');
      const points = rules[reason as keyof typeof rules];
      if (!points) return null;
      const season = await this.currentSeason();
      const event = await this.prisma.pointEvent.create({
        data: {
          userId,
          reason,
          points,
          sourceId,
          seasonId: season.id,
          trackId: opts.trackId ?? null,
        },
      });
      this.realtime.toUser(userId, 'points:awarded', { reason, points });
      this.realtime.debounced(LEADERBOARD_ROOM, 'leaderboard:updated', {
        season: season.key,
      });
      await this.notifications.notify(userId, {
        type: 'points',
        title: t.notifications.points(
          points,
          t.notifications.pointReasons[reason],
        ),
        link: '/leaderboard',
      });
      return event;
    } catch (err) {
      if (isUniqueViolation(err)) return null; // already awarded for this source
      this.logger.error(`award(${reason}) failed: ${String(err)}`);
      return null;
    }
  }

  /** Takes back points given for a source (e.g. an answer that is no longer accepted). */
  async revoke(userId: string, reason: PointReason, sourceId: string) {
    const { count } = await this.prisma.pointEvent.deleteMany({
      where: { userId, reason, sourceId },
    });
    if (count > 0) {
      const season = await this.currentSeason();
      this.realtime.debounced(LEADERBOARD_ROOM, 'leaderboard:updated', {
        season: season.key,
      });
    }
    return count > 0;
  }

  /** Top students of a season (default: this month), optionally for one track. */
  async leaderboard(
    userId: string,
    opts: { seasonKey?: string; trackSlug?: string },
  ) {
    const season = opts.seasonKey
      ? await this.prisma.season.findUnique({ where: { key: opts.seasonKey } })
      : await this.currentSeason();
    const track = opts.trackSlug
      ? await this.prisma.track.findUnique({
          where: { slug: opts.trackSlug },
          select: { id: true, slug: true, title: true },
        })
      : null;
    if (!season || (opts.trackSlug && !track)) {
      return { season: null, track: null, entries: [], me: null };
    }

    const trackFilter = track
      ? Prisma.sql`AND pe.track_id = ${track.id}::uuid`
      : Prisma.empty;
    const totals = await this.prisma.$queryRaw<
      { user_id: string; total: bigint }[]
    >`
      SELECT pe.user_id, SUM(pe.points) AS total
      FROM point_events pe
      JOIN profiles p ON p.id = pe.user_id
      WHERE pe.season_id = ${season.id}::uuid ${trackFilter}
        AND p.role = ${Role.student}::"Role" AND p.status = ${UserStatus.active}::"UserStatus"
      GROUP BY pe.user_id
      HAVING SUM(pe.points) > 0
      ORDER BY total DESC, MIN(pe.created_at) ASC`;

    const ranked = totals.map((r, i) => ({
      userId: r.user_id,
      points: Number(r.total),
      rank: i + 1,
    }));
    const top = ranked.slice(0, LEADERBOARD_SIZE);
    const profiles = await this.prisma.profile.findMany({
      where: { id: { in: top.map((r) => r.userId) } },
      select: { id: true, fullName: true, avatarUrl: true },
    });
    const byId = new Map(profiles.map((p) => [p.id, p]));
    const mine = ranked.find((r) => r.userId === userId) ?? null;

    return {
      season: {
        key: season.key,
        startsAt: season.startsAt,
        endsAt: season.endsAt,
      },
      track,
      entries: top.map((r) => ({
        rank: r.rank,
        userId: r.userId,
        fullName: byId.get(r.userId)?.fullName ?? '',
        avatarUrl: byId.get(r.userId)?.avatarUrl ?? null,
        points: r.points,
        isMe: r.userId === userId,
      })),
      me: mine ? { rank: mine.rank, points: mine.points } : null,
    };
  }

  /** The student's points this season, all time, and recent history. */
  async mine(userId: string) {
    const season = await this.currentSeason();
    const [seasonSum, totalSum, recent] = await Promise.all([
      this.prisma.pointEvent.aggregate({
        where: { userId, seasonId: season.id },
        _sum: { points: true },
      }),
      this.prisma.pointEvent.aggregate({
        where: { userId },
        _sum: { points: true },
      }),
      this.prisma.pointEvent.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: { id: true, reason: true, points: true, createdAt: true },
      }),
    ]);
    const board = await this.leaderboard(userId, {});
    return {
      season: season.key,
      seasonPoints: seasonSum._sum.points ?? 0,
      totalPoints: totalSum._sum.points ?? 0,
      rank: board.me?.rank ?? null,
      recent,
    };
  }

  seasons() {
    return this.prisma.season.findMany({
      orderBy: { startsAt: 'desc' },
      take: 24,
      select: { key: true, startsAt: true, endsAt: true },
    });
  }
}
