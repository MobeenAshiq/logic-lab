import { z } from 'zod';

const MAX_SECONDS = 24 * 3600;

/** Sent by the lesson page every ~15 s while the student is active, and on pause/leave. */
export const progressPingSchema = z.strictObject({
  /** Current video position (resume point). 0 for articles. */
  positionSeconds: z.number().min(0).max(MAX_SECONDS),
  /** Seconds actually watched/read since the last ping. Capped by the server. */
  watchedDelta: z.number().min(0).max(600),
});

export const askQuestionSchema = z.strictObject({
  body: z.string().trim().min(3).max(2000),
  timestampSeconds: z
    .number()
    .int()
    .min(0)
    .max(MAX_SECONDS)
    .nullable()
    .optional(),
});

export const answerSchema = z.strictObject({
  body: z.string().trim().min(1).max(4000),
});

export const updateLessonMediaSchema = z.strictObject({
  notes: z.string().max(20_000).optional(),
  durationSeconds: z
    .number()
    .int()
    .min(0)
    .max(MAX_SECONDS)
    .nullable()
    .optional(),
});

export const videoPartsSchema = z.strictObject({
  key: z.string().max(200),
  uploadId: z.string().min(1).max(1000),
  partNumbers: z.array(z.number().int().min(1).max(10_000)).min(1).max(50),
});

export const completeVideoSchema = z.strictObject({
  key: z.string().max(200),
  uploadId: z.string().min(1).max(1000),
  parts: z
    .array(
      z.strictObject({
        partNumber: z.number().int().min(1).max(10_000),
        etag: z.string().min(1).max(200),
      }),
    )
    .min(1)
    .max(10_000),
  /** Read from the file in the browser (video metadata). */
  durationSeconds: z.number().int().min(1).max(MAX_SECONDS),
});

export const abortVideoSchema = z.strictObject({
  key: z.string().max(200),
  uploadId: z.string().min(1).max(1000),
});

export const saveAttachmentSchema = z.strictObject({
  key: z.string().max(200),
  filename: z.string().trim().min(1).max(200),
});

export const listQuestionsSchema = z.object({
  status: z.enum(['unanswered', 'all']).default('unanswered'),
});

export type ProgressPingInput = z.infer<typeof progressPingSchema>;
export type AskQuestionInput = z.infer<typeof askQuestionSchema>;
export type AnswerInput = z.infer<typeof answerSchema>;
export type UpdateLessonMediaInput = z.infer<typeof updateLessonMediaSchema>;
export type VideoPartsInput = z.infer<typeof videoPartsSchema>;
export type CompleteVideoInput = z.infer<typeof completeVideoSchema>;
export type AbortVideoInput = z.infer<typeof abortVideoSchema>;
export type SaveAttachmentInput = z.infer<typeof saveAttachmentSchema>;
export type ListQuestionsInput = z.infer<typeof listQuestionsSchema>;
