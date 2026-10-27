import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  AttemptStatus,
  LessonType,
  NotificationType,
  PointReason,
  Prisma,
  Question,
  QuestionType,
  QuizAttempt,
} from '@prisma/client';
import { AuthUser } from '../auth/auth.types';
import { t } from '../common/i18n/en';
import { NotificationsService } from '../notifications/notifications.service';
import { PointsService } from '../points/points.service';
import { AppException } from '../common/app-exception';
import { LessonAccessService } from '../learning/lesson-access.service';
import { ProgressService } from '../learning/progress.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  AttemptTypingInput,
  GradeAttemptInput,
  QuizQuestionsInput,
  QuizSettingsInput,
  SaveAnswerInput,
} from './assessments.schemas';
import { asEvents, computeFlags, MAX_EVENTS } from './integrity';
import { optionsOf } from './question-bank.service';
import { StaffAccessService } from './staff-access.service';

export interface SavedAnswer {
  optionIds?: string[];
  text?: string;
}
type Answers = Record<string, SavedAnswer>;

function answersOf(a: QuizAttempt): Answers {
  return (a.answers ?? {}) as unknown as Answers;
}

function sameSet(a: string[], b: string[]) {
  return a.length === b.length && a.every((x) => b.includes(x));
}

function mcqCorrect(q: Question, answer: SavedAnswer | undefined) {
  return sameSet(answer?.optionIds ?? [], q.correctOptionIds);
}

function percentOf(score: number, max: number) {
  return max > 0 ? Math.round((score / max) * 100) : 0;
}

@Injectable()
export class QuizzesService {
  private readonly logger = new Logger(QuizzesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly staff: StaffAccessService,
    private readonly access: LessonAccessService,
    private readonly progress: ProgressService,
    private readonly points: PointsService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Passing a quiz completes the lesson and earns points (once per quiz). */
  private async onPassed(
    userId: string,
    quizId: string,
    lessonId: string,
    courseId: string,
  ) {
    await this.progress.markComplete(userId, lessonId, courseId);
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: { trackId: true },
    });
    await this.points.award(userId, PointReason.quiz_passed, quizId, {
      trackId: course?.trackId,
    });
  }

  // ---------------------------------------------------------------- builder

  private ensureQuiz(lessonId: string) {
    return this.prisma.quiz.upsert({
      where: { lessonId },
      create: { lessonId },
      update: {},
    });
  }

  async forStaff(auth: AuthUser, lessonId: string) {
    const lesson = await this.staff.lesson(auth, lessonId, LessonType.quiz);
    const quiz = await this.ensureQuiz(lessonId);
    const [questions, attempts] = await Promise.all([
      this.prisma.quizQuestion.findMany({
        where: { quizId: quiz.id },
        orderBy: { position: 'asc' },
        include: { question: true },
      }),
      this.prisma.quizAttempt.count({ where: { quizId: quiz.id } }),
    ]);
    return {
      id: quiz.id,
      lessonId,
      lessonTitle: lesson.title,
      courseId: lesson.module.course.id,
      timeLimitSeconds: quiz.timeLimitSeconds,
      startsAt: quiz.startsAt,
      endsAt: quiz.endsAt,
      passMark: quiz.passMark,
      maxAttempts: quiz.maxAttempts,
      attemptCount: attempts,
      totalPoints: questions.reduce((s, q) => s + q.question.points, 0),
      questions: questions.map((q) => q.question),
    };
  }

  async updateSettings(
    auth: AuthUser,
    lessonId: string,
    input: QuizSettingsInput,
  ) {
    await this.staff.lesson(auth, lessonId, LessonType.quiz);
    await this.ensureQuiz(lessonId);
    await this.prisma.quiz.update({
      where: { lessonId },
      data: {
        timeLimitSeconds: input.timeLimitMinutes * 60,
        startsAt: input.startsAt ? new Date(input.startsAt) : null,
        endsAt: input.endsAt ? new Date(input.endsAt) : null,
        passMark: input.passMark,
        maxAttempts: input.maxAttempts,
      },
    });
    return this.forStaff(auth, lessonId);
  }

  /** Replaces the quiz's questions (in this order). Attempts already started keep their own list. */
  async setQuestions(
    auth: AuthUser,
    lessonId: string,
    input: QuizQuestionsInput,
  ) {
    const lesson = await this.staff.lesson(auth, lessonId, LessonType.quiz);
    const quiz = await this.ensureQuiz(lessonId);
    const valid = await this.prisma.question.count({
      where: {
        id: { in: input.questionIds },
        courseId: lesson.module.course.id,
      },
    });
    if (valid !== input.questionIds.length) {
      throw new AppException(HttpStatus.BAD_REQUEST, 'QUESTION_NOT_IN_COURSE');
    }
    await this.prisma.$transaction([
      this.prisma.quizQuestion.deleteMany({ where: { quizId: quiz.id } }),
      this.prisma.quizQuestion.createMany({
        data: input.questionIds.map((questionId, i) => ({
          quizId: quiz.id,
          questionId,
          position: i + 1,
        })),
      }),
    ]);
    return this.forStaff(auth, lessonId);
  }

  // ---------------------------------------------------------------- student

  /** Quiz page before/after attempts: rules, attempts so far, whether a new one can start. */
  async info(auth: AuthUser, lessonId: string) {
    const { lesson } = await this.access.forViewer(auth, lessonId);
    if (lesson.type !== LessonType.quiz) {
      throw new AppException(HttpStatus.BAD_REQUEST, 'NOT_A_QUIZ_LESSON');
    }
    const quiz = await this.prisma.quiz.findUnique({
      where: { lessonId },
      include: {
        questions: { include: { question: { select: { points: true } } } },
      },
    });
    const now = new Date();
    if (!quiz || quiz.questions.length === 0) {
      return { ready: false as const, serverNow: now };
    }
    await this.finalizeExpired({ userId: auth.id, quizId: quiz.id });
    const attempts = await this.prisma.quizAttempt.findMany({
      where: { quizId: quiz.id, userId: auth.id },
      orderBy: { startedAt: 'asc' },
    });
    const active = attempts.find((a) => a.status === AttemptStatus.in_progress);
    const blocked = this.startBlocker(quiz, attempts.length, now);
    return {
      ready: true as const,
      serverNow: now,
      quizId: quiz.id,
      timeLimitSeconds: quiz.timeLimitSeconds,
      startsAt: quiz.startsAt,
      endsAt: quiz.endsAt,
      passMark: quiz.passMark,
      maxAttempts: quiz.maxAttempts,
      questionCount: quiz.questions.length,
      totalPoints: quiz.questions.reduce((s, q) => s + q.question.points, 0),
      activeAttemptId: active?.id ?? null,
      canStart: !active && !blocked,
      blockedReason: active ? null : blocked,
      passed: attempts.some((a) => a.passed),
      attempts: attempts.map((a) => ({
        id: a.id,
        status: a.status,
        startedAt: a.startedAt,
        submittedAt: a.submittedAt,
        autoSubmitted: a.autoSubmitted,
        score: a.score,
        maxScore: a.maxScore,
        percent: a.percent,
        passed: a.passed,
      })),
    };
  }

  private startBlocker(
    quiz: { startsAt: Date | null; endsAt: Date | null; maxAttempts: number },
    used: number,
    now: Date,
  ) {
    if (quiz.startsAt && quiz.startsAt > now) return 'QUIZ_NOT_OPEN' as const;
    if (quiz.endsAt && quiz.endsAt <= now) return 'QUIZ_CLOSED' as const;
    if (used >= quiz.maxAttempts) return 'NO_ATTEMPTS_LEFT' as const;
    return null;
  }

  /** Starts an attempt (or returns the one in progress). The deadline is fixed now, on the server. */
  async start(auth: AuthUser, lessonId: string) {
    const { lesson } = await this.access.forViewer(auth, lessonId);
    if (lesson.type !== LessonType.quiz) {
      throw new AppException(HttpStatus.BAD_REQUEST, 'NOT_A_QUIZ_LESSON');
    }
    const quiz = await this.prisma.quiz.findUnique({
      where: { lessonId },
      include: {
        questions: {
          orderBy: { position: 'asc' },
          include: { question: true },
        },
      },
    });
    if (!quiz || quiz.questions.length === 0) {
      throw new AppException(HttpStatus.BAD_REQUEST, 'QUIZ_NOT_READY');
    }
    await this.finalizeExpired({ userId: auth.id, quizId: quiz.id });

    const attemptId = await this.prisma.$transaction(async (tx) => {
      // One start at a time per student and quiz.
      await tx.$queryRaw`SELECT 1 AS ok FROM pg_advisory_xact_lock(hashtext(${`${auth.id}:${quiz.id}`}))`;
      const attempts = await tx.quizAttempt.findMany({
        where: { quizId: quiz.id, userId: auth.id },
        select: { id: true, status: true },
      });
      const active = attempts.find(
        (a) => a.status === AttemptStatus.in_progress,
      );
      if (active) return active.id;
      const now = new Date();
      const blocked = this.startBlocker(quiz, attempts.length, now);
      if (blocked) {
        throw new AppException(
          blocked === 'NO_ATTEMPTS_LEFT'
            ? HttpStatus.CONFLICT
            : HttpStatus.FORBIDDEN,
          blocked,
        );
      }
      const byLimit = now.getTime() + quiz.timeLimitSeconds * 1000;
      const deadline = new Date(
        quiz.endsAt ? Math.min(byLimit, quiz.endsAt.getTime()) : byLimit,
      );
      const created = await tx.quizAttempt.create({
        data: {
          quizId: quiz.id,
          userId: auth.id,
          questionIds: quiz.questions.map((q) => q.questionId),
          maxScore: quiz.questions.reduce((s, q) => s + q.question.points, 0),
          startedAt: now,
          deadlineAt: deadline,
        },
      });
      return created.id;
    });
    return this.attempt(auth, attemptId);
  }

  /** The attempt as the student sees it. Correct answers only once the quiz is closed for them. */
  async attempt(auth: AuthUser, attemptId: string) {
    let attempt = await this.ownAttempt(auth, attemptId);
    if (
      attempt.status === AttemptStatus.in_progress &&
      attempt.deadlineAt <= new Date()
    ) {
      await this.finalize(attempt.id, true);
      attempt = await this.ownAttempt(auth, attemptId);
    }
    const [questions, used] = await Promise.all([
      this.questionsOf(attempt),
      this.prisma.quizAttempt.count({
        where: { quizId: attempt.quizId, userId: auth.id },
      }),
    ]);
    const quiz = attempt.quiz;
    const now = new Date();
    const finished = attempt.status !== AttemptStatus.in_progress;
    const closed = quiz.endsAt ? quiz.endsAt <= now : used >= quiz.maxAttempts;
    const reveal = finished && closed;
    const answers = answersOf(attempt);
    const manual = (attempt.manualScores ?? {}) as Record<string, number>;

    return {
      id: attempt.id,
      lessonId: quiz.lessonId,
      status: attempt.status,
      startedAt: attempt.startedAt,
      deadlineAt: attempt.deadlineAt,
      submittedAt: attempt.submittedAt,
      autoSubmitted: attempt.autoSubmitted,
      serverNow: now,
      passMark: quiz.passMark,
      reveal,
      questions: questions.map((q) => ({
        id: q.id,
        type: q.type,
        prompt: q.prompt,
        options: optionsOf(q),
        allowMultiple: q.allowMultiple,
        codeLanguage: q.codeLanguage,
        points: q.points,
        answer: answers[q.id] ?? null,
        ...(reveal && {
          correctOptionIds: q.correctOptionIds,
          explanation: q.explanation,
          earned:
            q.type === QuestionType.mcq
              ? mcqCorrect(q, answers[q.id])
                ? q.points
                : 0
              : (manual[q.id] ?? null),
        }),
      })),
      result: finished
        ? {
            autoScore: attempt.autoScore,
            score: attempt.score,
            maxScore: attempt.maxScore,
            percent: attempt.percent,
            passed: attempt.passed,
            feedback: attempt.feedback,
            pendingReview: attempt.status === AttemptStatus.submitted,
          }
        : null,
    };
  }

  async saveAnswer(
    auth: AuthUser,
    attemptId: string,
    questionId: string,
    input: SaveAnswerInput,
  ) {
    const attempt = await this.ownAttempt(auth, attemptId);
    if (!attempt.questionIds.includes(questionId)) {
      throw new AppException(HttpStatus.BAD_REQUEST, 'INVALID_ANSWER');
    }
    const question = await this.prisma.question.findUniqueOrThrow({
      where: { id: questionId },
    });
    const value: SavedAnswer =
      question.type === QuestionType.mcq
        ? { optionIds: this.checkOptions(question, input.optionIds ?? []) }
        : { text: input.text ?? '' };

    // Atomic, and the database itself refuses writes after the deadline.
    const updated = await this.prisma.$executeRaw`
      UPDATE quiz_attempts
      SET answers = jsonb_set(answers, ARRAY[${questionId}], ${JSON.stringify(value)}::jsonb),
          updated_at = now()
      WHERE id = ${attemptId}::uuid AND status = 'in_progress' AND deadline_at > now()`;
    if (updated === 0) await this.closed(attempt);
    return { saved: true };
  }

  async appendTyping(
    auth: AuthUser,
    attemptId: string,
    input: AttemptTypingInput,
  ) {
    const attempt = await this.ownAttempt(auth, attemptId);
    if (
      !attempt.questionIds.includes(input.questionId) ||
      input.events.length === 0
    ) {
      return { saved: false };
    }
    const updated = await this.prisma.$executeRaw`
      UPDATE quiz_attempts
      SET typing_events = jsonb_set(
            typing_events,
            ARRAY[${input.questionId}],
            COALESCE(typing_events -> ${input.questionId}, '[]'::jsonb) || ${JSON.stringify(input.events)}::jsonb),
          updated_at = now()
      WHERE id = ${attemptId}::uuid AND status = 'in_progress' AND deadline_at > now()
        AND jsonb_array_length(COALESCE(typing_events -> ${input.questionId}, '[]'::jsonb)) < ${MAX_EVENTS}`;
    if (
      updated === 0 &&
      (attempt.status !== 'in_progress' || attempt.deadlineAt <= new Date())
    ) {
      await this.closed(attempt);
    }
    return { saved: updated > 0 };
  }

  async tabSwitch(auth: AuthUser, attemptId: string) {
    await this.ownAttempt(auth, attemptId);
    await this.prisma.$executeRaw`
      UPDATE quiz_attempts SET tab_switches = tab_switches + 1, updated_at = now()
      WHERE id = ${attemptId}::uuid AND status = 'in_progress'`;
    return { saved: true };
  }

  async submit(auth: AuthUser, attemptId: string) {
    const attempt = await this.ownAttempt(auth, attemptId);
    if (attempt.status === AttemptStatus.in_progress) {
      await this.finalize(attempt.id, attempt.deadlineAt <= new Date());
    }
    return this.attempt(auth, attemptId);
  }

  // ---------------------------------------------------------------- grading

  /**
   * Submits an attempt: grades MCQs, computes integrity flags for written
   * answers, and either finishes grading or leaves it for a mentor.
   */
  async finalize(attemptId: string, auto: boolean) {
    const done = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM quiz_attempts WHERE id = ${attemptId}::uuid FOR UPDATE`;
      const attempt = await tx.quizAttempt.findUniqueOrThrow({
        where: { id: attemptId },
        include: {
          quiz: { include: { lesson: { include: { module: true } } } },
        },
      });
      if (attempt.status !== AttemptStatus.in_progress) return null;

      const questions = await tx.question.findMany({
        where: { id: { in: attempt.questionIds } },
      });
      const answers = answersOf(attempt);
      const events = (attempt.typingEvents ?? {}) as Record<string, unknown>;
      const autoScore = questions
        .filter(
          (q) => q.type === QuestionType.mcq && mcqCorrect(q, answers[q.id]),
        )
        .reduce((s, q) => s + q.points, 0);
      const written = questions.filter((q) => q.type !== QuestionType.mcq);
      const flags = Object.fromEntries(
        written.map((q) => [
          q.id,
          computeFlags(asEvents(events[q.id]), answers[q.id]?.text ?? ''),
        ]),
      );
      const now = new Date();
      const graded = written.length === 0;
      const percent = graded ? percentOf(autoScore, attempt.maxScore) : null;
      const passed = graded ? percent! >= attempt.quiz.passMark : null;

      await tx.quizAttempt.update({
        where: { id: attemptId },
        data: {
          status: graded ? AttemptStatus.graded : AttemptStatus.submitted,
          submittedAt: now,
          autoSubmitted: auto,
          autoScore,
          flags: flags as unknown as Prisma.InputJsonObject,
          ...(graded && { score: autoScore, percent, passed, gradedAt: now }),
        },
      });
      return passed
        ? {
            userId: attempt.userId,
            quizId: attempt.quizId,
            lessonId: attempt.quiz.lessonId,
            courseId: attempt.quiz.lesson.module.courseId,
          }
        : null;
    });
    if (done)
      await this.onPassed(
        done.userId,
        done.quizId,
        done.lessonId,
        done.courseId,
      );
  }

  /** Submits every attempt whose time is up, even if the student never came back. */
  @Cron(CronExpression.EVERY_MINUTE)
  async finalizeExpiredScheduled() {
    try {
      const n = await this.finalizeExpired();
      if (n > 0) this.logger.log(`Auto-submitted ${n} quiz attempt(s)`);
    } catch (err) {
      this.logger.error(`Auto-submit failed: ${String(err)}`);
    }
  }

  async finalizeExpired(where: { userId?: string; quizId?: string } = {}) {
    const expired = await this.prisma.quizAttempt.findMany({
      where: {
        ...where,
        status: AttemptStatus.in_progress,
        deadlineAt: { lte: new Date() },
      },
      select: { id: true },
      take: 500,
    });
    for (const a of expired) await this.finalize(a.id, true);
    return expired.length;
  }

  /** Full attempt for the mentor: answers, correct options, flags, typing events. */
  async forGrader(auth: AuthUser, attemptId: string) {
    const attempt = await this.prisma.quizAttempt.findUnique({
      where: { id: attemptId },
      include: {
        quiz: { include: { lesson: { select: { id: true, title: true } } } },
        user: {
          select: {
            id: true,
            email: true,
            profile: { select: { fullName: true } },
          },
        },
      },
    });
    if (!attempt)
      throw new AppException(HttpStatus.NOT_FOUND, 'ATTEMPT_NOT_FOUND');
    const lesson = await this.staff.lesson(
      auth,
      attempt.quiz.lessonId,
      LessonType.quiz,
    );
    const questions = await this.questionsOf(attempt);
    const answers = answersOf(attempt);
    const events = (attempt.typingEvents ?? {}) as Record<string, unknown>;
    const flags = (attempt.flags ?? {}) as Record<string, unknown>;
    const manual = (attempt.manualScores ?? {}) as Record<string, number>;
    return {
      id: attempt.id,
      status: attempt.status,
      student: {
        id: attempt.user.id,
        email: attempt.user.email,
        fullName: attempt.user.profile?.fullName ?? '',
      },
      course: {
        id: lesson.module.course.id,
        title: lesson.module.course.title,
      },
      lesson: attempt.quiz.lesson,
      passMark: attempt.quiz.passMark,
      startedAt: attempt.startedAt,
      deadlineAt: attempt.deadlineAt,
      submittedAt: attempt.submittedAt,
      autoSubmitted: attempt.autoSubmitted,
      tabSwitches: attempt.tabSwitches,
      autoScore: attempt.autoScore,
      score: attempt.score,
      maxScore: attempt.maxScore,
      percent: attempt.percent,
      passed: attempt.passed,
      feedback: attempt.feedback,
      questions: questions.map((q) => ({
        id: q.id,
        type: q.type,
        prompt: q.prompt,
        options: optionsOf(q),
        correctOptionIds: q.correctOptionIds,
        sampleAnswer: q.sampleAnswer,
        codeLanguage: q.codeLanguage,
        points: q.points,
        answer: answers[q.id] ?? null,
        autoCorrect:
          q.type === QuestionType.mcq ? mcqCorrect(q, answers[q.id]) : null,
        manualScore:
          q.type === QuestionType.mcq ? null : (manual[q.id] ?? null),
        typingEvents: q.type === QuestionType.mcq ? [] : asEvents(events[q.id]),
        flags: flags[q.id] ?? null,
      })),
    };
  }

  async grade(auth: AuthUser, attemptId: string, input: GradeAttemptInput) {
    const attempt = await this.prisma.quizAttempt.findUnique({
      where: { id: attemptId },
      include: { quiz: { include: { lesson: { include: { module: true } } } } },
    });
    if (!attempt)
      throw new AppException(HttpStatus.NOT_FOUND, 'ATTEMPT_NOT_FOUND');
    await this.staff.lesson(auth, attempt.quiz.lessonId, LessonType.quiz);
    if (attempt.status === AttemptStatus.in_progress) {
      throw new AppException(HttpStatus.CONFLICT, 'NOT_SUBMITTED');
    }
    const written = (
      await this.prisma.question.findMany({
        where: { id: { in: attempt.questionIds } },
      })
    ).filter((q) => q.type !== QuestionType.mcq);
    for (const q of written) {
      const pts = input.questionScores[q.id];
      if (pts === undefined)
        throw new AppException(HttpStatus.BAD_REQUEST, 'MISSING_SCORES');
      if (pts > q.points)
        throw new AppException(HttpStatus.BAD_REQUEST, 'SCORE_TOO_HIGH');
    }
    const manualScores = Object.fromEntries(
      written.map((q) => [q.id, input.questionScores[q.id]]),
    );
    const score =
      attempt.autoScore +
      Object.values(manualScores).reduce((s, n) => s + n, 0);
    const percent = percentOf(score, attempt.maxScore);
    const passed = percent >= attempt.quiz.passMark;
    await this.prisma.quizAttempt.update({
      where: { id: attemptId },
      data: {
        status: AttemptStatus.graded,
        manualScores,
        score,
        percent,
        passed,
        feedback: input.feedback,
        gradedBy: auth.id,
        gradedAt: new Date(),
      },
    });
    if (passed) {
      await this.onPassed(
        attempt.userId,
        attempt.quizId,
        attempt.quiz.lessonId,
        attempt.quiz.lesson.module.courseId,
      );
    }
    await this.notifications.notify(
      attempt.userId,
      {
        type: NotificationType.quiz_graded,
        title: t.notifications.quizGraded(attempt.quiz.lesson.title),
        body: `${score} / ${attempt.maxScore} (${percent}%)`,
        link: `/student/quizzes/${attemptId}`,
      },
      { email: true },
    );
    return this.forGrader(auth, attemptId);
  }

  // ---------------------------------------------------------------- helpers

  private async ownAttempt(auth: AuthUser, attemptId: string) {
    const attempt = await this.prisma.quizAttempt.findFirst({
      where: { id: attemptId, userId: auth.id },
      include: { quiz: true },
    });
    if (!attempt)
      throw new AppException(HttpStatus.NOT_FOUND, 'ATTEMPT_NOT_FOUND');
    return attempt;
  }

  /** Questions of an attempt, in the attempt's order. */
  private async questionsOf(attempt: { questionIds: string[] }) {
    const rows = await this.prisma.question.findMany({
      where: { id: { in: attempt.questionIds } },
    });
    const byId = new Map(rows.map((q) => [q.id, q]));
    return attempt.questionIds.flatMap((id) => byId.get(id) ?? []);
  }

  private checkOptions(question: Question, optionIds: string[]) {
    const valid = new Set(optionsOf(question).map((o) => o.id));
    const unique = [...new Set(optionIds)];
    if (
      unique.some((o) => !valid.has(o)) ||
      (!question.allowMultiple && unique.length > 1)
    ) {
      throw new AppException(HttpStatus.BAD_REQUEST, 'INVALID_ANSWER');
    }
    return unique;
  }

  /** Time is up (or already submitted): make sure it is finalized, then tell the client. */
  private async closed(attempt: {
    id: string;
    status: AttemptStatus;
  }): Promise<never> {
    if (attempt.status === AttemptStatus.in_progress)
      await this.finalize(attempt.id, true);
    throw new AppException(HttpStatus.CONFLICT, 'ATTEMPT_CLOSED');
  }
}
