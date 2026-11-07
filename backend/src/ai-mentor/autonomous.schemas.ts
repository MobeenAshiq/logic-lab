import { z } from 'zod';

export const generateDaySchema = z.object({
  dayIndex: z.number().int().min(1).max(365).optional(),
  targetStack: z.string().trim().min(1).max(50).optional(),
  customTopic: z.string().trim().min(3).max(200).optional(),
  autoPublish: z.boolean().optional(),
});

export type GenerateDayInput = z.infer<typeof generateDaySchema>;

export const updateArticleSchema = z.object({
  title: z.string().trim().min(3).max(200).optional(),
  markdownContent: z.string().min(10).optional(),
  status: z.enum(['draft', 'published']).optional(),
  publishedDate: z.string().datetime().optional(),
  quiz: z
    .object({
      questionsJson: z.array(
        z.object({
          question: z.string().min(5),
          options: z.array(z.string()).min(2).max(6),
          correctIndex: z.number().int().min(0),
          explanation: z.string().optional(),
        }),
      ),
    })
    .optional(),
  assignment: z
    .object({
      promptInstructions: z.string().min(10),
      starterCode: z.string().optional(),
      testCases: z
        .array(
          z.object({
            input: z.unknown().optional(),
            expected: z.unknown().optional(),
            description: z.string().optional(),
          }),
        )
        .optional(),
    })
    .optional(),
});

export type UpdateArticleInput = z.infer<typeof updateArticleSchema>;

export const submitQuizSchema = z.object({
  /** Map of question index -> selected option index */
  answers: z.record(z.coerce.number(), z.number().int().min(0)),
});

export type SubmitQuizInput = z.infer<typeof submitQuizSchema>;

export const submitAssignmentSchema = z.object({
  code: z.string().min(1, 'Please provide code before submitting.'),
});

export type SubmitAssignmentInput = z.infer<typeof submitAssignmentSchema>;
