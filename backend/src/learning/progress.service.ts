import { Injectable } from '@nestjs/common';
import { LessonType, PointReason } from '@prisma/client';
import { PointsService } from '../points/points.service';
import { PrismaService } from '../prisma/prisma.service';
import { ProgressPingInput } from './learning.schemas';
import {
  pktDay,
  pktWeekStart,
  STREAK_MIN_SECONDS,
  streakFrom,
} from './study-time';

/** A video counts as complete once this share of it has been watched. */
export const COMPLETE_RATIO = 0.9;
/** First ping of a session: how much time we accept without a previous ping. */
const FIRST_PING_ALLOWANCE_S = 30;
/** Max credited per ping; also allows up to 2x playback speed. */
const MAX_DELTA_S = 120;
const SPEED_ALLOWANCE = 2;

@Injectable()
export class ProgressService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly points: PointsService,
  ) {}

  /**
   * Records watch/read time. The client reports how much it played, but the
   * server never credits more than the wall-clock time since the last ping
   * (x2 for fast playback), so progress cannot be faked from the console.
   */
  async ping(
    userId: string,
    lesson: {
      id: string;
      type: LessonType;
      durationSeconds: number | null;
      courseId: string;
    },
    input: ProgressPingInput,
  ) {
    const now = new Date();
    const existing = await this.prisma.lessonProgress.findUnique({
      where: { userId_lessonId: { userId, lessonId: lesson.id } },
    });
    const elapsed = existing?.lastPingAt
      ? (now.getTime() - existing.lastPingAt.getTime()) / 1000
      : FIRST_PING_ALLOWANCE_S;
    const credited = Math.floor(
      Math.min(input.watchedDelta, elapsed * SPEED_ALLOWANCE + 5, MAX_DELTA_S),
    );

    const duration = lesson.durationSeconds ?? 0;
    const isVideo = lesson.type === LessonType.video;
    const watched = Math.min(
      (existing?.watchedSeconds ?? 0) + credited,
      isVideo && duration > 0 ? duration : Number.MAX_SAFE_INTEGER,
    );
    const position = Math.floor(
      duration > 0
        ? Math.min(input.positionSeconds, duration)
        : input.positionSeconds,
    );
    const reachedEnd =
      isVideo && duration > 0 && watched >= duration * COMPLETE_RATIO;
    const completed = (existing?.completed ?? false) || reachedEnd;

    const result = await this.prisma.$transaction(async (tx) => {
      const progress = await tx.lessonProgress.upsert({
        where: { userId_lessonId: { userId, lessonId: lesson.id } },
        create: {
          userId,
          lessonId: lesson.id,
          watchedSeconds: watched,
          positionSeconds: position,
          completed,
          completedAt: completed ? now : null,
          lastPingAt: now,
        },
        update: {
          watchedSeconds: watched,
          positionSeconds: position,
          completed,
          completedAt:
            completed && !existing?.completedAt ? now : existing?.completedAt,
          lastPingAt: now,
        },
      });
      await this.touchEnrollment(tx, userId, lesson.courseId, lesson.id, now);
      let reachedDailyMinimum = false;
      if (credited > 0) {
        const day = await tx.studyDay.upsert({
          where: { userId_day: { userId, day: pktDay(now) } },
          create: { userId, day: pktDay(now), seconds: credited },
          update: { seconds: { increment: credited } },
        });
        reachedDailyMinimum =
          day.seconds >= STREAK_MIN_SECONDS &&
          day.seconds - credited < STREAK_MIN_SECONDS;
      }
      return { progress, reachedDailyMinimum };
    });
    // Today now counts for the streak: every 7th consecutive day earns points.
    if (result.reachedDailyMinimum) await this.checkStreak(userId, now);
    return this.view(result.progress);
  }

  private async checkStreak(userId: string, now: Date) {
    const days = await this.prisma.studyDay.findMany({
      where: {
        userId,
        day: { gte: new Date(pktDay(now).getTime() - 400 * 864e5) },
      },
      select: { day: true, seconds: true },
    });
    const streak = streakFrom(days, now);
    if (streak > 0 && streak % 7 === 0) {
      const today = pktDay(now).toISOString().slice(0, 10);
      await this.points.award(
        userId,
        PointReason.streak_7_days,
        `streak:${today}`,
      );
    }
  }

  /** Articles (and other non-video lessons) are completed by the student. */
  async markComplete(userId: string, lessonId: string, courseId: string) {
    const now = new Date();
    const progress = await this.prisma.$transaction(async (tx) => {
      const progress = await tx.lessonProgress.upsert({
        where: { userId_lessonId: { userId, lessonId } },
        create: { userId, lessonId, completed: true, completedAt: now },
        update: { completed: true, completedAt: now },
      });
      await this.touchEnrollment(tx, userId, courseId, lessonId, now);
      return progress;
    });
    return this.view(progress);
  }

  async get(userId: string, lessonId: string) {
    const p = await this.prisma.lessonProgress.findUnique({
      where: { userId_lessonId: { userId, lessonId } },
    });
    return p
      ? this.view(p)
      : { positionSeconds: 0, watchedSeconds: 0, completed: false };
  }

  /** Records that the student opened a lesson (for "continue learning"). */
  async recordVisit(userId: string, courseId: string, lessonId: string) {
    await this.touchEnrollment(
      this.prisma,
      userId,
      courseId,
      lessonId,
      new Date(),
    );
  }

  /** Per-lesson completion for a course, keyed by lesson ID. */
  async completedIn(userId: string, courseId: string) {
    const rows = await this.prisma.lessonProgress.findMany({
      where: { userId, lesson: { module: { courseId } } },
      select: { lessonId: true, completed: true, positionSeconds: true },
    });
    return new Map(rows.map((r) => [r.lessonId, r]));
  }

  /** Data for the student dashboard. */
  async dashboard(userId: string) {
    const now = new Date();
    const [days, enrollments] = await Promise.all([
      this.prisma.studyDay.findMany({
        where: {
          userId,
          day: { gte: new Date(pktDay(now).getTime() - 400 * 864e5) },
        },
        select: { day: true, seconds: true },
        orderBy: { day: 'desc' },
      }),
      this.prisma.enrollment.findMany({
        where: { userId },
        orderBy: { lastActivityAt: 'desc' },
        include: {
          course: {
            select: {
              id: true,
              slug: true,
              title: true,
              track: { select: { title: true } },
              modules: {
                where: { isPublished: true },
                select: {
                  lessons: {
                    where: { isPublished: true },
                    select: { id: true, title: true },
                  },
                },
              },
            },
          },
        },
      }),
    ]);

    const weekStart = pktWeekStart(now).getTime();
    const weekSeconds = days
      .filter((d) => d.day.getTime() >= weekStart)
      .reduce((sum, d) => sum + d.seconds, 0);

    const completed = new Set(
      (
        await this.prisma.lessonProgress.findMany({
          where: { userId, completed: true },
          select: { lessonId: true },
        })
      ).map((p) => p.lessonId),
    );

    const courses = enrollments.map((e) => {
      const lessons = e.course.modules.flatMap((m) => m.lessons);
      const done = lessons.filter((l) => completed.has(l.id)).length;
      return {
        courseId: e.course.id,
        slug: e.course.slug,
        title: e.course.title,
        trackTitle: e.course.track.title,
        totalLessons: lessons.length,
        completedLessons: done,
        percent: lessons.length ? Math.round((done / lessons.length) * 100) : 0,
        lastActivityAt: e.lastActivityAt,
      };
    });

    // Continue where the student left off: the last lesson they opened, if still published.
    let continueLearning = null;
    for (const e of enrollments) {
      const lesson = e.course.modules
        .flatMap((m) => m.lessons)
        .find((l) => l.id === e.lastLessonId);
      if (!lesson) continue;
      const progress = await this.get(userId, lesson.id);
      continueLearning = {
        lessonId: lesson.id,
        lessonTitle: lesson.title,
        courseSlug: e.course.slug,
        courseTitle: e.course.title,
        positionSeconds: progress.positionSeconds,
        completed: progress.completed,
      };
      break;
    }

    return {
      streakDays: streakFrom(days, now),
      weekSeconds,
      todaySeconds:
        days.find((d) => d.day.getTime() === pktDay(now).getTime())?.seconds ??
        0,
      continueLearning,
      courses,
      recommendations: await this.weakTopicRecommendations(userId),
    };
  }

  private async weakTopicRecommendations(userId: string) {
    const attempts = await this.prisma.quizAttempt.findMany({
      where: { userId, status: 'graded' },
      orderBy: { submittedAt: 'desc' },
      take: 50,
      include: {
        quiz: {
          include: {
            lesson: { include: { module: { include: { course: true } } } },
            questions: { include: { question: true } },
          },
        },
      },
    });
    const topicScores = new Map<string, { correct: number; total: number; courseIds: Set<string> }>();
    const stopWords = new Set(['about', 'after', 'again', 'answer', 'apply', 'based', 'being', 'between', 'could', 'create', 'explain', 'following', 'given', 'their', 'there', 'these', 'those', 'using', 'which', 'where', 'write', 'would']);

    for (const attempt of attempts) {
      const answers = (attempt.answers ?? {}) as Record<string, { optionIds?: string[]; text?: string }>;
      const manual = (attempt.manualScores ?? {}) as Record<string, number>;
      for (const { question } of attempt.quiz.questions) {
        if (!attempt.questionIds.includes(question.id)) continue;
        const answer = answers[question.id];
        let score: number | null = null;
        if (question.type === 'mcq') {
          const chosen = [...(answer?.optionIds ?? [])].sort();
          const correct = [...question.correctOptionIds].sort();
          score = chosen.length === correct.length && chosen.every((id, i) => id === correct[i]) ? 1 : 0;
        } else if (typeof manual[question.id] === 'number') {
          score = question.points > 0 ? Math.max(0, Math.min(1, manual[question.id] / question.points)) : 0;
        }
        if (score === null) continue;
        const tags = question.tags.length > 0
          ? question.tags
          : [...new Set((question.prompt.toLowerCase().match(/[a-z][a-z0-9-]{3,}/g) ?? []).filter((word) => !stopWords.has(word)))].slice(0, 2);
        for (const rawTag of tags) {
          const tag = rawTag.trim().toLowerCase();
          if (!tag) continue;
          const current = topicScores.get(tag) ?? { correct: 0, total: 0, courseIds: new Set<string>() };
          current.correct += score;
          current.total++;
          current.courseIds.add(attempt.quiz.lesson.module.courseId);
          topicScores.set(tag, current);
        }
      }
    }

    const weak = [...topicScores.entries()]
      .filter(([, value]) => value.total >= 1 && value.correct / value.total < 0.7)
      .sort((a, b) => a[1].correct / a[1].total - b[1].correct / b[1].total)
      .slice(0, 4);
    if (!weak.length) return [];

    const courseIds = [...new Set(weak.flatMap(([, value]) => [...value.courseIds]))];
    const lessons = await this.prisma.lesson.findMany({
      where: {
        isPublished: true,
        type: { in: [LessonType.article, LessonType.video] },
        module: { isPublished: true, courseId: { in: courseIds }, course: { isPublished: true, track: { isPublished: true } } },
      },
      select: {
        id: true,
        title: true,
        notes: true,
        content: true,
        module: { select: { courseId: true, course: { select: { slug: true, title: true } } } },
      },
    });
    const textOf = (value: unknown): string => {
      if (!value || typeof value !== 'object') return '';
      const node = value as { text?: unknown; content?: unknown };
      return `${typeof node.text === 'string' ? node.text : ''} ${Array.isArray(node.content) ? node.content.map(textOf).join(' ') : ''}`.trim();
    };
    return weak.map(([topic, value]) => {
      const related = lessons
        .filter((lesson) => value.courseIds.has(lesson.module.courseId))
        .map((lesson) => {
          const haystack = `${lesson.title} ${lesson.notes} ${textOf(lesson.content)}`.toLowerCase();
          const relevance = haystack.includes(topic) ? 2 : topic.split(/\s+/).filter((word) => word.length > 3 && haystack.includes(word)).length;
          return { lessonId: lesson.id, lessonTitle: lesson.title, courseSlug: lesson.module.course.slug, courseTitle: lesson.module.course.title, relevance };
        })
        .sort((a, b) => b.relevance - a.relevance)
        .slice(0, 2)
        .map(({ relevance: _relevance, ...lesson }) => lesson);
      return { topic, missRate: Math.round((1 - value.correct / value.total) * 100), suggestedLessons: related };
    });
  }

  private touchEnrollment(
    tx: Pick<PrismaService, 'enrollment'>,
    userId: string,
    courseId: string,
    lessonId: string,
    now: Date,
  ) {
    return tx.enrollment.upsert({
      where: { userId_courseId: { userId, courseId } },
      create: { userId, courseId, lastLessonId: lessonId, lastActivityAt: now },
      update: { lastLessonId: lessonId, lastActivityAt: now },
    });
  }

  private view(p: {
    positionSeconds: number;
    watchedSeconds: number;
    completed: boolean;
  }) {
    return {
      positionSeconds: p.positionSeconds,
      watchedSeconds: p.watchedSeconds,
      completed: p.completed,
    };
  }
}
