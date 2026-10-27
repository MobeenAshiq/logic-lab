import { Injectable } from '@nestjs/common';
import { AttemptStatus, SubmissionStatus } from '@prisma/client';
import { AuthUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { hasFlags, IntegrityFlags } from './integrity';
import { StaffAccessService } from './staff-access.service';

const student = {
  select: { id: true, email: true, profile: { select: { fullName: true } } },
};
const lessonInfo = {
  select: {
    id: true,
    title: true,
    module: { select: { course: { select: { id: true, title: true } } } },
  },
};

/** Work waiting for (or already given) a grade, in the courses the mentor teaches. */
@Injectable()
export class GradingQueueService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly staff: StaffAccessService,
  ) {}

  async list(auth: AuthUser, status: 'pending' | 'graded') {
    const scope = this.staff.lessonScope(auth);
    const [submissions, attempts] = await Promise.all([
      this.prisma.submission.findMany({
        where: {
          status:
            status === 'pending'
              ? SubmissionStatus.submitted
              : SubmissionStatus.returned,
          assignment: { lesson: scope },
        },
        orderBy: { submittedAt: 'asc' },
        take: 200,
        include: {
          user: student,
          assignment: { include: { lesson: lessonInfo } },
        },
      }),
      this.prisma.quizAttempt.findMany({
        where: {
          status:
            status === 'pending'
              ? AttemptStatus.submitted
              : AttemptStatus.graded,
          quiz: { lesson: scope },
          // Graded list: only attempts a mentor graded (pure-MCQ quizzes grade themselves).
          ...(status === 'graded' && { gradedBy: { not: null } }),
        },
        orderBy: { submittedAt: 'asc' },
        take: 200,
        include: { user: student, quiz: { include: { lesson: lessonInfo } } },
      }),
    ]);

    const person = (u: {
      id: string;
      email: string;
      profile: { fullName: string } | null;
    }) => ({
      id: u.id,
      email: u.email,
      fullName: u.profile?.fullName ?? '',
    });

    const items = [
      ...submissions.map((s) => ({
        kind: 'submission' as const,
        id: s.id,
        student: person(s.user),
        course: s.assignment.lesson.module.course,
        lesson: {
          id: s.assignment.lesson.id,
          title: s.assignment.lesson.title,
        },
        submittedAt: s.submittedAt,
        late: s.late,
        flagged: hasFlags(s.flags as Partial<IntegrityFlags>),
        tabSwitches: null,
        score: s.grade,
        maxScore: s.assignment.maxMarks,
      })),
      ...attempts.map((a) => ({
        kind: 'attempt' as const,
        id: a.id,
        student: person(a.user),
        course: a.quiz.lesson.module.course,
        lesson: { id: a.quiz.lesson.id, title: a.quiz.lesson.title },
        submittedAt: a.submittedAt,
        late: false,
        flagged:
          a.tabSwitches > 0 ||
          Object.values(
            (a.flags ?? {}) as Record<string, Partial<IntegrityFlags>>,
          ).some(hasFlags),
        tabSwitches: a.tabSwitches,
        score: a.score,
        maxScore: a.maxScore,
      })),
    ];
    return items.sort(
      (x, y) =>
        (x.submittedAt?.getTime() ?? 0) - (y.submittedAt?.getTime() ?? 0),
    );
  }
}
