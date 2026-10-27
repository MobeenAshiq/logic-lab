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
} from '@nestjs/common';
import { Role } from '@prisma/client';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser, Roles } from '../auth/decorators';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import {
  completeRecordingSchema,
  publishAsLessonSchema,
  recordingUploadSchema,
  scheduleLiveSessionSchema,
  updateLiveSessionSchema,
} from './live-classes.schemas';
import type {
  CompleteRecordingInput,
  PublishAsLessonInput,
  RecordingUploadInput,
  ScheduleLiveSessionInput,
  UpdateLiveSessionInput,
} from './live-classes.schemas';
import { LiveClassesService } from './live-classes.service';

const uuid = () => new ParseUUIDPipe();

@Controller('teach/live-sessions')
@Roles(Role.mentor, Role.admin, Role.super_admin)
export class TeachLiveSessionsController {
  constructor(private readonly liveService: LiveClassesService) {}

  @Post()
  schedule(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(scheduleLiveSessionSchema))
    body: ScheduleLiveSessionInput,
  ) {
    return this.liveService.schedule(user, body);
  }

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.liveService.listForMentor(user);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id', uuid()) id: string) {
    return this.liveService.getForMentor(user, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', uuid()) id: string,
    @Body(new ZodValidationPipe(updateLiveSessionSchema))
    body: UpdateLiveSessionInput,
  ) {
    return this.liveService.update(user, id, body);
  }

  @Delete(':id')
  delete(@CurrentUser() user: AuthUser, @Param('id', uuid()) id: string) {
    return this.liveService.delete(user, id);
  }

  @Post(':id/recording-url')
  recordingUrl(
    @CurrentUser() user: AuthUser,
    @Param('id', uuid()) id: string,
    @Body(new ZodValidationPipe(recordingUploadSchema))
    body: RecordingUploadInput,
  ) {
    return this.liveService.getRecordingUploadUrl(user, id, body);
  }

  @HttpCode(HttpStatus.OK)
  @Post(':id/recording-complete')
  completeRecording(
    @CurrentUser() user: AuthUser,
    @Param('id', uuid()) id: string,
    @Body(new ZodValidationPipe(completeRecordingSchema))
    body: CompleteRecordingInput,
  ) {
    return this.liveService.completeRecording(user, id, body);
  }

  @Post(':id/publish-as-lesson')
  publishLesson(
    @CurrentUser() user: AuthUser,
    @Param('id', uuid()) id: string,
    @Body(new ZodValidationPipe(publishAsLessonSchema))
    body: PublishAsLessonInput,
  ) {
    return this.liveService.publishAsLesson(user, id, body);
  }
}

@Controller('student/live-sessions')
@Roles(Role.student)
export class StudentLiveSessionsController {
  constructor(private readonly liveService: LiveClassesService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.liveService.listForStudent(user);
  }
}

@Controller('live-sessions')
export class LiveSessionsController {
  constructor(private readonly liveService: LiveClassesService) {}

  @Get(':id/room')
  room(@CurrentUser() user: AuthUser, @Param('id', uuid()) id: string) {
    return this.liveService.getRoom(user, id);
  }

  @HttpCode(HttpStatus.OK)
  @Post(':id/join')
  join(@CurrentUser() user: AuthUser, @Param('id', uuid()) id: string) {
    return this.liveService.recordJoin(user, id);
  }

  @HttpCode(HttpStatus.OK)
  @Post(':id/leave')
  leave(@CurrentUser() user: AuthUser, @Param('id', uuid()) id: string) {
    return this.liveService.recordLeave(user, id);
  }
}
