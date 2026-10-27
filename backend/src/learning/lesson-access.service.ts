import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { ADMIN_ROLES, AuthUser } from '../auth/auth.types';
import { SubscriptionsService } from '../billing/subscriptions.service';
import { AppException } from '../common/app-exception';
import { PrismaService } from '../prisma/prisma.service';

export const PAYWALL_URL = '/student/billing';

const lessonInclude = {
  module: {
    include: {
      course: {
        include: { track: true, mentors: { select: { mentorId: true } } },
      },
    },
  },
} satisfies Prisma.LessonInclude;

export type LessonWithCourse = Prisma.LessonGetPayload<{
  include: typeof lessonInclude;
}>;

export interface ModuleLockInfo {
  id: string;
  locked: boolean;
  /** Title of the module that must be finished first. */
  unlockAfterTitle: string | null;
}

/**
 * Who may see a lesson:
 * - admins: everything;
 * - mentors: only courses they are assigned to;
 * - students: published content, with a live trial/subscription for the
 *   track, and only when the module is unlocked.
 */
@Injectable()
export class LessonAccessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptions: SubscriptionsService,
  ) {}

  isStaffFor(auth: AuthUser, course: { mentors: { mentorId: string }[] }) {
    return (
      ADMIN_ROLES.includes(auth.role) ||
      (auth.role === Role.mentor &&
        course.mentors.some((m) => m.mentorId === auth.id))
    );
  }

  /** Loads the lesson and throws the right error if `auth` may not open it. */
  async forViewer(auth: AuthUser, lessonId: string) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      include: lessonInclude,
    });
    const course = lesson?.module.course;
    if (!lesson || !course) {
      throw new AppException(HttpStatus.NOT_FOUND, 'LESSON_NOT_FOUND');
    }
    const isStaff = this.isStaffFor(auth, course);
    const published =
      lesson.isPublished &&
      lesson.module.isPublished &&
      course.isPublished &&
      course.track.isPublished;

    if (auth.role === Role.mentor && !isStaff) {
      throw new AppException(HttpStatus.FORBIDDEN, 'NOT_COURSE_MENTOR');
    }
    if (!published && !isStaff) {
      throw new AppException(HttpStatus.NOT_FOUND, 'LESSON_NOT_FOUND');
    }
    if (!isStaff) {
      if (!(await this.subscriptions.hasAccess(auth.id, course.id))) {
        throw new AppException(HttpStatus.FORBIDDEN, 'SUBSCRIPTION_REQUIRED', {
          paywallUrl: PAYWALL_URL,
          courseSlug: course.slug,
        });
      }
      const locks = await this.moduleLocks(auth.id, course.id);
      const lock = locks.get(lesson.moduleId);
      if (lock?.locked) {
        throw new AppException(HttpStatus.FORBIDDEN, 'MODULE_LOCKED', {
          unlockAfter: lock.unlockAfterTitle,
          courseSlug: course.slug,
        });
      }
    }
    return { lesson, course, isStaff };
  }

  /** For mentor/admin tools: the lesson, if `auth` teaches its course. */
  async forStaff(auth: AuthUser, lessonId: string) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      include: lessonInclude,
    });
    if (!lesson)
      throw new AppException(HttpStatus.NOT_FOUND, 'LESSON_NOT_FOUND');
    if (!this.isStaffFor(auth, lesson.module.course)) {
      throw new AppException(HttpStatus.FORBIDDEN, 'NOT_COURSE_MENTOR');
    }
    return lesson;
  }

  /**
   * A module with `unlockAfterModuleId` stays locked until the prerequisite
   * module is done: every published quiz in it passed (pass mark), or, if it
   * has no quiz, every published lesson completed. A prerequisite with no
   * published lessons does not lock.
   */
  async moduleLocks(
    userId: string,
    courseId: string,
  ): Promise<Map<string, ModuleLockInfo>> {
    const modules = await this.prisma.module.findMany({
      where: { courseId, isPublished: true },
      select: {
        id: true,
        title: true,
        unlockAfterModuleId: true,
        lessons: {
          where: { isPublished: true },
          select: { id: true, quiz: { select: { id: true } } },
        },
      },
    });
    const quizIds = modules.flatMap((m) =>
      m.lessons.flatMap((l) => (l.quiz ? [l.quiz.id] : [])),
    );
    const passed = new Set(
      quizIds.length
        ? (
            await this.prisma.quizAttempt.findMany({
              where: { userId, passed: true, quizId: { in: quizIds } },
              select: { quizId: true },
            })
          ).map((a) => a.quizId)
        : [],
    );
    const completed = new Set(
      (
        await this.prisma.lessonProgress.findMany({
          where: {
            userId,
            completed: true,
            lesson: { module: { courseId } },
          },
          select: { lessonId: true },
        })
      ).map((p) => p.lessonId),
    );
    const byId = new Map(modules.map((m) => [m.id, m]));
    const done = (moduleId: string) => {
      const lessons = byId.get(moduleId)?.lessons ?? [];
      const quizzes = lessons.flatMap((l) => (l.quiz ? [l.quiz.id] : []));
      return quizzes.length > 0
        ? quizzes.every((id) => passed.has(id))
        : lessons.every((l) => completed.has(l.id));
    };

    return new Map(
      modules.map((m) => {
        const prerequisite = m.unlockAfterModuleId
          ? byId.get(m.unlockAfterModuleId)
          : undefined;
        const locked = prerequisite ? !done(prerequisite.id) : false;
        return [
          m.id,
          {
            id: m.id,
            locked,
            unlockAfterTitle: prerequisite?.title ?? null,
          },
        ];
      }),
    );
  }
}
