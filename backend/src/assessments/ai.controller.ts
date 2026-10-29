import { Body, Controller, Param, ParseUUIDPipe, Post, Get } from '@nestjs/common';
import { Role } from '@prisma/client';
import { z } from 'zod';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser, Roles } from '../auth/decorators';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { AiService } from './ai.service';

const tutorSchema = z.strictObject({
  messages: z.array(z.strictObject({ role: z.enum(['user', 'assistant']), content: z.string().trim().min(1).max(4000) })).min(1).max(12)
    .refine((messages) => messages[messages.length - 1]?.role === 'user', 'The last message must be from the student.'),
});
const codeReviewSchema = z.strictObject({
  code: z.string().trim().min(1).max(12_000),
  language: z.enum(['javascript', 'typescript', 'python', 'java', 'c', 'cpp']).default('javascript'),
});

@Roles(Role.student)
@Controller('learn')
export class LearnAiController {
  constructor(private readonly ai: AiService) {}

  @Get('ai/usage')
  usage(@CurrentUser() user: AuthUser) {
    return this.ai.usage(user);
  }

  @Post('lessons/:id/ai/chat')
  chat(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) lessonId: string,
    @Body(new ZodValidationPipe(tutorSchema)) body: z.infer<typeof tutorSchema>,
  ) {
    return this.ai.tutor(user, lessonId, body.messages);
  }

  @Post('lessons/:id/ai/code-review')
  reviewCode(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) lessonId: string,
    @Body(new ZodValidationPipe(codeReviewSchema)) body: z.infer<typeof codeReviewSchema>,
  ) {
    return this.ai.reviewPracticeCode(user, lessonId, body.code, body.language);
  }
}

@Roles(Role.mentor, Role.admin, Role.super_admin)
@Controller('teach')
export class TeachAiController {
  constructor(private readonly ai: AiService) {}

  @Post('lessons/:id/ai/questions')
  generateQuestions(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) lessonId: string) {
    return this.ai.generateQuestions(user, lessonId);
  }

  @Post('submissions/:id/ai-feedback')
  suggestFeedback(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) submissionId: string) {
    return this.ai.suggestFeedback(user, submissionId);
  }
}
