import { HttpStatus, Injectable } from '@nestjs/common';
import {
  LessonType,
  NotificationType,
  PointReason,
  Prisma,
  Role,
  SubmissionStatus,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../auth/auth.types';
import { AppException } from '../common/app-exception';
import { t } from '../common/i18n/en';
import { LessonAccessService } from '../learning/lesson-access.service';
import { ProgressService } from '../learning/progress.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PointsService } from '../points/points.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  AssignmentSettingsInput,
  GradeSubmissionInput,
  RubricCriterion,
} from './assessments.schemas';
import { asEvents, computeFlags, MAX_EVENTS, TypingEvent } from './integrity';
import { StaffAccessService } from './staff-access.service';

function criteriaOf(
  rubric: { criteria: Prisma.JsonValue } | null,
): RubricCriterion[] {
  return Array.isArray(rubric?.criteria)
    ? (rubric.criteria as unknown as RubricCriterion[])
    : [];
}

@Injectable()
export class AssignmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly staff: StaffAccessService,
    private readonly access: LessonAccessService,
    private readonly progress: ProgressService,
    private readonly points: PointsService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
  ) {}

  // ---------------------------------------------------------------- builder

  private ensure(lessonId: string) {
    return this.prisma.assignment.upsert({
      where: { lessonId },
      create: { lessonId },
      update: {},
      include: { rubric: true },
    });
  }

  async forStaff(auth: AuthUser, lessonId: string) {
    const lesson = await this.staff.lesson(
      auth,
      lessonId,
      LessonType.assignment,
    );
    const a = await this.ensure(lessonId);
    const submissions = await this.prisma.submission.groupBy({
      by: ['status'],
      where: { assignmentId: a.id },
      _count: true,
    });
    return {
      id: a.id,
      lessonId,
      lessonTitle: lesson.title,
      courseId: lesson.module.course.id,
      instructions: a.instructions,
      dueAt: a.dueAt,
      maxMarks: a.maxMarks,
      rubric: criteriaOf(a.rubric),
      submissionCounts: Object.fromEntries(
        submissions.map((s) => [s.status, s._count]),
      ),
    };
  }

  async update(
    auth: AuthUser,
    lessonId: string,
    input: AssignmentSettingsInput,
  ) {
    await this.staff.lesson(auth, lessonId, LessonType.assignment);
    const a = await this.ensure(lessonId);
    await this.prisma.$transaction([
      this.prisma.assignment.update({
        where: { id: a.id },
        data: {
          instructions: input.instructions,
          dueAt: input.dueAt ? new Date(input.dueAt) : null,
          maxMarks: input.maxMarks,
        },
      }),
      this.prisma.rubric.upsert({
        where: { assignmentId: a.id },
        create: {
          assignmentId: a.id,
          criteria: input.rubric,
        },
        update: { criteria: input.rubric },
      }),
    ]);
    return this.forStaff(auth, lessonId);
  }

  // ---------------------------------------------------------------- student

  private async forStudent(auth: AuthUser, lessonId: string) {
    const { lesson } = await this.access.forViewer(auth, lessonId);
    if (lesson.type !== LessonType.assignment) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        'NOT_AN_ASSIGNMENT_LESSON',
      );
    }
    const assignment = await this.ensure(lessonId);
    return { lesson, assignment };
  }

  /** Assignment page: instructions, rubric, and the student's own work and grade. */
  async info(auth: AuthUser, lessonId: string) {
    const { assignment: a } = await this.forStudent(auth, lessonId);
    const submission =
      auth.role === Role.student
        ? await this.prisma.submission.findUnique({
            where: {
              assignmentId_userId: { assignmentId: a.id, userId: auth.id },
            },
          })
        : null;
    const returned = submission?.status === SubmissionStatus.returned;
    return {
      id: a.id,
      lessonId,
      instructions: a.instructions,
      dueAt: a.dueAt,
      maxMarks: a.maxMarks,
      rubric: criteriaOf(a.rubric),
      serverNow: new Date(),
      submission: submission && {
        id: submission.id,
        status: submission.status,
        content: submission.content,
        draftSavedAt: submission.draftSavedAt,
        submittedAt: submission.submittedAt,
        late: submission.late,
        // Grades are visible only once the mentor returns the work.
        grade: returned ? submission.grade : null,
        rubricScores: returned ? submission.rubricScores : {},
        feedback: returned ? submission.feedback : '',
        returnedAt: submission.returnedAt,
      },
    };
  }

  /** Autosave (every ~15 s from the editor). Only while still a draft. */
  async saveDraft(auth: AuthUser, lessonId: string, content: string) {
    const { assignment } = await this.forStudent(auth, lessonId);
    const sub = await this.draft(auth.id, assignment.id);
    await this.prisma.submission.update({
      where: { id: sub.id },
      data: { content, draftSavedAt: new Date() },
    });
    return { savedAt: new Date() };
  }

  async appendTyping(auth: AuthUser, lessonId: string, events: TypingEvent[]) {
    const { assignment } = await this.forStudent(auth, lessonId);
    const sub = await this.draft(auth.id, assignment.id);
    if (events.length === 0) return { saved: false };
    const updated = await this.prisma.$executeRaw`
      UPDATE submissions
      SET typing_events = typing_events || ${JSON.stringify(events)}::jsonb, updated_at = now()
      WHERE id = ${sub.id}::uuid AND status = 'draft'
        AND jsonb_array_length(typing_events) < ${MAX_EVENTS}`;
    return { saved: updated > 0 };
  }

  async submit(auth: AuthUser, lessonId: string, content: string) {
    const { lesson, assignment } = await this.forStudent(auth, lessonId);
    const sub = await this.draft(auth.id, assignment.id);
    const now = new Date();
    const flags = computeFlags(asEvents(sub.typingEvents), content);
    const late = Boolean(assignment.dueAt && now > assignment.dueAt);
    await this.prisma.submission.update({
      where: { id: sub.id },
      data: {
        content,
        status: SubmissionStatus.submitted,
        submittedAt: now,
        late,
        flags: flags as unknown as Prisma.InputJsonObject,
      },
    });
    await this.progress.markComplete(
      auth.id,
      lessonId,
      lesson.module.course.id,
    );
    if (!late) {
      await this.points.award(
        auth.id,
        PointReason.assignment_on_time,
        assignment.id,
        {
          trackId: lesson.module.course.trackId,
        },
      );
    }
    return this.info(auth, lessonId);
  }

  /** The student's draft (created on first save). Throws once submitted. */
  private async draft(userId: string, assignmentId: string) {
    const sub = await this.prisma.submission.upsert({
      where: { assignmentId_userId: { assignmentId, userId } },
      create: { assignmentId, userId },
      update: {},
    });
    if (sub.status !== SubmissionStatus.draft) {
      throw new AppException(
        HttpStatus.CONFLICT,
        'ASSIGNMENT_ALREADY_SUBMITTED',
      );
    }
    return sub;
  }

  // ---------------------------------------------------------------- grading

  async forGrader(auth: AuthUser, submissionId: string) {
    const sub = await this.prisma.submission.findUnique({
      where: { id: submissionId },
      include: {
        assignment: {
          include: {
            rubric: true,
            lesson: { select: { id: true, title: true } },
          },
        },
        user: {
          select: {
            id: true,
            email: true,
            profile: { select: { fullName: true } },
          },
        },
      },
    });
    if (!sub)
      throw new AppException(HttpStatus.NOT_FOUND, 'SUBMISSION_NOT_FOUND');
    const lesson = await this.staff.lesson(
      auth,
      sub.assignment.lessonId,
      LessonType.assignment,
    );
    const events = asEvents(sub.typingEvents);
    return {
      id: sub.id,
      status: sub.status,
      student: {
        id: sub.user.id,
        email: sub.user.email,
        fullName: sub.user.profile?.fullName ?? '',
      },
      course: {
        id: lesson.module.course.id,
        title: lesson.module.course.title,
      },
      lesson: sub.assignment.lesson,
      instructions: sub.assignment.instructions,
      dueAt: sub.assignment.dueAt,
      maxMarks: sub.assignment.maxMarks,
      rubric: criteriaOf(sub.assignment.rubric),
      content: sub.content,
      submittedAt: sub.submittedAt,
      late: sub.late,
      // Recomputed so drafts in progress also show current flags.
      flags:
        sub.status === SubmissionStatus.draft
          ? computeFlags(events, sub.content)
          : sub.flags,
      typingEvents: events,
      grade: sub.grade,
      rubricScores: sub.rubricScores,
      feedback: sub.feedback,
      returnedAt: sub.returnedAt,
    };
  }

  /** Scores the rubric (or a single grade), saves feedback and returns the work to the student. */
  async grade(
    auth: AuthUser,
    submissionId: string,
    input: GradeSubmissionInput,
  ) {
    const sub = await this.prisma.submission.findUnique({
      where: { id: submissionId },
      include: { assignment: { include: { rubric: true } } },
    });
    if (!sub)
      throw new AppException(HttpStatus.NOT_FOUND, 'SUBMISSION_NOT_FOUND');
    await this.staff.lesson(
      auth,
      sub.assignment.lessonId,
      LessonType.assignment,
    );
    if (sub.status === SubmissionStatus.draft) {
      throw new AppException(HttpStatus.CONFLICT, 'NOT_SUBMITTED');
    }
    const criteria = criteriaOf(sub.assignment.rubric);
    let grade: number;
    let rubricScores: Record<string, number> = {};
    if (criteria.length > 0) {
      for (const c of criteria) {
        const pts = input.rubricScores[c.id];
        if (pts === undefined)
          throw new AppException(HttpStatus.BAD_REQUEST, 'MISSING_SCORES');
        if (pts > c.maxPoints)
          throw new AppException(HttpStatus.BAD_REQUEST, 'SCORE_TOO_HIGH');
      }
      rubricScores = Object.fromEntries(
        criteria.map((c) => [c.id, input.rubricScores[c.id]]),
      );
      grade = Object.values(rubricScores).reduce((s, n) => s + n, 0);
    } else {
      if (input.grade === undefined)
        throw new AppException(HttpStatus.BAD_REQUEST, 'MISSING_SCORES');
      if (input.grade > sub.assignment.maxMarks) {
        throw new AppException(HttpStatus.BAD_REQUEST, 'SCORE_TOO_HIGH');
      }
      grade = input.grade;
    }
    await this.prisma.submission.update({
      where: { id: submissionId },
      data: {
        grade,
        rubricScores,
        feedback: input.feedback,
        status: SubmissionStatus.returned,
        gradedBy: auth.id,
        returnedAt: new Date(),
      },
    });
    const lesson = await this.prisma.lesson.findUniqueOrThrow({
      where: { id: sub.assignment.lessonId },
      select: { title: true },
    });
    await this.notifications.notify(
      sub.userId,
      {
        type: NotificationType.grade_returned,
        title: t.notifications.gradeReturned(lesson.title),
        body: `${grade} / ${sub.assignment.maxMarks}`,
        link: `/student/lessons/${sub.assignment.lessonId}`,
      },
      { email: true },
    );
    return this.forGrader(auth, submissionId);
  }

  /**
   * A mentor confirms an integrity concern after reviewing the replay. Applies
   * the configured penalty once per submission and records it in the audit log.
   * Flags alone never cost points; this needs a human decision.
   */
  async confirmPlagiarism(
    auth: AuthUser,
    submissionId: string,
    note: string,
    ip: string | null,
  ) {
    const sub = await this.prisma.submission.findUnique({
      where: { id: submissionId },
      include: { assignment: true },
    });
    if (!sub)
      throw new AppException(HttpStatus.NOT_FOUND, 'SUBMISSION_NOT_FOUND');
    const lesson = await this.staff.lesson(
      auth,
      sub.assignment.lessonId,
      LessonType.assignment,
    );
    if (sub.status === SubmissionStatus.draft) {
      throw new AppException(HttpStatus.CONFLICT, 'NOT_SUBMITTED');
    }
    const event = await this.points.award(
      sub.userId,
      PointReason.plagiarism_confirmed,
      sub.id,
      {
        trackId: lesson.module.course.trackId,
      },
    );
    await this.audit.log({
      actorId: auth.id,
      action: 'integrity.plagiarism_confirmed',
      targetType: 'submission',
      targetId: sub.id,
      metadata: { studentId: sub.userId, note, points: event?.points ?? 0 },
      ip,
    });
    return { confirmed: true, points: event?.points ?? null };
  }
}
