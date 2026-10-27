import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser, Roles } from '../auth/decorators';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import {
  answerSchema,
  askQuestionSchema,
  progressPingSchema,
} from './learning.schemas';
import type {
  AnswerInput,
  AskQuestionInput,
  ProgressPingInput,
} from './learning.schemas';
import { LearnService } from './learn.service';
import { ProgressService } from './progress.service';
import { QuestionsService } from './questions.service';

/**
 * Learner endpoints for any logged-in role. Students without access get
 * 403 SUBSCRIPTION_REQUIRED (with `paywallUrl`) or 403 MODULE_LOCKED.
 */
@Controller()
export class LearnController {
  constructor(
    private readonly learn: LearnService,
    private readonly progress: ProgressService,
    private readonly questions: QuestionsService,
  ) {}

  @Get('learn/lessons/:id')
  lesson(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.learn.lesson(user, id);
  }

  @Get('learn/lessons/:id/video-url')
  videoUrl(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.learn.videoUrl(user, id);
  }

  @HttpCode(HttpStatus.OK)
  @Post('learn/lessons/:id/progress')
  ping(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(progressPingSchema)) body: ProgressPingInput,
  ) {
    return this.learn.ping(user, id, body);
  }

  @HttpCode(HttpStatus.OK)
  @Post('learn/lessons/:id/complete')
  complete(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.learn.complete(user, id);
  }

  @Get('learn/attachments/:id')
  attachment(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.learn.attachmentUrl(user, id);
  }

  @Get('learn/courses/:slug')
  outline(@CurrentUser() user: AuthUser, @Param('slug') slug: string) {
    return this.learn.outline(user, slug);
  }

  // --- Q&A ---

  @Get('learn/lessons/:id/questions')
  listQuestions(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.questions.list(user, id);
  }

  @Post('learn/lessons/:id/questions')
  ask(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(askQuestionSchema)) body: AskQuestionInput,
  ) {
    return this.questions.ask(user, id, body);
  }

  @Post('learn/questions/:id/answers')
  answer(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(answerSchema)) body: AnswerInput,
  ) {
    return this.questions.answer(user, id, body);
  }

  // --- Student dashboard ---

  @Roles(Role.student)
  @Get('student/learning')
  dashboard(@CurrentUser() user: AuthUser) {
    return this.progress.dashboard(user.id);
  }
}
