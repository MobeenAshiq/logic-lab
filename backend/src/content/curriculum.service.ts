import { HttpStatus, Injectable } from '@nestjs/common';
import { LessonType, Prisma } from '@prisma/client';
import { AppException } from '../common/app-exception';
import { PrismaService } from '../prisma/prisma.service';
import { R2Service } from '../storage/r2.service';
import {
  CreateLessonInput,
  CreateModuleInput,
  UpdateLessonInput,
  UpdateModuleInput,
} from './content.schemas';
import { applyOrder, nextPosition } from './ordering';
import { collectImageKeys, TiptapNode } from './tiptap';

/** undefined = leave unchanged, null = clear. The doc was validated by tiptapDocSchema. */
function contentValue(content: TiptapNode | null | undefined) {
  if (content === undefined) return undefined;
  return content === null
    ? Prisma.DbNull
    : (content as unknown as Prisma.InputJsonObject);
}

/** Admin CMS for modules and lessons inside a course. */
@Injectable()
export class CurriculumService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly r2: R2Service,
  ) {}

  // --- Modules ---

  async createModule(courseId: string, input: CreateModuleInput) {
    await this.findCourse(courseId);
    if (input.unlockAfterModuleId) {
      await this.assertUnlockModule(courseId, null, input.unlockAfterModuleId);
    }
    const max = await this.prisma.module.aggregate({
      where: { courseId },
      _max: { position: true },
    });
    return this.prisma.module.create({
      data: { ...input, courseId, position: nextPosition(max) },
    });
  }

  async updateModule(id: string, input: UpdateModuleInput) {
    const mod = await this.findModule(id);
    if (input.unlockAfterModuleId) {
      await this.assertUnlockModule(
        mod.courseId,
        id,
        input.unlockAfterModuleId,
      );
    }
    return this.prisma.module.update({ where: { id }, data: input });
  }

  async deleteModule(id: string) {
    const mod = await this.findModule(id);
    if (mod.isPublished) {
      throw new AppException(HttpStatus.CONFLICT, 'UNPUBLISH_BEFORE_DELETE');
    }
    await this.prisma.module.delete({ where: { id } });
  }

  async reorderModules(courseId: string, ids: string[]) {
    await this.findCourse(courseId);
    await this.prisma.$transaction(async (tx) => {
      const all = await tx.module.findMany({
        where: { courseId },
        select: { id: true },
      });
      await applyOrder(
        tx,
        'modules',
        all.map((m) => m.id),
        ids,
      );
    });
    return this.prisma.module.findMany({
      where: { courseId },
      orderBy: { position: 'asc' },
    });
  }

  // --- Lessons ---

  /** Full lesson for the editor, with signed URLs for its article images. */
  async getLesson(id: string) {
    const lesson = await this.findLesson(id);
    return {
      ...lesson,
      assetUrls: await this.r2.getDownloadUrls(
        collectImageKeys(lesson.content),
      ),
    };
  }

  async createLesson(moduleId: string, input: CreateLessonInput) {
    await this.findModule(moduleId);
    this.assertContentFitsType(input.type, input.content);
    const max = await this.prisma.lesson.aggregate({
      where: { moduleId },
      _max: { position: true },
    });
    const lesson = await this.prisma.lesson.create({
      data: {
        ...input,
        content: contentValue(input.content ?? null),
        moduleId,
        position: nextPosition(max),
      },
    });
    return this.getLesson(lesson.id);
  }

  async updateLesson(id: string, input: UpdateLessonInput) {
    const lesson = await this.findLesson(id);
    const type = input.type ?? lesson.type;
    const content =
      input.content === undefined ? lesson.content : input.content;
    this.assertContentFitsType(type, content);

    let position: number | undefined;
    if (input.moduleId && input.moduleId !== lesson.moduleId) {
      const [from, to] = await Promise.all([
        this.findModule(lesson.moduleId),
        this.findModule(input.moduleId),
      ]);
      if (from.courseId !== to.courseId) {
        throw new AppException(HttpStatus.NOT_FOUND, 'MODULE_NOT_FOUND');
      }
      position = nextPosition(
        await this.prisma.lesson.aggregate({
          where: { moduleId: input.moduleId },
          _max: { position: true },
        }),
      );
    }

    await this.prisma.lesson.update({
      where: { id },
      data: {
        ...input,
        position,
        content: contentValue(input.content),
      },
    });
    return this.getLesson(id);
  }

  async deleteLesson(id: string) {
    const lesson = await this.findLesson(id);
    if (lesson.isPublished) {
      throw new AppException(HttpStatus.CONFLICT, 'UNPUBLISH_BEFORE_DELETE');
    }
    await this.prisma.lesson.delete({ where: { id } });
  }

  async reorderLessons(moduleId: string, ids: string[]) {
    await this.findModule(moduleId);
    await this.prisma.$transaction(async (tx) => {
      const all = await tx.lesson.findMany({
        where: { moduleId },
        select: { id: true },
      });
      await applyOrder(
        tx,
        'lessons',
        all.map((l) => l.id),
        ids,
      );
    });
    return this.prisma.lesson.findMany({
      where: { moduleId },
      orderBy: { position: 'asc' },
      omit: { content: true },
    });
  }

  // --- Helpers ---

  private assertContentFitsType(type: LessonType, content: unknown) {
    if (content != null && type !== LessonType.article) {
      throw new AppException(HttpStatus.BAD_REQUEST, 'VALIDATION_FAILED', {
        errors: [
          { field: 'content', message: 'Only article lessons have content.' },
        ],
      });
    }
  }

  /** Unlock module: same course, not itself, and following the chain never loops back. */
  private async assertUnlockModule(
    courseId: string,
    moduleId: string | null,
    unlockAfterId: string,
  ) {
    const modules = await this.prisma.module.findMany({
      where: { courseId },
      select: { id: true, unlockAfterModuleId: true },
    });
    const parent = new Map(modules.map((m) => [m.id, m.unlockAfterModuleId]));
    if (!parent.has(unlockAfterId) || unlockAfterId === moduleId) {
      throw new AppException(HttpStatus.BAD_REQUEST, 'INVALID_UNLOCK_MODULE');
    }
    const seen = new Set<string>();
    for (
      let cur: string | null | undefined = unlockAfterId;
      cur;
      cur = parent.get(cur)
    ) {
      if (cur === moduleId || seen.has(cur)) {
        throw new AppException(HttpStatus.BAD_REQUEST, 'INVALID_UNLOCK_MODULE');
      }
      seen.add(cur);
    }
  }

  private async findCourse(id: string) {
    const course = await this.prisma.course.findUnique({ where: { id } });
    if (!course)
      throw new AppException(HttpStatus.NOT_FOUND, 'COURSE_NOT_FOUND');
    return course;
  }

  private async findModule(id: string) {
    const mod = await this.prisma.module.findUnique({ where: { id } });
    if (!mod) throw new AppException(HttpStatus.NOT_FOUND, 'MODULE_NOT_FOUND');
    return mod;
  }

  private async findLesson(id: string) {
    const lesson = await this.prisma.lesson.findUnique({ where: { id } });
    if (!lesson)
      throw new AppException(HttpStatus.NOT_FOUND, 'LESSON_NOT_FOUND');
    return lesson;
  }
}
