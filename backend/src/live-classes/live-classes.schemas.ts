import { z } from 'zod';

export const scheduleLiveSessionSchema = z.strictObject({
  courseId: z.string().uuid(),
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().max(1000).default(''),
  startsAt: z.iso.datetime(),
  durationMinutes: z.number().int().min(15).max(300).default(60),
});

export const updateLiveSessionSchema = z.strictObject({
  title: z.string().trim().min(3).max(120).optional(),
  description: z.string().trim().max(1000).optional(),
  startsAt: z.iso.datetime().optional(),
  durationMinutes: z.number().int().min(15).max(300).optional(),
});

export const recordingUploadSchema = z.strictObject({
  contentType: z.enum(['video/mp4', 'video/webm']),
  size: z.number().int().min(1).max(2 * 1024 * 1024 * 1024), // up to 2GB
});

export const completeRecordingSchema = z.strictObject({
  key: z.string().min(1),
});

export const publishAsLessonSchema = z.strictObject({
  moduleId: z.string().uuid(),
  title: z.string().trim().min(1).max(120).optional(),
  notes: z.string().max(5000).optional(),
});

export type ScheduleLiveSessionInput = z.infer<typeof scheduleLiveSessionSchema>;
export type UpdateLiveSessionInput = z.infer<typeof updateLiveSessionSchema>;
export type RecordingUploadInput = z.infer<typeof recordingUploadSchema>;
export type CompleteRecordingInput = z.infer<typeof completeRecordingSchema>;
export type PublishAsLessonInput = z.infer<typeof publishAsLessonSchema>;
