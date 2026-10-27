import { CourseLevel, LessonType } from '@prisma/client';
import { z } from 'zod';
import { isUploadKey } from '../storage/uploads';
import { tiptapDocSchema } from './tiptap';

const slugSchema = z
  .string()
  .trim()
  .min(2)
  .max(80)
  .regex(
    /^[a-z0-9]+(-[a-z0-9]+)*$/,
    'Use lowercase letters, numbers and dashes.',
  );

const title = z.string().trim().min(2).max(150);
const text = (max: number) => z.string().trim().max(max);

export const createTrackSchema = z.strictObject({
  title,
  slug: slugSchema.optional(),
  description: text(1000).optional(),
  icon: text(50).nullable().optional(),
  isPublished: z.boolean().optional(),
});
export const updateTrackSchema = createTrackSchema.partial();

const coverImageKey = z
  .string()
  .refine(
    (k) => isUploadKey('course-cover', k),
    'Upload the cover through /admin/uploads.',
  )
  .nullable();

export const createCourseSchema = z.strictObject({
  trackId: z.uuid(),
  title,
  slug: slugSchema.optional(),
  shortDescription: text(300).optional(),
  description: text(10_000).optional(),
  level: z.enum(CourseLevel).optional(),
  coverImageKey: coverImageKey.optional(),
  isPublished: z.boolean().optional(),
});
export const updateCourseSchema = createCourseSchema.partial();

export const listCoursesSchema = z.object({
  trackId: z.uuid().optional(),
});

export const createModuleSchema = z.strictObject({
  title,
  description: text(2000).optional(),
  unlockAfterModuleId: z.uuid().nullable().optional(),
  isPublished: z.boolean().optional(),
});
export const updateModuleSchema = createModuleSchema.partial();

export const createLessonSchema = z.strictObject({
  title,
  type: z.enum(LessonType),
  /** Tiptap JSON; only for article lessons. */
  content: tiptapDocSchema.nullable().optional(),
  durationSeconds: z
    .number()
    .int()
    .min(0)
    .max(24 * 3600)
    .nullable()
    .optional(),
  isPublished: z.boolean().optional(),
});
export const updateLessonSchema = createLessonSchema.partial().extend({
  /** Move the lesson to another module of the same course (added at the end). */
  moduleId: z.uuid().optional(),
});

export const reorderSchema = z.strictObject({
  ids: z
    .array(z.uuid())
    .min(1)
    .max(500)
    .refine((ids) => new Set(ids).size === ids.length, 'Duplicate ids.'),
});

export const assignMentorSchema = z.strictObject({ mentorId: z.uuid() });

export type CreateTrackInput = z.infer<typeof createTrackSchema>;
export type UpdateTrackInput = z.infer<typeof updateTrackSchema>;
export type CreateCourseInput = z.infer<typeof createCourseSchema>;
export type UpdateCourseInput = z.infer<typeof updateCourseSchema>;
export type ListCoursesInput = z.infer<typeof listCoursesSchema>;
export type CreateModuleInput = z.infer<typeof createModuleSchema>;
export type UpdateModuleInput = z.infer<typeof updateModuleSchema>;
export type CreateLessonInput = z.infer<typeof createLessonSchema>;
export type UpdateLessonInput = z.infer<typeof updateLessonSchema>;
export type ReorderInput = z.infer<typeof reorderSchema>;
export type AssignMentorInput = z.infer<typeof assignMentorSchema>;
