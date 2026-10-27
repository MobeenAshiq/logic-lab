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
  Query,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser, Roles } from '../auth/decorators';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { attachmentUploadSchema, videoUploadSchema } from '../storage/uploads';
import type {
  AttachmentUploadInput,
  VideoUploadInput,
} from '../storage/uploads';
import {
  abortVideoSchema,
  completeVideoSchema,
  listQuestionsSchema,
  saveAttachmentSchema,
  updateLessonMediaSchema,
  videoPartsSchema,
} from './learning.schemas';
import type {
  AbortVideoInput,
  CompleteVideoInput,
  ListQuestionsInput,
  SaveAttachmentInput,
  UpdateLessonMediaInput,
  VideoPartsInput,
} from './learning.schemas';
import { QuestionsService } from './questions.service';
import { TeachingService } from './teaching.service';

/**
 * Teaching tools (mentor portal; admins can use them too). Mentors can only
 * touch lessons of courses they are assigned to; the service checks this.
 */
@Roles(Role.mentor, Role.admin, Role.super_admin)
@Controller('teach')
export class TeachController {
  constructor(
    private readonly teaching: TeachingService,
    private readonly questions: QuestionsService,
  ) {}

  @Get('courses')
  courses(@CurrentUser() user: AuthUser) {
    return this.teaching.courses(user);
  }

  @Get('questions')
  inbox(
    @CurrentUser() user: AuthUser,
    @Query(new ZodValidationPipe(listQuestionsSchema))
    query: ListQuestionsInput,
  ) {
    return this.questions.inbox(user, query.status);
  }

  @Get('lessons/:id')
  lesson(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.teaching.lesson(user, id);
  }

  @Patch('lessons/:id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateLessonMediaSchema))
    body: UpdateLessonMediaInput,
  ) {
    return this.teaching.updateLesson(user, id, body);
  }

  // --- Video: start → part URLs (repeat) → complete (or abort) ---

  @Post('lessons/:id/video/start')
  startVideo(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(videoUploadSchema)) body: VideoUploadInput,
  ) {
    return this.teaching.startVideo(user, id, body);
  }

  @HttpCode(HttpStatus.OK)
  @Post('lessons/:id/video/parts')
  videoParts(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(videoPartsSchema)) body: VideoPartsInput,
  ) {
    return this.teaching.videoPartUrls(user, id, body);
  }

  @HttpCode(HttpStatus.OK)
  @Post('lessons/:id/video/complete')
  completeVideo(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(completeVideoSchema)) body: CompleteVideoInput,
  ) {
    return this.teaching.completeVideo(user, id, body);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('lessons/:id/video/abort')
  abortVideo(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(abortVideoSchema)) body: AbortVideoInput,
  ) {
    return this.teaching.abortVideo(user, id, body);
  }

  @Delete('lessons/:id/video')
  deleteVideo(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.teaching.deleteVideo(user, id);
  }

  // --- Attachments: upload-url → PUT to R2 → save ---

  @Post('lessons/:id/attachments/upload-url')
  attachmentUploadUrl(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(attachmentUploadSchema))
    body: AttachmentUploadInput,
  ) {
    return this.teaching.attachmentUploadUrl(user, id, body);
  }

  @Post('lessons/:id/attachments')
  saveAttachment(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(saveAttachmentSchema))
    body: SaveAttachmentInput,
  ) {
    return this.teaching.saveAttachment(user, id, body);
  }

  @Delete('lessons/:id/attachments/:attachmentId')
  deleteAttachment(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('attachmentId', ParseUUIDPipe) attachmentId: string,
  ) {
    return this.teaching.deleteAttachment(user, id, attachmentId);
  }
}
