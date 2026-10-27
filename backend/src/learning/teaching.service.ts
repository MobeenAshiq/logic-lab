import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { LessonType, Prisma } from '@prisma/client';
import { ADMIN_ROLES, AuthUser } from '../auth/auth.types';
import { AppException } from '../common/app-exception';
import { PrismaService } from '../prisma/prisma.service';
import { PRESIGN_TTL_SECONDS, R2Service } from '../storage/r2.service';
import {
  AttachmentUploadInput,
  isUploadKey,
  newUploadKey,
  UPLOAD_PURPOSES,
  VideoUploadInput,
} from '../storage/uploads';
import {
  AbortVideoInput,
  CompleteVideoInput,
  SaveAttachmentInput,
  UpdateLessonMediaInput,
  VideoPartsInput,
} from './learning.schemas';
import { LessonAccessService } from './lesson-access.service';

/** R2 needs >= 5 MB parts (except the last); 10 MB keeps the part count low. */
export const VIDEO_PART_SIZE = 10 * 1024 * 1024;

/** Mentor (assigned courses) and admin tools: lesson video, notes and attachments. */
@Injectable()
export class TeachingService {
  private readonly logger = new Logger(TeachingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: LessonAccessService,
    private readonly r2: R2Service,
  ) {}

  /** Courses the mentor is assigned to (admins: all), with their lessons. */
  async courses(auth: AuthUser) {
    const where: Prisma.CourseWhereInput = ADMIN_ROLES.includes(auth.role)
      ? {}
      : { mentors: { some: { mentorId: auth.id } } };
    const courses = await this.prisma.course.findMany({
      where,
      orderBy: [{ track: { position: 'asc' } }, { position: 'asc' }],
      include: {
        track: { select: { title: true } },
        modules: {
          orderBy: { position: 'asc' },
          include: {
            lessons: {
              orderBy: { position: 'asc' },
              select: {
                id: true,
                title: true,
                type: true,
                isPublished: true,
                videoKey: true,
                durationSeconds: true,
                _count: { select: { attachments: true, questions: true } },
              },
            },
          },
        },
      },
    });
    return courses.map((c) => ({
      id: c.id,
      slug: c.slug,
      title: c.title,
      isPublished: c.isPublished,
      trackTitle: c.track.title,
      modules: c.modules.map((m) => ({
        id: m.id,
        title: m.title,
        isPublished: m.isPublished,
        lessons: m.lessons.map(({ videoKey, _count, ...l }) => ({
          ...l,
          hasVideo: Boolean(videoKey),
          attachmentCount: _count.attachments,
          questionCount: _count.questions,
        })),
      })),
    }));
  }

  async lesson(auth: AuthUser, lessonId: string) {
    const lesson = await this.access.forStaff(auth, lessonId);
    const attachments = await this.prisma.lessonAttachment.findMany({
      where: { lessonId },
      orderBy: { position: 'asc' },
      select: { id: true, filename: true, contentType: true, size: true },
    });
    return {
      id: lesson.id,
      title: lesson.title,
      type: lesson.type,
      isPublished: lesson.isPublished,
      notes: lesson.notes,
      durationSeconds: lesson.durationSeconds,
      video: lesson.videoKey
        ? {
            url: await this.r2.getDownloadUrl(lesson.videoKey),
            size: lesson.videoSize,
            expiresInSeconds: PRESIGN_TTL_SECONDS,
          }
        : null,
      attachments,
      module: { id: lesson.module.id, title: lesson.module.title },
      course: {
        id: lesson.module.course.id,
        slug: lesson.module.course.slug,
        title: lesson.module.course.title,
      },
    };
  }

  async updateLesson(
    auth: AuthUser,
    lessonId: string,
    input: UpdateLessonMediaInput,
  ) {
    await this.access.forStaff(auth, lessonId);
    await this.prisma.lesson.update({ where: { id: lessonId }, data: input });
    return this.lesson(auth, lessonId);
  }

  // --- Video (multipart upload straight from the browser to R2) ---

  async startVideo(auth: AuthUser, lessonId: string, input: VideoUploadInput) {
    const lesson = await this.access.forStaff(auth, lessonId);
    if (lesson.type !== LessonType.video) {
      throw new AppException(HttpStatus.BAD_REQUEST, 'NOT_A_VIDEO_LESSON');
    }
    const key = newUploadKey('lesson-video', input.contentType, lessonId);
    const uploadId = await this.r2.createMultipartUpload(
      key,
      input.contentType,
    );
    return {
      key,
      uploadId,
      partSize: VIDEO_PART_SIZE,
      partCount: Math.max(1, Math.ceil(input.size / VIDEO_PART_SIZE)),
    };
  }

  /** Part URLs are signed in small batches, so a slow upload never hits the 10-minute expiry. */
  async videoPartUrls(
    auth: AuthUser,
    lessonId: string,
    input: VideoPartsInput,
  ) {
    await this.access.forStaff(auth, lessonId);
    this.assertKey('lesson-video', input.key, lessonId);
    const urls = await Promise.all(
      input.partNumbers.map(async (partNumber) => ({
        partNumber,
        url: await this.r2.getUploadPartUrl(
          input.key,
          input.uploadId,
          partNumber,
        ),
      })),
    );
    return { urls };
  }

  async completeVideo(
    auth: AuthUser,
    lessonId: string,
    input: CompleteVideoInput,
  ) {
    const lesson = await this.access.forStaff(auth, lessonId);
    this.assertKey('lesson-video', input.key, lessonId);
    await this.r2.completeMultipartUpload(
      input.key,
      input.uploadId,
      [...input.parts].sort((a, b) => a.partNumber - b.partNumber),
    );
    const size = await this.r2.objectSize(input.key);
    if (size === null) {
      throw new AppException(HttpStatus.BAD_REQUEST, 'UPLOAD_NOT_FINISHED');
    }
    if (size > UPLOAD_PURPOSES['lesson-video'].maxBytes) {
      await this.r2.deleteObject(input.key);
      throw new AppException(HttpStatus.BAD_REQUEST, 'VALIDATION_FAILED', {
        errors: [{ field: 'size', message: 'Max size is 2000 MB' }],
      });
    }
    await this.prisma.lesson.update({
      where: { id: lessonId },
      data: {
        videoKey: input.key,
        videoSize: size,
        durationSeconds: input.durationSeconds,
      },
    });
    if (lesson.videoKey && lesson.videoKey !== input.key) {
      await this.removeObject(lesson.videoKey);
    }
    return this.lesson(auth, lessonId);
  }

  async abortVideo(auth: AuthUser, lessonId: string, input: AbortVideoInput) {
    await this.access.forStaff(auth, lessonId);
    this.assertKey('lesson-video', input.key, lessonId);
    await this.r2.abortMultipartUpload(input.key, input.uploadId);
  }

  async deleteVideo(auth: AuthUser, lessonId: string) {
    const lesson = await this.access.forStaff(auth, lessonId);
    await this.prisma.lesson.update({
      where: { id: lessonId },
      data: { videoKey: null, videoSize: null },
    });
    if (lesson.videoKey) await this.removeObject(lesson.videoKey);
    return this.lesson(auth, lessonId);
  }

  // --- Attachments (single presigned PUT, max 50 MB) ---

  async attachmentUploadUrl(
    auth: AuthUser,
    lessonId: string,
    input: AttachmentUploadInput,
  ) {
    await this.access.forStaff(auth, lessonId);
    const key = newUploadKey('lesson-attachment', input.contentType, lessonId);
    return {
      key,
      uploadUrl: await this.r2.getUploadUrl(key, input.contentType, input.size),
      method: 'PUT',
      headers: { 'Content-Type': input.contentType },
      expiresInSeconds: PRESIGN_TTL_SECONDS,
    };
  }

  async saveAttachment(
    auth: AuthUser,
    lessonId: string,
    input: SaveAttachmentInput,
  ) {
    await this.access.forStaff(auth, lessonId);
    this.assertKey('lesson-attachment', input.key, lessonId);
    const size = await this.r2.objectSize(input.key);
    if (size === null) {
      throw new AppException(HttpStatus.BAD_REQUEST, 'UPLOAD_NOT_FINISHED');
    }
    const ext = input.key.split('.').pop() ?? '';
    const contentType =
      Object.entries(UPLOAD_PURPOSES['lesson-attachment'].types).find(
        ([, e]) => e === ext,
      )?.[0] ?? 'application/octet-stream';
    const max = await this.prisma.lessonAttachment.aggregate({
      where: { lessonId },
      _max: { position: true },
    });
    await this.prisma.lessonAttachment.create({
      data: {
        lessonId,
        key: input.key,
        filename: input.filename,
        contentType,
        size,
        position: (max._max.position ?? 0) + 1,
      },
    });
    return this.lesson(auth, lessonId);
  }

  async deleteAttachment(
    auth: AuthUser,
    lessonId: string,
    attachmentId: string,
  ) {
    await this.access.forStaff(auth, lessonId);
    const attachment = await this.prisma.lessonAttachment.findFirst({
      where: { id: attachmentId, lessonId },
    });
    if (!attachment) {
      throw new AppException(HttpStatus.NOT_FOUND, 'ATTACHMENT_NOT_FOUND');
    }
    await this.prisma.lessonAttachment.delete({ where: { id: attachmentId } });
    await this.removeObject(attachment.key);
    return this.lesson(auth, lessonId);
  }

  private assertKey(
    purpose: 'lesson-video' | 'lesson-attachment',
    key: string,
    lessonId: string,
  ) {
    if (!isUploadKey(purpose, key, lessonId)) {
      throw new AppException(HttpStatus.BAD_REQUEST, 'INVALID_UPLOAD_KEY');
    }
  }

  /** Storage cleanup is best effort: a leftover file must not fail the request. */
  private async removeObject(key: string) {
    try {
      await this.r2.deleteObject(key);
    } catch (err) {
      this.logger.warn(`Could not delete ${key}: ${String(err)}`);
    }
  }
}
