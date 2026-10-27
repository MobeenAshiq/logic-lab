import { HttpStatus, Injectable } from '@nestjs/common';
import { CourseLevel } from '@prisma/client';
import { AppException } from '../common/app-exception';
import { PrismaService } from '../prisma/prisma.service';
import { R2Service } from '../storage/r2.service';

/** Public course catalog: only published tracks, courses, modules and lessons; no lesson bodies. */
@Injectable()
export class CatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly r2: R2Service,
  ) {}

  tracks() {
    return this.prisma.track.findMany({
      where: { isPublished: true },
      orderBy: { position: 'asc' },
      select: {
        id: true,
        slug: true,
        title: true,
        description: true,
        icon: true,
        _count: { select: { courses: { where: { isPublished: true } } } },
      },
    });
  }

  async courses(filter: { track?: string; level?: CourseLevel }) {
    const courses = await this.prisma.course.findMany({
      where: {
        isPublished: true,
        level: filter.level,
        track: { isPublished: true, slug: filter.track },
      },
      orderBy: [{ track: { position: 'asc' } }, { position: 'asc' }],
      select: {
        id: true,
        slug: true,
        title: true,
        shortDescription: true,
        level: true,
        coverImageKey: true,
        track: { select: { slug: true, title: true } },
      },
    });
    const urls = await this.r2.getDownloadUrls(
      courses.flatMap((c) => (c.coverImageKey ? [c.coverImageKey] : [])),
    );
    return courses.map(({ coverImageKey, ...c }) => ({
      ...c,
      coverImageUrl: coverImageKey ? (urls[coverImageKey] ?? null) : null,
    }));
  }

  async course(slug: string) {
    const course = await this.prisma.course.findFirst({
      where: { slug, isPublished: true, track: { isPublished: true } },
      select: {
        id: true,
        slug: true,
        title: true,
        shortDescription: true,
        description: true,
        level: true,
        coverImageKey: true,
        track: { select: { slug: true, title: true } },
        mentors: {
          select: { mentor: { select: { fullName: true, avatarUrl: true } } },
        },
        modules: {
          where: { isPublished: true },
          orderBy: { position: 'asc' },
          select: {
            id: true,
            title: true,
            description: true,
            position: true,
            lessons: {
              where: { isPublished: true },
              orderBy: { position: 'asc' },
              // Titles only: lesson content stays locked.
              select: {
                id: true,
                title: true,
                type: true,
                position: true,
                durationSeconds: true,
              },
            },
          },
        },
      },
    });
    if (!course) {
      throw new AppException(HttpStatus.NOT_FOUND, 'COURSE_NOT_FOUND');
    }
    const { coverImageKey, mentors, ...rest } = course;
    const urls = await this.r2.getDownloadUrls(
      coverImageKey ? [coverImageKey] : [],
    );
    return {
      ...rest,
      coverImageUrl: coverImageKey ? (urls[coverImageKey] ?? null) : null,
      mentors: mentors.map((m) => m.mentor),
    };
  }
}
