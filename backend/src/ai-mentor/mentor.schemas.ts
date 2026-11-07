import { z } from 'zod';
import { AI_PROVIDERS } from '../lib/ai';

export const STACK_TYPES = [
  'general',
  'nodejs',
  'python',
  'php',
  'nextjs',
  'cpp',
] as const;

export const createSessionSchema = z.strictObject({
  courseId: z.uuid().nullable().optional(),
  moduleId: z.uuid().nullable().optional(),
  stackType: z.enum(STACK_TYPES).default('general'),
});
export type CreateSessionInput = z.infer<typeof createSessionSchema>;

export const updateSessionSchema = z.strictObject({
  courseId: z.uuid().nullable().optional(),
  moduleId: z.uuid().nullable().optional(),
  stackType: z.enum(STACK_TYPES).optional(),
  title: z.string().trim().min(1).max(80).optional(),
});
export type UpdateSessionInput = z.infer<typeof updateSessionSchema>;

export const sendMessageSchema = z.strictObject({
  content: z.string().trim().min(1).max(4000),
});

// --- Admin ---

export const overviewSchema = z.object({
  days: z.coerce.number().int().min(1).max(90).default(14),
});

export const adminSessionsSchema = z.object({
  search: z.string().trim().max(100).optional(),
  flagged: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
export type AdminSessionsInput = z.infer<typeof adminSessionsSchema>;

export const adminFlagsSchema = z.object({
  status: z.enum(['open', 'reviewed', 'all']).default('open'),
  category: z
    .enum(['prompt_injection', 'harmful', 'off_topic', 'blocked_phrase'])
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
export type AdminFlagsInput = z.infer<typeof adminFlagsSchema>;

export const providerParam = z.enum(AI_PROVIDERS);

export const setKeySchema = z.strictObject({
  apiKey: z
    .string()
    .trim()
    .min(10)
    .max(400)
    .regex(/^\S+$/, 'API keys contain no spaces.')
    .nullable(),
});
