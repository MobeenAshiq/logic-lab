import { HttpStatus, Injectable } from '@nestjs/common';
import { LessonType, Role } from '@prisma/client';
import { AuthUser } from '../auth/auth.types';
import { SubscriptionsService } from '../billing/subscriptions.service';
import { AppException } from '../common/app-exception';
import { collectImageKeys } from '../content/tiptap';
import { PrismaService } from '../prisma/prisma.service';
import { PRESIGN_TTL_SECONDS, R2Service } from '../storage/r2.service';
import { ProgressPingInput } from './learning.schemas';
import { LessonAccessService } from './lesson-access.service';
import { ProgressService } from './progress.service';

/** What a learner sees: lesson page, signed media URLs, progress, course outline. */
@Injectable()
export class LearnService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: LessonAccessService,
    private readonly progress: ProgressService,
    private readonly subscriptions: SubscriptionsService,
    private readonly r2: R2Service,
  ) {}

  async lesson(auth: AuthUser, lessonId: string) {
    const { lesson, course, isStaff } = await this.access.forViewer(
      auth,
      lessonId,
    );
    const isStudent = auth.role === Role.student;
    if (isStudent)
      await this.progress.recordVisit(auth.id, course.id, lesson.id);

    const [attachments, assetUrls, progress, video, nav] = await Promise.all([
      this.prisma.lessonAttachment.findMany({
        where: { lessonId },
        orderBy: { position: 'asc' },
        select: { id: true, filename: true, contentType: true, size: true },
      }),
      this.r2.getDownloadUrls(collectImageKeys(lesson.content)),
      isStudent ? this.progress.get(auth.id, lesson.id) : null,
      lesson.type === LessonType.video && lesson.videoKey
        ? this.videoTicket(lesson.videoKey)
        : null,
      this.neighbours(course.id, lesson.id, isStaff),
    ]);

    return {
      id: lesson.id,
      title: lesson.title,
      type: lesson.type,
      position: lesson.position,
      durationSeconds: lesson.durationSeconds,
      content: lesson.content,
      assetUrls,
      notes: lesson.notes,
      attachments,
      video,
      progress,
      // Shown faintly over the video to discourage screen recording.
      watermark: auth.email,
      isStaff,
      module: { id: lesson.module.id, title: lesson.module.title },
      course: { id: course.id, slug: course.slug, title: course.title },
      previousLessonId: nav.previous,
      nextLessonId: nav.next,
    };
  }

  /** A fresh 10-minute video URL (the player asks again before/after expiry). */
  async videoUrl(auth: AuthUser, lessonId: string) {
    const { lesson } = await this.access.forViewer(auth, lessonId);
    if (!lesson.videoKey) {
      throw new AppException(HttpStatus.NOT_FOUND, 'VIDEO_NOT_UPLOADED');
    }
    return this.videoTicket(lesson.videoKey);
  }

  async attachmentUrl(auth: AuthUser, attachmentId: string) {
    const attachment = await this.prisma.lessonAttachment.findUnique({
      where: { id: attachmentId },
    });
    if (!attachment) {
      throw new AppException(HttpStatus.NOT_FOUND, 'ATTACHMENT_NOT_FOUND');
    }
    await this.access.forViewer(auth, attachment.lessonId);
    return {
      url: await this.r2.getDownloadUrl(attachment.key, attachment.filename),
      expiresInSeconds: PRESIGN_TTL_SECONDS,
    };
  }

  /** Only students' progress is recorded; staff previews are ignored. */
  async ping(auth: AuthUser, lessonId: string, input: ProgressPingInput) {
    const { lesson, course } = await this.access.forViewer(auth, lessonId);
    if (auth.role !== Role.student) return null;
    return this.progress.ping(
      auth.id,
      { ...lesson, courseId: course.id },
      input,
    );
  }

  async complete(auth: AuthUser, lessonId: string) {
    const { lesson, course } = await this.access.forViewer(auth, lessonId);
    if (auth.role !== Role.student) return null;
    if (lesson.type === LessonType.video) {
      // Videos complete automatically at 90% watched.
      return this.progress.get(auth.id, lesson.id);
    }
    return this.progress.markComplete(auth.id, lesson.id, course.id);
  }

  /**
   * Course outline for a learner: published modules and lessons with lock and
   * completion state. Works without access too (everything shows as locked by
   * the paywall), so the page can show the student where they stand.
   */
  async outline(auth: AuthUser, slug: string) {
    const course = await this.prisma.course.findFirst({
      where: { slug, isPublished: true, track: { isPublished: true } },
      include: {
        track: { select: { slug: true, title: true } },
        modules: {
          where: { isPublished: true },
          orderBy: { position: 'asc' },
          include: {
            lessons: {
              where: { isPublished: true },
              orderBy: { position: 'asc' },
              select: {
                id: true,
                title: true,
                type: true,
                durationSeconds: true,
              },
            },
          },
        },
      },
    });
    if (!course)
      throw new AppException(HttpStatus.NOT_FOUND, 'COURSE_NOT_FOUND');

    const [hasAccess, locks, progress] = await Promise.all([
      this.subscriptions.hasAccess(auth.id, course.id),
      this.access.moduleLocks(auth.id, course.id),
      this.progress.completedIn(auth.id, course.id),
    ]);
    const lessons = course.modules.flatMap((m) => m.lessons);
    const completedCount = lessons.filter(
      (l) => progress.get(l.id)?.completed,
    ).length;

    return {
      id: course.id,
      slug: course.slug,
      title: course.title,
      shortDescription: course.shortDescription,
      track: course.track,
      hasAccess,
      totalLessons: lessons.length,
      completedLessons: completedCount,
      percent: lessons.length
        ? Math.round((completedCount / lessons.length) * 100)
        : 0,
      modules: course.modules.map((m) => {
        const lock = locks.get(m.id);
        return {
          id: m.id,
          title: m.title,
          description: m.description,
          locked: lock?.locked ?? false,
          unlockAfterTitle: lock?.unlockAfterTitle ?? null,
          lessons: m.lessons.map((l) => ({
            ...l,
            completed: progress.get(l.id)?.completed ?? false,
            positionSeconds: progress.get(l.id)?.positionSeconds ?? 0,
          })),
        };
      }),
    };
  }

  private async videoTicket(key: string) {
    return {
      url: await this.r2.getDownloadUrl(key),
      expiresInSeconds: PRESIGN_TTL_SECONDS,
    };
  }

  /** Previous/next lesson in course order (published only, unless staff). */
  private async neighbours(
    courseId: string,
    lessonId: string,
    isStaff: boolean,
  ) {
    const published = isStaff ? {} : { isPublished: true };
    const modules = await this.prisma.module.findMany({
      where: { courseId, ...published },
      orderBy: { position: 'asc' },
      select: {
        lessons: {
          where: published,
          orderBy: { position: 'asc' },
          select: { id: true },
        },
      },
    });
    const ids = modules.flatMap((m) => m.lessons.map((l) => l.id));
    const i = ids.indexOf(lessonId);
    return {
      previous: i > 0 ? ids[i - 1] : null,
      next: i >= 0 && i < ids.length - 1 ? ids[i + 1] : null,
    };
  }
}
