import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma, SubscriptionStatus } from '@prisma/client';
import { AuthUser } from '../auth/auth.types';
import { AppException } from '../common/app-exception';
import { PrismaService } from '../prisma/prisma.service';
import { addDays, TRIAL_DAYS, trialEmailKey } from './pricing';

const LIVE_STATUSES = [SubscriptionStatus.trial, SubscriptionStatus.active];

/** Subscriptions that give access right now (does not depend on the expiry job having run). */
function liveWhere(
  userId: string,
  now = new Date(),
): Prisma.SubscriptionWhereInput {
  return {
    userId,
    status: { in: LIVE_STATUSES },
    startsAt: { lte: now },
    endsAt: { gt: now },
  };
}

@Injectable()
export class SubscriptionsService {
  constructor(private readonly prisma: PrismaService) {}

  /** The single access check used by every page and endpoint that serves course content. */
  async hasAccess(userId: string, courseId: string): Promise<boolean> {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: { trackId: true },
    });
    return course ? this.hasTrackAccess(userId, course.trackId) : false;
  }

  async hasTrackAccess(userId: string, trackId: string): Promise<boolean> {
    const count = await this.prisma.subscription.count({
      where: {
        ...liveWhere(userId),
        OR: [{ allTracks: true }, { trackIds: { has: trackId } }],
      },
    });
    return count > 0;
  }

  /** Any live trial or subscription (e.g. to take part in the community). */
  async hasAnyAccess(userId: string): Promise<boolean> {
    return (
      (await this.prisma.subscription.count({ where: liveWhere(userId) })) > 0
    );
  }

  /** Everything the student billing page needs about access. */
  async overview(userId: string) {
    const [live, pending, everHad, canStartTrial] = await Promise.all([
      this.prisma.subscription.findMany({
        where: liveWhere(userId),
        orderBy: { endsAt: 'asc' },
        include: { plan: { select: { id: true, name: true } } },
      }),
      this.prisma.subscription.findFirst({
        where: { userId, status: SubscriptionStatus.pending },
        include: { plan: { select: { id: true, name: true } } },
      }),
      this.prisma.subscription.count({ where: { userId } }),
      this.canStartTrial(userId),
    ]);
    return {
      access: live.map((s) => ({
        id: s.id,
        status: s.status,
        plan: s.plan,
        allTracks: s.allTracks,
        trackIds: s.trackIds,
        startsAt: s.startsAt,
        endsAt: s.endsAt,
      })),
      hasAccess: live.length > 0,
      pendingSubscription: pending,
      canStartTrial,
      // Shown on first login: pick a track to start the trial.
      needsTrackChoice: canStartTrial && everHad === 0,
    };
  }

  async canStartTrial(userId: string): Promise<boolean> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    const [subs, claims] = await Promise.all([
      this.prisma.subscription.count({ where: { userId } }),
      this.prisma.trialClaim.count({ where: this.claimWhere(user) }),
    ]);
    return subs === 0 && claims === 0;
  }

  /**
   * Starts the 7-day trial on one track. Allowed once per (normalized) email and
   * once per Google account, even across different LogicLab accounts.
   */
  async startTrial(auth: AuthUser, trackId: string) {
    const track = await this.prisma.track.findFirst({
      where: { id: trackId, isPublished: true },
    });
    if (!track) throw new AppException(HttpStatus.NOT_FOUND, 'TRACK_NOT_FOUND');

    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT 1 AS ok FROM pg_advisory_xact_lock(hashtext(${auth.id}))`;
        const user = await tx.user.findUniqueOrThrow({
          where: { id: auth.id },
        });
        const [subs, claims] = await Promise.all([
          tx.subscription.count({ where: { userId: auth.id } }),
          tx.trialClaim.count({ where: this.claimWhere(user) }),
        ]);
        if (subs > 0 || claims > 0) {
          throw new AppException(HttpStatus.CONFLICT, 'TRIAL_ALREADY_USED');
        }
        await tx.trialClaim.create({
          data: {
            userId: auth.id,
            emailKey: trialEmailKey(user.email),
            googleId: user.googleId,
          },
        });
        const now = new Date();
        return tx.subscription.create({
          data: {
            userId: auth.id,
            status: SubscriptionStatus.trial,
            trackIds: [trackId],
            startsAt: now,
            endsAt: addDays(now, TRIAL_DAYS),
          },
        });
      });
    } catch (err) {
      // A parallel request or another account claimed the same email/Google ID.
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new AppException(HttpStatus.CONFLICT, 'TRIAL_ALREADY_USED');
      }
      throw err;
    }
  }

  private claimWhere(user: {
    email: string;
    googleId: string | null;
  }): Prisma.TrialClaimWhereInput {
    return {
      OR: [
        { emailKey: trialEmailKey(user.email) },
        ...(user.googleId ? [{ googleId: user.googleId }] : []),
      ],
    };
  }
}
