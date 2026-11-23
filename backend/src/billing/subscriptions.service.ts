import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma, SubscriptionStatus } from '@prisma/client';
import { AuthUser } from '../auth/auth.types';
import { AppException } from '../common/app-exception';
import { PrismaService } from '../prisma/prisma.service';
import { addDays, FREE_COURSE_DAYS } from './pricing';

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

/** Enrollments created after this are still in their free period. */
function freeCutoff(now = new Date()) {
  return addDays(now, -FREE_COURSE_DAYS);
}

export function inFreePeriod(enrolledAt: Date, now = new Date()) {
  return enrolledAt > freeCutoff(now);
}

@Injectable()
export class SubscriptionsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * The single access check used by every page and endpoint that serves course
   * content. Paid access: a live plan for all tracks, the course's track, or the
   * course itself. Otherwise every course is free for FREE_COURSE_DAYS, counted
   * from the first time the student opens it (that first check starts the clock).
   */
  async hasAccess(
    userId: string,
    courseId: string,
    // false: only check (for listings); a course never opened still counts as free.
    { startFree = true } = {},
  ): Promise<boolean> {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true, trackId: true },
    });
    if (!course) return false;
    const paid = await this.prisma.subscription.count({
      where: {
        ...liveWhere(userId),
        OR: [
          { allTracks: true },
          { trackIds: { has: course.trackId } },
          { courseIds: { has: course.id } },
        ],
      },
    });
    if (paid > 0) return true;
    const where = { userId_courseId: { userId, courseId } };
    const enrollment = startFree
      ? await this.prisma.enrollment.upsert({
          where,
          create: { userId, courseId },
          update: {},
        })
      : await this.prisma.enrollment.findUnique({ where });
    return !enrollment || inFreePeriod(enrollment.createdAt);
  }

  /** Track-wide features (daily challenges): access to the track or any of its courses. */
  async hasTrackAccess(userId: string, trackId: string): Promise<boolean> {
    const courseIds = (
      await this.prisma.course.findMany({
        where: { trackId },
        select: { id: true },
      })
    ).map((c) => c.id);
    const [paid, free] = await Promise.all([
      this.prisma.subscription.count({
        where: {
          ...liveWhere(userId),
          OR: [
            { allTracks: true },
            { trackIds: { has: trackId } },
            { courseIds: { hasSome: courseIds } },
          ],
        },
      }),
      this.prisma.enrollment.count({
        where: {
          userId,
          courseId: { in: courseIds },
          createdAt: { gt: freeCutoff() },
        },
      }),
    ]);
    return paid + free > 0;
  }

  /** Any live plan or free course period (e.g. to take part in the community). */
  async hasAnyAccess(userId: string): Promise<boolean> {
    const [paid, free] = await Promise.all([
      this.prisma.subscription.count({ where: liveWhere(userId) }),
      this.prisma.enrollment.count({
        where: { userId, createdAt: { gt: freeCutoff() } },
      }),
    ]);
    return paid + free > 0;
  }

  /** Everything the student billing page needs about access. */
  async overview(userId: string) {
    const [live, pending, free] = await Promise.all([
      this.prisma.subscription.findMany({
        where: liveWhere(userId),
        orderBy: { endsAt: 'asc' },
        include: { plan: { select: { id: true, name: true } } },
      }),
      this.prisma.subscription.findFirst({
        where: { userId, status: SubscriptionStatus.pending },
        include: { plan: { select: { id: true, name: true } } },
      }),
      this.prisma.enrollment.findMany({
        where: { userId, createdAt: { gt: freeCutoff() } },
        include: { course: { select: { id: true, title: true } } },
        orderBy: { createdAt: 'asc' },
      }),
    ]);
    return {
      access: live.map((s) => ({
        id: s.id,
        status: s.status,
        plan: s.plan,
        allTracks: s.allTracks,
        trackIds: s.trackIds,
        courseIds: s.courseIds,
        startsAt: s.startsAt,
        endsAt: s.endsAt,
      })),
      // Courses still inside their free 14 days (a paid plan may also cover them).
      freeCourses: free.map((e) => ({
        courseId: e.course.id,
        title: e.course.title,
        endsAt: addDays(e.createdAt, FREE_COURSE_DAYS),
      })),
      hasAccess: live.length > 0 || free.length > 0,
      pendingSubscription: pending,
    };
  }
}
