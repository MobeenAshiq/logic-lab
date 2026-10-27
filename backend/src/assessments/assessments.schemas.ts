import { Difficulty, QuestionType } from '@prisma/client';
import { z } from 'zod';
import { typingBatchSchema } from './integrity';

const id = z.string().min(1).max(40);

const questionFields = {
  type: z.enum(QuestionType),
  difficulty: z.enum(Difficulty).optional(),
  tags: z.array(z.string().trim().min(1).max(30)).max(10).optional(),
  prompt: z.string().trim().min(3).max(5_000),
  options: z
    .array(z.strictObject({ id, text: z.string().trim().min(1).max(500) }))
    .max(8)
    .optional(),
  correctOptionIds: z.array(id).max(8).optional(),
  allowMultiple: z.boolean().optional(),
  explanation: z.string().max(5_000).optional(),
  sampleAnswer: z.string().max(20_000).optional(),
  codeLanguage: z.enum(['javascript', 'python']).nullable().optional(),
  points: z.number().int().min(1).max(100).optional(),
};

/** MCQs need 2+ options and valid correct answers (exactly one unless multi-select). */
function checkMcq(
  q: {
    type?: QuestionType;
    options?: { id: string }[];
    correctOptionIds?: string[];
    allowMultiple?: boolean;
  },
  ctx: z.RefinementCtx,
) {
  if (q.type !== QuestionType.mcq) return;
  const options = q.options ?? [];
  const correct = q.correctOptionIds ?? [];
  const ids = new Set(options.map((o) => o.id));
  if (options.length < 2) {
    ctx.addIssue({
      code: 'custom',
      path: ['options'],
      message: 'Add at least 2 options.',
    });
  }
  if (ids.size !== options.length) {
    ctx.addIssue({
      code: 'custom',
      path: ['options'],
      message: 'Option ids must be unique.',
    });
  }
  if (correct.length === 0 || correct.some((c) => !ids.has(c))) {
    ctx.addIssue({
      code: 'custom',
      path: ['correctOptionIds'],
      message: 'Mark the correct option.',
    });
  }
  if (!q.allowMultiple && correct.length > 1) {
    ctx.addIssue({
      code: 'custom',
      path: ['correctOptionIds'],
      message: 'Only one correct option unless multiple answers are allowed.',
    });
  }
}

export const createQuestionSchema = z
  .strictObject(questionFields)
  .superRefine(checkMcq);
/** Partial update; the service re-validates the merged question. */
export const updateQuestionSchema = z.strictObject(questionFields).partial();
export const mergedQuestionSchema = z
  .object(questionFields)
  .superRefine(checkMcq);

export const listQuestionsSchema = z.object({
  type: z.enum(QuestionType).optional(),
  difficulty: z.enum(Difficulty).optional(),
  tag: z.string().max(30).optional(),
  search: z.string().trim().max(100).optional(),
});

export const quizSettingsSchema = z
  .strictObject({
    timeLimitMinutes: z.number().int().min(1).max(600),
    startsAt: z.iso.datetime().nullable(),
    endsAt: z.iso.datetime().nullable(),
    passMark: z.number().int().min(0).max(100),
    maxAttempts: z.number().int().min(1).max(20),
  })
  .refine((v) => !v.startsAt || !v.endsAt || v.startsAt < v.endsAt, {
    path: ['endsAt'],
    message: 'The end must be after the start.',
  });

export const quizQuestionsSchema = z.strictObject({
  questionIds: z
    .array(z.uuid())
    .max(200)
    .refine((ids) => new Set(ids).size === ids.length, 'Duplicate questions.'),
});

export const rubricCriterionSchema = z.strictObject({
  id,
  title: z.string().trim().min(1).max(120),
  description: z.string().max(1_000).default(''),
  maxPoints: z.number().int().min(1).max(1_000),
});

export const assignmentSettingsSchema = z
  .strictObject({
    instructions: z.string().max(20_000),
    dueAt: z.iso.datetime().nullable(),
    maxMarks: z.number().int().min(1).max(1_000),
    rubric: z.array(rubricCriterionSchema).max(20),
  })
  .refine(
    (v) =>
      v.rubric.length === 0 ||
      v.rubric.reduce((s, c) => s + c.maxPoints, 0) === v.maxMarks,
    {
      path: ['rubric'],
      message: 'Rubric points must add up to the maximum marks.',
    },
  );

export const saveAnswerSchema = z.strictObject({
  optionIds: z.array(id).max(8).optional(),
  text: z.string().max(20_000).optional(),
});

export const attemptTypingSchema = z.strictObject({
  questionId: z.uuid(),
  events: typingBatchSchema,
});

export const typingSchema = z.strictObject({ events: typingBatchSchema });

export const draftSchema = z.strictObject({ content: z.string().max(50_000) });

export const gradeSubmissionSchema = z.strictObject({
  rubricScores: z
    .record(z.string(), z.number().int().min(0).max(1_000))
    .default({}),
  /** Used when the assignment has no rubric. */
  grade: z.number().int().min(0).max(1_000).optional(),
  feedback: z.string().max(10_000).default(''),
});

export const gradeAttemptSchema = z.strictObject({
  questionScores: z.record(z.uuid(), z.number().int().min(0).max(100)),
  feedback: z.string().max(10_000).default(''),
});

export const confirmPlagiarismSchema = z.strictObject({
  note: z.string().trim().min(3).max(1_000),
});

export const gradingQueueSchema = z.object({
  status: z.enum(['pending', 'graded']).default('pending'),
});

export type CreateQuestionInput = z.infer<typeof createQuestionSchema>;
export type UpdateQuestionInput = z.infer<typeof updateQuestionSchema>;
export type ListQuestionsInput = z.infer<typeof listQuestionsSchema>;
export type QuizSettingsInput = z.infer<typeof quizSettingsSchema>;
export type QuizQuestionsInput = z.infer<typeof quizQuestionsSchema>;
export type AssignmentSettingsInput = z.infer<typeof assignmentSettingsSchema>;
export type RubricCriterion = z.infer<typeof rubricCriterionSchema>;
export type SaveAnswerInput = z.infer<typeof saveAnswerSchema>;
export type AttemptTypingInput = z.infer<typeof attemptTypingSchema>;
export type TypingInput = z.infer<typeof typingSchema>;
export type DraftInput = z.infer<typeof draftSchema>;
export type GradeSubmissionInput = z.infer<typeof gradeSubmissionSchema>;
export type GradeAttemptInput = z.infer<typeof gradeAttemptSchema>;
export type ConfirmPlagiarismInput = z.infer<typeof confirmPlagiarismSchema>;
export type GradingQueueInput = z.infer<typeof gradingQueueSchema>;
