import { HttpStatus, Injectable } from '@nestjs/common';
import { LessonType, Prisma, Role } from '@prisma/client';
import { ADMIN_ROLES, AuthUser } from '../auth/auth.types';
import { AppException } from '../common/app-exception';
import { LessonAccessService } from '../learning/lesson-access.service';
import { PrismaService } from '../prisma/prisma.service';

/** Mentor/admin checks shared by the question bank, quiz builder and grading. */
@Injectable()
export class StaffAccessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly lessons: LessonAccessService,
  ) {}

  /** Throws unless `auth` is an admin or a mentor of the course. */
  async assertCourse(auth: AuthUser, courseId: string) {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true, mentors: { select: { mentorId: true } } },
    });
    if (!course)
      throw new AppException(HttpStatus.NOT_FOUND, 'COURSE_NOT_FOUND');
    if (!this.lessons.isStaffFor(auth, course)) {
      throw new AppException(HttpStatus.FORBIDDEN, 'NOT_COURSE_MENTOR');
    }
  }

  /** The lesson, if `auth` teaches its course and it has the expected type. */
  async lesson(auth: AuthUser, lessonId: string, type: LessonType) {
    const lesson = await this.lessons.forStaff(auth, lessonId);
    if (lesson.type !== type) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        type === LessonType.quiz
          ? 'NOT_A_QUIZ_LESSON'
          : 'NOT_AN_ASSIGNMENT_LESSON',
      );
    }
    return lesson;
  }

  /** Filter for "lessons in courses this staff member teaches". */
  lessonScope(auth: AuthUser): Prisma.LessonWhereInput {
    if (ADMIN_ROLES.includes(auth.role)) return {};
    if (auth.role !== Role.mentor)
      return { id: '00000000-0000-0000-0000-000000000000' };
    return { module: { course: { mentors: { some: { mentorId: auth.id } } } } };
  }
}
