import { ModerationAction, PostKind, ReportReason } from '@prisma/client';
import { z } from 'zod';

const tag = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9][a-z0-9+#.-]{0,29}$/, 'Tags: letters, numbers, + # . -');

const codeLanguage = z.enum([
  'javascript',
  'typescript',
  'python',
  'html',
  'css',
  'sql',
  'java',
  'cpp',
  'c',
  'bash',
  'json',
  'plaintext',
]);

const content = {
  body: z.string().trim().min(10).max(20_000),
  codeSnippet: z.string().max(20_000).nullable().optional(),
  codeLanguage: codeLanguage.nullable().optional(),
};

export const createPostSchema = z.strictObject({
  kind: z.enum(PostKind).default(PostKind.question),
  title: z.string().trim().min(8).max(160),
  ...content,
  tags: z
    .array(tag)
    .max(5)
    .default([])
    .transform((tags) => [...new Set(tags)]),
  trackId: z.uuid().nullable().optional(),
});

export const updatePostSchema = z.strictObject({
  title: z.string().trim().min(8).max(160).optional(),
  body: content.body.optional(),
  codeSnippet: content.codeSnippet,
  codeLanguage: content.codeLanguage,
  tags: z
    .array(tag)
    .max(5)
    .transform((tags) => [...new Set(tags)])
    .optional(),
  trackId: z.uuid().nullable().optional(),
  /** Staff only. */
  isPinned: z.boolean().optional(),
});

export const answerSchema = z.strictObject(content);
export const updateAnswerSchema = z.strictObject({
  body: content.body.optional(),
  codeSnippet: content.codeSnippet,
  codeLanguage: content.codeLanguage,
});

export const feedSchema = z.object({
  track: z.string().max(80).optional(),
  tag: tag.optional(),
  search: z.string().trim().max(100).optional(),
  sort: z.enum(['newest', 'top', 'unanswered']).default('newest'),
  page: z.coerce.number().int().min(1).default(1),
});

const target = {
  targetType: z.enum(['post', 'answer']),
  targetId: z.uuid(),
};

export const voteSchema = z.strictObject({
  ...target,
  /** 0 removes the vote. */
  value: z.union([z.literal(1), z.literal(-1), z.literal(0)]),
});

export const acceptSchema = z.strictObject({ answerId: z.uuid().nullable() });

export const reportSchema = z.strictObject({
  ...target,
  reason: z.enum(ReportReason),
  details: z.string().trim().max(1_000).default(''),
});

export const moderationQueueSchema = z.object({
  status: z.enum(['open', 'closed']).default('open'),
});

export const resolveSchema = z
  .strictObject({
    ...target,
    action: z.enum(ModerationAction),
    note: z.string().trim().max(1_000).default(''),
  })
  .refine((v) => v.action !== ModerationAction.warn || v.note.length >= 3, {
    path: ['note'],
    message: 'Write the warning the user will see.',
  });

export type CreatePostInput = z.infer<typeof createPostSchema>;
export type UpdatePostInput = z.infer<typeof updatePostSchema>;
export type AnswerInput = z.infer<typeof answerSchema>;
export type UpdateAnswerInput = z.infer<typeof updateAnswerSchema>;
export type FeedInput = z.infer<typeof feedSchema>;
export type VoteInput = z.infer<typeof voteSchema>;
export type AcceptInput = z.infer<typeof acceptSchema>;
export type ReportInput = z.infer<typeof reportSchema>;
export type ModerationQueueInput = z.infer<typeof moderationQueueSchema>;
export type ResolveInput = z.infer<typeof resolveSchema>;
