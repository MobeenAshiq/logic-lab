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
import { communityImageSchema } from '../storage/uploads';
import type { CommunityImageInput } from '../storage/uploads';
import {
  acceptSchema,
  answerSchema,
  createPostSchema,
  feedSchema,
  moderationQueueSchema,
  reportSchema,
  resolveSchema,
  updateAnswerSchema,
  updatePostSchema,
  voteSchema,
} from './community.schemas';
import type {
  AcceptInput,
  AnswerInput,
  CreatePostInput,
  FeedInput,
  ModerationQueueInput,
  ReportInput,
  ResolveInput,
  UpdateAnswerInput,
  UpdatePostInput,
  VoteInput,
} from './community.schemas';
import { CommunityService } from './community.service';
import { ModerationService } from './moderation.service';

const uuid = () => new ParseUUIDPipe();

/** Community Q&A for every logged-in user. */
@Controller('community')
export class CommunityController {
  constructor(private readonly community: CommunityService) {}

  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.community.me(user);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('me/warnings/acknowledge')
  acknowledge(@CurrentUser() user: AuthUser) {
    return this.community.acknowledgeWarnings(user);
  }

  @Post('uploads')
  upload(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(communityImageSchema))
    body: CommunityImageInput,
  ) {
    return this.community.imageUploadUrl(user, body);
  }

  @Get('posts')
  feed(
    @CurrentUser() user: AuthUser,
    @Query(new ZodValidationPipe(feedSchema)) query: FeedInput,
  ) {
    return this.community.feed(user, query);
  }

  @Get('tags')
  tags() {
    return this.community.tags();
  }

  @Post('posts')
  create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createPostSchema)) body: CreatePostInput,
  ) {
    return this.community.createPost(user, body);
  }

  @Get('posts/:id')
  post(@CurrentUser() user: AuthUser, @Param('id', uuid()) id: string) {
    return this.community.post(user, id);
  }

  @Patch('posts/:id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', uuid()) id: string,
    @Body(new ZodValidationPipe(updatePostSchema)) body: UpdatePostInput,
  ) {
    return this.community.updatePost(user, id, body);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete('posts/:id')
  remove(@CurrentUser() user: AuthUser, @Param('id', uuid()) id: string) {
    return this.community.deletePost(user, id);
  }

  @Post('posts/:id/answers')
  answer(
    @CurrentUser() user: AuthUser,
    @Param('id', uuid()) id: string,
    @Body(new ZodValidationPipe(answerSchema)) body: AnswerInput,
  ) {
    return this.community.answer(user, id, body);
  }

  @HttpCode(HttpStatus.OK)
  @Post('posts/:id/accept')
  accept(
    @CurrentUser() user: AuthUser,
    @Param('id', uuid()) id: string,
    @Body(new ZodValidationPipe(acceptSchema)) body: AcceptInput,
  ) {
    return this.community.accept(user, id, body);
  }

  @Patch('answers/:id')
  updateAnswer(
    @CurrentUser() user: AuthUser,
    @Param('id', uuid()) id: string,
    @Body(new ZodValidationPipe(updateAnswerSchema)) body: UpdateAnswerInput,
  ) {
    return this.community.updateAnswer(user, id, body);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete('answers/:id')
  removeAnswer(@CurrentUser() user: AuthUser, @Param('id', uuid()) id: string) {
    return this.community.deleteAnswer(user, id);
  }

  @Put('votes')
  vote(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(voteSchema)) body: VoteInput,
  ) {
    return this.community.vote(user, body);
  }

  @Post('reports')
  report(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(reportSchema)) body: ReportInput,
  ) {
    return this.community.report(user, body);
  }
}

/** Moderation queue (/admin/moderation). */
@Roles(Role.admin, Role.super_admin)
@Controller('admin/moderation')
export class ModerationController {
  constructor(private readonly moderation: ModerationService) {}

  @Get()
  queue(
    @Query(new ZodValidationPipe(moderationQueueSchema))
    query: ModerationQueueInput,
  ) {
    return this.moderation.queue(query.status);
  }

  @HttpCode(HttpStatus.OK)
  @Post('resolve')
  resolve(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(resolveSchema)) body: ResolveInput,
    @Req() req: Request,
  ) {
    return this.moderation.resolve(user, body, req.ip ?? null);
  }
}
