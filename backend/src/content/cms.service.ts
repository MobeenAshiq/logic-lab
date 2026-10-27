import { HttpStatus, Injectable } from '@nestjs/common';
import { Course, Role } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../auth/auth.types';
import { AppException } from '../common/app-exception';
import { uniqueSlug } from '../common/slug';
import { PrismaService } from '../prisma/prisma.service';
import { R2Service } from '../storage/r2.service';
import {
  CreateCourseInput,
  CreateTrackInput,
  ListCoursesInput,
  UpdateCourseInput,
  UpdateTrackInput,
} from './content.schemas';
import { applyOrder, nextPosition } from './ordering';

/** Admin CMS for tracks, courses and course mentors. */
@Injectable()
export class CmsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly r2: R2Service,
    private readonly audit: AuditService,
  ) {}

  // --- Tracks ---

  listTracks() {
    return this.prisma.track.findMany({
      orderBy: { position: 'asc' },
      include: { _count: { select: { courses: true } } },
    });
  }

  async createTrack(input: CreateTrackInput) {
    const slug = await this.resolveSlug(
      'track',
      input.slug ?? input.title,
      !!input.slug,
    );
    const max = await this.prisma.track.aggregate({ _max: { position: true } });
    return this.prisma.track.create({
      data: { ...input, slug, position: nextPosition(max) },
    });
  }

  async updateTrack(id: string, input: UpdateTrackInput) {
    await this.getTrack(id);
    if (input.slug) await this.assertSlugFree('track', input.slug, id);
    return this.prisma.track.update({ where: { id }, data: input });
  }

  async deleteTrack(id: string) {
    const track = await this.prisma.track.findUnique({
      where: { id },
      include: { _count: { select: { courses: true } } },
    });
    if (!track) throw new AppException(HttpStatus.NOT_FOUND, 'TRACK_NOT_FOUND');
    if (track._count.courses > 0) {
      throw new AppException(HttpStatus.CONFLICT, 'TRACK_HAS_COURSES');
    }
    await this.prisma.track.delete({ where: { id } });
  }

  async reorderTracks(ids: string[]) {
    await this.prisma.$transaction(async (tx) => {
      const all = await tx.track.findMany({ select: { id: true } });
      await applyOrder(
        tx,
        'tracks',
        all.map((t) => t.id),
        ids,
      );
    });
    return this.listTracks();
  }

  // --- Courses ---

  async listCourses(q: ListCoursesInput) {
    const courses = await this.prisma.course.findMany({
      where: q.trackId ? { trackId: q.trackId } : undefined,
      orderBy: [{ trackId: 'asc' }, { position: 'asc' }],
      include: {
        track: { select: { id: true, slug: true, title: true } },
        _count: { select: { modules: true, mentors: true } },
      },
    });
    return this.withCoverUrls(courses);
  }

  /** Full course tree for the editor, including unpublished items (no lesson bodies). */
  async getCourse(id: string) {
    const course = await this.prisma.course.findUnique({
      where: { id },
      include: {
        track: { select: { id: true, slug: true, title: true } },
        modules: {
          orderBy: { position: 'asc' },
          include: {
            lessons: {
              orderBy: { position: 'asc' },
              omit: { content: true },
            },
          },
        },
        mentors: {
          include: {
            mentor: {
              select: {
                id: true,
                fullName: true,
                user: { select: { email: true } },
              },
            },
          },
        },
      },
    });
    if (!course)
      throw new AppException(HttpStatus.NOT_FOUND, 'COURSE_NOT_FOUND');
    const [withUrl] = await this.withCoverUrls([course]);
    return {
      ...withUrl,
      mentors: course.mentors.map((m) => ({
        id: m.mentor.id,
        fullName: m.mentor.fullName,
        email: m.mentor.user.email,
        assignedAt: m.createdAt,
      })),
    };
  }

  async createCourse(input: CreateCourseInput) {
    await this.getTrack(input.trackId);
    const slug = await this.resolveSlug(
      'course',
      input.slug ?? input.title,
      !!input.slug,
    );
    const max = await this.prisma.course.aggregate({
      where: { trackId: input.trackId },
      _max: { position: true },
    });
    const course = await this.prisma.course.create({
      data: {
        ...input,
        slug,
        position: nextPosition(max),
        publishedAt: input.isPublished ? new Date() : null,
      },
    });
    return this.getCourse(course.id);
  }

  async updateCourse(id: string, input: UpdateCourseInput) {
    const course = await this.findCourse(id);
    if (input.slug) await this.assertSlugFree('course', input.slug, id);

    let position: number | undefined;
    if (input.trackId && input.trackId !== course.trackId) {
      await this.getTrack(input.trackId);
      position = nextPosition(
        await this.prisma.course.aggregate({
          where: { trackId: input.trackId },
          _max: { position: true },
        }),
      );
    }
    await this.prisma.course.update({
      where: { id },
      data: {
        ...input,
        position,
        publishedAt:
          input.isPublished && !course.publishedAt ? new Date() : undefined,
      },
    });
    return this.getCourse(id);
  }

  async deleteCourse(id: string) {
    const course = await this.findCourse(id);
    if (course.isPublished) {
      throw new AppException(HttpStatus.CONFLICT, 'UNPUBLISH_BEFORE_DELETE');
    }
    await this.prisma.course.delete({ where: { id } });
  }

  async reorderCourses(trackId: string, ids: string[]) {
    await this.getTrack(trackId);
    await this.prisma.$transaction(async (tx) => {
      const all = await tx.course.findMany({
        where: { trackId },
        select: { id: true },
      });
      await applyOrder(
        tx,
        'courses',
        all.map((c) => c.id),
        ids,
      );
    });
    return this.listCourses({ trackId });
  }

  // --- Mentors ---

  async assignMentor(
    auth: AuthUser,
    courseId: string,
    mentorId: string,
    ip: string | null,
  ) {
    await this.findCourse(courseId);
    const mentor = await this.prisma.profile.findUnique({
      where: { id: mentorId },
    });
    if (!mentor || mentor.role !== Role.mentor) {
      throw new AppException(HttpStatus.BAD_REQUEST, 'NOT_A_MENTOR');
    }
    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.courseMentor.findUnique({
        where: { courseId_mentorId: { courseId, mentorId } },
      });
      if (existing) return;
      await tx.courseMentor.create({
        data: { courseId, mentorId, assignedBy: auth.id },
      });
      await this.audit.log(
        {
          actorId: auth.id,
          action: 'course.mentor_assigned',
          targetType: 'course',
          targetId: courseId,
          metadata: { mentorId },
          ip,
        },
        tx,
      );
    });
    return this.getCourse(courseId);
  }

  async removeMentor(
    auth: AuthUser,
    courseId: string,
    mentorId: string,
    ip: string | null,
  ) {
    await this.findCourse(courseId);
    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.courseMentor.deleteMany({
        where: { courseId, mentorId },
      });
      if (count === 0) return;
      await this.audit.log(
        {
          actorId: auth.id,
          action: 'course.mentor_removed',
          targetType: 'course',
          targetId: courseId,
          metadata: { mentorId },
          ip,
        },
        tx,
      );
    });
    return this.getCourse(courseId);
  }

  // --- Helpers ---

  private async getTrack(id: string) {
    const track = await this.prisma.track.findUnique({ where: { id } });
    if (!track) throw new AppException(HttpStatus.NOT_FOUND, 'TRACK_NOT_FOUND');
    return track;
  }

  private async findCourse(id: string) {
    const course = await this.prisma.course.findUnique({ where: { id } });
    if (!course)
      throw new AppException(HttpStatus.NOT_FOUND, 'COURSE_NOT_FOUND');
    return course;
  }

  private slugTaken(kind: 'track' | 'course', slug: string, exceptId?: string) {
    const where = { slug, ...(exceptId && { NOT: { id: exceptId } }) };
    return kind === 'track'
      ? this.prisma.track.count({ where }).then((n) => n > 0)
      : this.prisma.course.count({ where }).then((n) => n > 0);
  }

  private async assertSlugFree(
    kind: 'track' | 'course',
    slug: string,
    exceptId?: string,
  ) {
    if (await this.slugTaken(kind, slug, exceptId)) {
      throw new AppException(HttpStatus.CONFLICT, 'SLUG_TAKEN');
    }
  }

  /** An explicit slug must be free; one made from the title gets a -2, -3... suffix. */
  private async resolveSlug(
    kind: 'track' | 'course',
    source: string,
    explicit: boolean,
  ) {
    if (explicit) {
      await this.assertSlugFree(kind, source);
      return source;
    }
    return uniqueSlug(source, (s) => this.slugTaken(kind, s));
  }

  private async withCoverUrls<T extends Pick<Course, 'coverImageKey'>>(
    courses: T[],
  ) {
    const urls = await this.r2.getDownloadUrls(
      courses.flatMap((c) => (c.coverImageKey ? [c.coverImageKey] : [])),
    );
    return courses.map((c) => ({
      ...c,
      coverImageUrl: c.coverImageKey ? (urls[c.coverImageKey] ?? null) : null,
    }));
  }
}
