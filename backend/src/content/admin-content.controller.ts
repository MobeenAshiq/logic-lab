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
import { CmsService } from './cms.service';
import {
  assignMentorSchema,
  createCourseSchema,
  createLessonSchema,
  createModuleSchema,
  createTrackSchema,
  listCoursesSchema,
  reorderSchema,
  updateCourseSchema,
  updateLessonSchema,
  updateModuleSchema,
  updateTrackSchema,
} from './content.schemas';
import type {
  AssignMentorInput,
  CreateCourseInput,
  CreateLessonInput,
  CreateModuleInput,
  CreateTrackInput,
  ListCoursesInput,
  ReorderInput,
  UpdateCourseInput,
  UpdateLessonInput,
  UpdateModuleInput,
  UpdateTrackInput,
} from './content.schemas';
import { CurriculumService } from './curriculum.service';
import { SiteContentService } from './site-content.service';

const id = () => new ParseUUIDPipe();

/** Admin CMS (/admin/content in the frontend). Publish/unpublish = PATCH {isPublished}. */
@Roles(Role.admin, Role.super_admin)
@Controller('admin/content')
export class AdminContentController {
  constructor(
    private readonly cms: CmsService,
    private readonly curriculum: CurriculumService,
    private readonly siteContent: SiteContentService,
  ) {}

  // --- Tracks ---

  @Get('tracks')
  listTracks() {
    return this.cms.listTracks();
  }

  @Post('tracks')
  createTrack(
    @Body(new ZodValidationPipe(createTrackSchema)) body: CreateTrackInput,
  ) {
    return this.cms.createTrack(body);
  }

  @Put('tracks/order')
  reorderTracks(
    @Body(new ZodValidationPipe(reorderSchema)) body: ReorderInput,
  ) {
    return this.cms.reorderTracks(body.ids);
  }

  @Patch('tracks/:id')
  updateTrack(
    @Param('id', id()) trackId: string,
    @Body(new ZodValidationPipe(updateTrackSchema)) body: UpdateTrackInput,
  ) {
    return this.cms.updateTrack(trackId, body);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete('tracks/:id')
  deleteTrack(@Param('id', id()) trackId: string) {
    return this.cms.deleteTrack(trackId);
  }

  @Put('tracks/:id/courses/order')
  reorderCourses(
    @Param('id', id()) trackId: string,
    @Body(new ZodValidationPipe(reorderSchema)) body: ReorderInput,
  ) {
    return this.cms.reorderCourses(trackId, body.ids);
  }

  // --- Courses ---

  @Get('courses')
  listCourses(
    @Query(new ZodValidationPipe(listCoursesSchema)) query: ListCoursesInput,
  ) {
    return this.cms.listCourses(query);
  }

  @Post('courses')
  createCourse(
    @Body(new ZodValidationPipe(createCourseSchema)) body: CreateCourseInput,
  ) {
    return this.cms.createCourse(body);
  }

  @Get('courses/:id')
  getCourse(@Param('id', id()) courseId: string) {
    return this.cms.getCourse(courseId);
  }

  @Patch('courses/:id')
  updateCourse(
    @Param('id', id()) courseId: string,
    @Body(new ZodValidationPipe(updateCourseSchema)) body: UpdateCourseInput,
  ) {
    return this.cms.updateCourse(courseId, body);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete('courses/:id')
  deleteCourse(@Param('id', id()) courseId: string) {
    return this.cms.deleteCourse(courseId);
  }

  @Post('courses/:id/mentors')
  assignMentor(
    @CurrentUser() user: AuthUser,
    @Param('id', id()) courseId: string,
    @Body(new ZodValidationPipe(assignMentorSchema)) body: AssignMentorInput,
    @Req() req: Request,
  ) {
    return this.cms.assignMentor(user, courseId, body.mentorId, req.ip ?? null);
  }

  @Delete('courses/:id/mentors/:mentorId')
  removeMentor(
    @CurrentUser() user: AuthUser,
    @Param('id', id()) courseId: string,
    @Param('mentorId', id()) mentorId: string,
    @Req() req: Request,
  ) {
    return this.cms.removeMentor(user, courseId, mentorId, req.ip ?? null);
  }

  // --- Modules ---

  @Post('courses/:id/modules')
  createModule(
    @Param('id', id()) courseId: string,
    @Body(new ZodValidationPipe(createModuleSchema)) body: CreateModuleInput,
  ) {
    return this.curriculum.createModule(courseId, body);
  }

  @Put('courses/:id/modules/order')
  reorderModules(
    @Param('id', id()) courseId: string,
    @Body(new ZodValidationPipe(reorderSchema)) body: ReorderInput,
  ) {
    return this.curriculum.reorderModules(courseId, body.ids);
  }

  @Patch('modules/:id')
  updateModule(
    @Param('id', id()) moduleId: string,
    @Body(new ZodValidationPipe(updateModuleSchema)) body: UpdateModuleInput,
  ) {
    return this.curriculum.updateModule(moduleId, body);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete('modules/:id')
  deleteModule(@Param('id', id()) moduleId: string) {
    return this.curriculum.deleteModule(moduleId);
  }

  // --- Lessons ---

  @Post('modules/:id/lessons')
  createLesson(
    @Param('id', id()) moduleId: string,
    @Body(new ZodValidationPipe(createLessonSchema)) body: CreateLessonInput,
  ) {
    return this.curriculum.createLesson(moduleId, body);
  }

  @Put('modules/:id/lessons/order')
  reorderLessons(
    @Param('id', id()) moduleId: string,
    @Body(new ZodValidationPipe(reorderSchema)) body: ReorderInput,
  ) {
    return this.curriculum.reorderLessons(moduleId, body.ids);
  }

  @Get('lessons/:id')
  getLesson(@Param('id', id()) lessonId: string) {
    return this.curriculum.getLesson(lessonId);
  }

  @Patch('lessons/:id')
  updateLesson(
    @Param('id', id()) lessonId: string,
    @Body(new ZodValidationPipe(updateLessonSchema)) body: UpdateLessonInput,
  ) {
    return this.curriculum.updateLesson(lessonId, body);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete('lessons/:id')
  deleteLesson(@Param('id', id()) lessonId: string) {
    return this.curriculum.deleteLesson(lessonId);
  }

  // --- Landing page blocks (hero, faq, testimonials, banners) ---

  @Get('site')
  getSiteContent() {
    return this.siteContent.getAll();
  }

  @Put('site/:key')
  updateSiteContent(
    @CurrentUser() user: AuthUser,
    @Param('key') key: string,
    @Body() body: unknown,
  ) {
    return this.siteContent.update(key, body, user.id);
  }
}
