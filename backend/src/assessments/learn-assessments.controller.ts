import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser, Roles } from '../auth/decorators';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import {
  attemptTypingSchema,
  draftSchema,
  saveAnswerSchema,
  typingSchema,
} from './assessments.schemas';
import type {
  AttemptTypingInput,
  DraftInput,
  SaveAnswerInput,
  TypingInput,
} from './assessments.schemas';
import { AssignmentsService } from './assignments.service';
import { QuizzesService } from './quizzes.service';

const uuid = () => new ParseUUIDPipe();

/**
 * Student side of quizzes and assignments. Attempts and submissions are
 * always the caller's own; deadlines are enforced by the server.
 */
@Controller('learn')
export class LearnAssessmentsController {
  constructor(
    private readonly quizzes: QuizzesService,
    private readonly assignments: AssignmentsService,
  ) {}

  // --- Quizzes ---

  @Get('lessons/:id/quiz')
  quiz(@CurrentUser() user: AuthUser, @Param('id', uuid()) id: string) {
    return this.quizzes.info(user, id);
  }

  @Roles(Role.student)
  @Post('lessons/:id/quiz/attempts')
  start(@CurrentUser() user: AuthUser, @Param('id', uuid()) id: string) {
    return this.quizzes.start(user, id);
  }

  @Roles(Role.student)
  @Get('attempts/:id')
  attempt(@CurrentUser() user: AuthUser, @Param('id', uuid()) id: string) {
    return this.quizzes.attempt(user, id);
  }

  @Roles(Role.student)
  @Put('attempts/:id/answers/:questionId')
  answer(
    @CurrentUser() user: AuthUser,
    @Param('id', uuid()) id: string,
    @Param('questionId', uuid()) questionId: string,
    @Body(new ZodValidationPipe(saveAnswerSchema)) body: SaveAnswerInput,
  ) {
    return this.quizzes.saveAnswer(user, id, questionId, body);
  }

  @Roles(Role.student)
  @HttpCode(HttpStatus.OK)
  @Post('attempts/:id/typing')
  attemptTyping(
    @CurrentUser() user: AuthUser,
    @Param('id', uuid()) id: string,
    @Body(new ZodValidationPipe(attemptTypingSchema)) body: AttemptTypingInput,
  ) {
    return this.quizzes.appendTyping(user, id, body);
  }

  @Roles(Role.student)
  @HttpCode(HttpStatus.OK)
  @Post('attempts/:id/tab-switch')
  tabSwitch(@CurrentUser() user: AuthUser, @Param('id', uuid()) id: string) {
    return this.quizzes.tabSwitch(user, id);
  }

  @Roles(Role.student)
  @HttpCode(HttpStatus.OK)
  @Post('attempts/:id/submit')
  submit(@CurrentUser() user: AuthUser, @Param('id', uuid()) id: string) {
    return this.quizzes.submit(user, id);
  }

  // --- Assignments ---

  @Get('lessons/:id/assignment')
  assignment(@CurrentUser() user: AuthUser, @Param('id', uuid()) id: string) {
    return this.assignments.info(user, id);
  }

  @Roles(Role.student)
  @Put('lessons/:id/assignment/draft')
  draft(
    @CurrentUser() user: AuthUser,
    @Param('id', uuid()) id: string,
    @Body(new ZodValidationPipe(draftSchema)) body: DraftInput,
  ) {
    return this.assignments.saveDraft(user, id, body.content);
  }

  @Roles(Role.student)
  @HttpCode(HttpStatus.OK)
  @Post('lessons/:id/assignment/typing')
  assignmentTyping(
    @CurrentUser() user: AuthUser,
    @Param('id', uuid()) id: string,
    @Body(new ZodValidationPipe(typingSchema)) body: TypingInput,
  ) {
    return this.assignments.appendTyping(user, id, body.events);
  }

  @Roles(Role.student)
  @HttpCode(HttpStatus.OK)
  @Post('lessons/:id/assignment/submit')
  submitAssignment(
    @CurrentUser() user: AuthUser,
    @Param('id', uuid()) id: string,
    @Body(new ZodValidationPipe(draftSchema)) body: DraftInput,
  ) {
    return this.assignments.submit(user, id, body.content);
  }
}
