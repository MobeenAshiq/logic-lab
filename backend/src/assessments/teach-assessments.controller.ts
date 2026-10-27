import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import type { Request } from 'express';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser, Roles } from '../auth/decorators';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import {
  assignmentSettingsSchema,
  confirmPlagiarismSchema,
  createQuestionSchema,
  gradeAttemptSchema,
  gradeSubmissionSchema,
  gradingQueueSchema,
  listQuestionsSchema,
  quizQuestionsSchema,
  quizSettingsSchema,
  updateQuestionSchema,
} from './assessments.schemas';
import type {
  AssignmentSettingsInput,
  ConfirmPlagiarismInput,
  CreateQuestionInput,
  GradeAttemptInput,
  GradeSubmissionInput,
  GradingQueueInput,
  ListQuestionsInput,
  QuizQuestionsInput,
  QuizSettingsInput,
  UpdateQuestionInput,
} from './assessments.schemas';
import { AssignmentsService } from './assignments.service';
import { GradingQueueService } from './grading-queue.service';
import { QuestionBankService } from './question-bank.service';
import { QuizzesService } from './quizzes.service';

const uuid = () => new ParseUUIDPipe();

/** Question bank, quiz/assignment builders and grading (course mentors and admins). */
@Roles(Role.mentor, Role.admin, Role.super_admin)
@Controller('teach')
export class TeachAssessmentsController {
  constructor(
    private readonly bank: QuestionBankService,
    private readonly quizzes: QuizzesService,
    private readonly assignments: AssignmentsService,
    private readonly queue: GradingQueueService,
  ) {}

  // --- Question bank ---

  @Get('courses/:courseId/questions')
  listQuestions(
    @CurrentUser() user: AuthUser,
    @Param('courseId', uuid()) courseId: string,
    @Query(new ZodValidationPipe(listQuestionsSchema))
    query: ListQuestionsInput,
  ) {
    return this.bank.list(user, courseId, query);
  }

  @Post('courses/:courseId/questions')
  createQuestion(
    @CurrentUser() user: AuthUser,
    @Param('courseId', uuid()) courseId: string,
    @Body(new ZodValidationPipe(createQuestionSchema))
    body: CreateQuestionInput,
  ) {
    return this.bank.create(user, courseId, body);
  }

  @Patch('questions/:id')
  updateQuestion(
    @CurrentUser() user: AuthUser,
    @Param('id', uuid()) id: string,
    @Body(new ZodValidationPipe(updateQuestionSchema))
    body: UpdateQuestionInput,
  ) {
    return this.bank.update(user, id, body);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete('questions/:id')
  deleteQuestion(
    @CurrentUser() user: AuthUser,
    @Param('id', uuid()) id: string,
  ) {
    return this.bank.remove(user, id);
  }

  // --- Quiz builder ---

  @Get('lessons/:id/quiz')
  quiz(@CurrentUser() user: AuthUser, @Param('id', uuid()) id: string) {
    return this.quizzes.forStaff(user, id);
  }

  @Put('lessons/:id/quiz')
  quizSettings(
    @CurrentUser() user: AuthUser,
    @Param('id', uuid()) id: string,
    @Body(new ZodValidationPipe(quizSettingsSchema)) body: QuizSettingsInput,
  ) {
    return this.quizzes.updateSettings(user, id, body);
  }

  @Put('lessons/:id/quiz/questions')
  quizQuestions(
    @CurrentUser() user: AuthUser,
    @Param('id', uuid()) id: string,
    @Body(new ZodValidationPipe(quizQuestionsSchema)) body: QuizQuestionsInput,
  ) {
    return this.quizzes.setQuestions(user, id, body);
  }

  // --- Assignment builder ---

  @Get('lessons/:id/assignment')
  assignment(@CurrentUser() user: AuthUser, @Param('id', uuid()) id: string) {
    return this.assignments.forStaff(user, id);
  }

  @Put('lessons/:id/assignment')
  assignmentSettings(
    @CurrentUser() user: AuthUser,
    @Param('id', uuid()) id: string,
    @Body(new ZodValidationPipe(assignmentSettingsSchema))
    body: AssignmentSettingsInput,
  ) {
    return this.assignments.update(user, id, body);
  }

  // --- Grading ---

  @Get('grading')
  grading(
    @CurrentUser() user: AuthUser,
    @Query(new ZodValidationPipe(gradingQueueSchema)) query: GradingQueueInput,
  ) {
    return this.queue.list(user, query.status);
  }

  @Get('attempts/:id')
  attempt(@CurrentUser() user: AuthUser, @Param('id', uuid()) id: string) {
    return this.quizzes.forGrader(user, id);
  }

  @HttpCode(HttpStatus.OK)
  @Post('attempts/:id/grade')
  gradeAttempt(
    @CurrentUser() user: AuthUser,
    @Param('id', uuid()) id: string,
    @Body(new ZodValidationPipe(gradeAttemptSchema)) body: GradeAttemptInput,
  ) {
    return this.quizzes.grade(user, id, body);
  }

  @Get('submissions/:id')
  submission(@CurrentUser() user: AuthUser, @Param('id', uuid()) id: string) {
    return this.assignments.forGrader(user, id);
  }

  /** Confirms plagiarism after review (applies the configured point penalty, audited). */
  @HttpCode(HttpStatus.OK)
  @Post('submissions/:id/confirm-plagiarism')
  confirmPlagiarism(
    @CurrentUser() user: AuthUser,
    @Param('id', uuid()) id: string,
    @Body(new ZodValidationPipe(confirmPlagiarismSchema))
    body: ConfirmPlagiarismInput,
    @Req() req: Request,
  ) {
    return this.assignments.confirmPlagiarism(
      user,
      id,
      body.note,
      req.ip ?? null,
    );
  }

  @HttpCode(HttpStatus.OK)
  @Post('submissions/:id/grade')
  gradeSubmission(
    @CurrentUser() user: AuthUser,
    @Param('id', uuid()) id: string,
    @Body(new ZodValidationPipe(gradeSubmissionSchema))
    body: GradeSubmissionInput,
  ) {
    return this.assignments.grade(user, id, body);
  }
}
