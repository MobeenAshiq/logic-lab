import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ADMIN_ROLES, AuthUser } from '../auth/auth.types';
import { AppException } from '../common/app-exception';
import { PrismaService } from '../prisma/prisma.service';
import { AnswerInput, AskQuestionInput } from './learning.schemas';
import { LessonAccessService } from './lesson-access.service';

const author = {
  select: { id: true, profile: { select: { fullName: true, role: true } } },
} as const;

const questionInclude = {
  user: author,
  answers: { orderBy: { createdAt: 'asc' }, include: { user: author } },
} satisfies Prisma.LessonQuestionInclude;

type QuestionRow = Prisma.LessonQuestionGetPayload<{
  include: typeof questionInclude;
}>;

function authorView(u: QuestionRow['user']) {
  return {
    id: u.id,
    fullName: u.profile?.fullName ?? '',
    role: u.profile?.role ?? null,
  };
}

function toView(q: QuestionRow) {
  return {
    id: q.id,
    lessonId: q.lessonId,
    body: q.body,
    timestampSeconds: q.timestampSeconds,
    createdAt: q.createdAt,
    author: authorView(q.user),
    answers: q.answers.map((a) => ({
      id: a.id,
      body: a.body,
      isStaff: a.isStaff,
      createdAt: a.createdAt,
      author: authorView(a.user),
    })),
  };
}

/** Timestamped questions under a lesson, answered by mentors (or other students). */
@Injectable()
export class QuestionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: LessonAccessService,
  ) {}

  async list(auth: AuthUser, lessonId: string) {
    await this.access.forViewer(auth, lessonId);
    const rows = await this.prisma.lessonQuestion.findMany({
      where: { lessonId },
      orderBy: [
        { timestampSeconds: { sort: 'asc', nulls: 'last' } },
        { createdAt: 'asc' },
      ],
      include: questionInclude,
    });
    return rows.map(toView);
  }

  async ask(auth: AuthUser, lessonId: string, input: AskQuestionInput) {
    await this.access.forViewer(auth, lessonId);
    const row = await this.prisma.lessonQuestion.create({
      data: {
        lessonId,
        userId: auth.id,
        body: input.body,
        timestampSeconds: input.timestampSeconds ?? null,
      },
      include: questionInclude,
    });
    return toView(row);
  }

  async answer(auth: AuthUser, questionId: string, input: AnswerInput) {
    const question = await this.prisma.lessonQuestion.findUnique({
      where: { id: questionId },
    });
    if (!question) {
      throw new AppException(HttpStatus.NOT_FOUND, 'QUESTION_NOT_FOUND');
    }
    const { isStaff } = await this.access.forViewer(auth, question.lessonId);
    await this.prisma.lessonAnswer.create({
      data: { questionId, userId: auth.id, body: input.body, isStaff },
    });
    const row = await this.prisma.lessonQuestion.findUniqueOrThrow({
      where: { id: questionId },
      include: questionInclude,
    });
    return toView(row);
  }

  /** Mentor inbox: questions in the courses they teach (admins: all courses). */
  async inbox(auth: AuthUser, status: 'unanswered' | 'all') {
    const rows = await this.prisma.lessonQuestion.findMany({
      where: {
        ...(status === 'unanswered' && {
          answers: { none: { isStaff: true } },
        }),
        ...(ADMIN_ROLES.includes(auth.role)
          ? {}
          : {
              lesson: {
                module: {
                  course: { mentors: { some: { mentorId: auth.id } } },
                },
              },
            }),
      },
      orderBy: { createdAt: 'asc' },
      take: 100,
      include: {
        ...questionInclude,
        lesson: {
          select: {
            id: true,
            title: true,
            module: {
              select: { course: { select: { id: true, title: true } } },
            },
          },
        },
      },
    });
    return rows.map((q) => ({
      ...toView(q),
      lesson: { id: q.lesson.id, title: q.lesson.title },
      course: q.lesson.module.course,
    }));
  }
}
