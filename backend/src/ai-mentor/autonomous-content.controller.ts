import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { z } from 'zod';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser, Roles } from '../auth/decorators';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { SettingsService } from '../settings/settings.service';
import { AutonomousContentService } from './autonomous-content.service';
import {
  generateDaySchema,
  submitAssignmentSchema,
  submitQuizSchema,
  updateArticleSchema,
  type GenerateDayInput,
  type SubmitAssignmentInput,
  type SubmitQuizInput,
  type UpdateArticleInput,
} from './autonomous.schemas';

const listArticlesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  status: z.enum(['draft', 'published']).optional(),
});

const listSubmissionsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  assignmentId: z.string().uuid().optional(),
});

const updateSettingsSchema = z.object({
  enabled: z.boolean().optional(),
  autoPublish: z.boolean().optional(),
  defaultStack: z.string().trim().min(1).max(50).optional(),
  dailyCronHourUtc: z.number().int().min(0).max(23).optional(),
});

// ---------------------------------------------------------------------------
// Admin Autonomous Content Controller
// ---------------------------------------------------------------------------
@Roles(Role.admin, Role.super_admin)
@Controller('admin/autonomous')
export class AdminAutonomousController {
  constructor(
    private readonly service: AutonomousContentService,
    private readonly settings: SettingsService,
  ) {}

  @Get('stats')
  stats() {
    return this.service.getAdminStats();
  }

  @Get('articles')
  articles(@Query(new ZodValidationPipe(listArticlesQuerySchema)) query: any) {
    return this.service.listAdminArticles(query);
  }

  @Get('articles/:id')
  article(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getArticleDetails(id);
  }

  @Post('generate')
  generate(
    @Body(new ZodValidationPipe(generateDaySchema)) body: GenerateDayInput,
  ) {
    return this.service.generateDayContent(body);
  }

  @Patch('articles/:id')
  updateArticle(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateArticleSchema)) body: UpdateArticleInput,
  ) {
    return this.service.updateArticle(id, body);
  }

  @Delete('articles/:id')
  deleteArticle(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.deleteArticle(id);
  }

  @Get('submissions')
  submissions(@Query(new ZodValidationPipe(listSubmissionsQuerySchema)) query: any) {
    return this.service.listAdminSubmissions(query);
  }

  @Get('settings')
  getSettings() {
    return this.settings.get('ai_autonomous_content');
  }

  @Patch('settings')
  async updateSettings(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(updateSettingsSchema)) body: any,
  ) {
    const current = await this.settings.get('ai_autonomous_content');
    const updated = { ...current, ...body };
    return this.settings.update('ai_autonomous_content', updated, user.id, null);
  }
}

// ---------------------------------------------------------------------------
// Student Autonomous Content Controller
// ---------------------------------------------------------------------------
@Roles(Role.student, Role.admin, Role.super_admin)
@Controller('student/autonomous')
export class StudentAutonomousController {
  constructor(private readonly service: AutonomousContentService) {}

  @Get('today')
  today(@CurrentUser() user: AuthUser) {
    return this.service.getStudentToday(user.id);
  }

  @Get('articles')
  articles(@CurrentUser() user: AuthUser) {
    return this.service.listStudentArticles(user.id);
  }

  @Get('articles/day/:dayIndex')
  articleByDay(
    @CurrentUser() user: AuthUser,
    @Param('dayIndex', ParseIntPipe) dayIndex: number,
  ) {
    return this.service.getStudentArticleByDay(dayIndex, user.id);
  }

  @Post('quizzes/:id/submit')
  submitQuiz(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(submitQuizSchema)) body: SubmitQuizInput,
  ) {
    return this.service.submitDailyQuiz(id, body, user.id);
  }

  @Post('assignments/:id/submit')
  submitAssignment(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(submitAssignmentSchema)) body: SubmitAssignmentInput,
  ) {
    return this.service.submitDailyAssignment(id, body, user.id);
  }
}
