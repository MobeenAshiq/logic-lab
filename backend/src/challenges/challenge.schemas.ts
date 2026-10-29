import { ChallengeDifficulty } from '@prisma/client';
import { z } from 'zod';

const testCaseSchema = z.strictObject({
  input: z.array(z.unknown()).max(100).default([]),
  expected: z.unknown(),
});

export const createChallengeSchema = z.strictObject({
  trackId: z.uuid(),
  title: z.string().trim().min(3).max(160),
  difficulty: z.enum(ChallengeDifficulty).default(ChallengeDifficulty.easy),
  statement: z.string().trim().min(10).max(12_000),
  starterCode: z.string().max(20_000).default(''),
  tests: z.array(testCaseSchema).min(1).max(30),
  hiddenTests: z.array(testCaseSchema).min(1).max(50),
  publishDate: z.iso.date(),
});

export const submitChallengeSchema = z.strictObject({
  code: z.string().max(30_000),
  language: z.enum(['javascript', 'python']),
});

export type CreateChallengeInput = z.infer<typeof createChallengeSchema>;
export type SubmitChallengeInput = z.infer<typeof submitChallengeSchema>;
