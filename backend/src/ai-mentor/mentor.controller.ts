import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import type { Request } from 'express';
import { z } from 'zod';
import { AiKeysService } from '../ai/ai-keys.service';
import { AiQuotaService } from '../ai/ai-quota.service';
import { AiRouterService } from '../ai/ai-router.service';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser, Roles } from '../auth/decorators';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { AdminAiService } from './admin-ai.service';
import {
  adminFlagsSchema,
  adminSessionsSchema,
  createSessionSchema,
  overviewSchema,
  providerParam,
  sendMessageSchema,
  setKeySchema,
  updateSessionSchema,
  type AdminFlagsInput,
  type AdminSessionsInput,
  type CreateSessionInput,
  type UpdateSessionInput,
} from './mentor.schemas';
import { MentorService } from './mentor.service';

/** Students chat with the AI Mentor; admins may use it too (to test prompt changes). */
@Roles(Role.student, Role.admin, Role.super_admin)
@Controller('mentor-ai')
export class MentorController {
  constructor(
    private readonly mentor: MentorService,
    private readonly quota: AiQuotaService,
  ) {}

  @Get('usage')
  usage(@CurrentUser() user: AuthUser) {
    return this.quota.usage(user);
  }

  @Get('sessions')
  list(@CurrentUser() user: AuthUser) {
    return this.mentor.listSessions(user);
  }

  @Post('sessions')
  create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createSessionSchema)) body: CreateSessionInput,
  ) {
    return this.mentor.createSession(user, body);
  }

  @Get('sessions/:id')
  get(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.mentor.getSession(user, id);
  }

  @Patch('sessions/:id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateSessionSchema)) body: UpdateSessionInput,
  ) {
    return this.mentor.updateSession(user, id, body);
  }

  @Post('sessions/:id/messages')
  send(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(sendMessageSchema))
    body: z.infer<typeof sendMessageSchema>,
  ) {
    return this.mentor.send(user, id, body.content);
  }
}

@Roles(Role.admin, Role.super_admin)
@Controller('admin/ai')
export class AdminAiController {
  constructor(
    private readonly admin: AdminAiService,
    private readonly keys: AiKeysService,
    private readonly router: AiRouterService,
  ) {}

  @Get('overview')
  overview(
    @Query(new ZodValidationPipe(overviewSchema))
    query: z.infer<typeof overviewSchema>,
  ) {
    return this.admin.overview(query.days);
  }

  @Get('sessions')
  sessions(
    @Query(new ZodValidationPipe(adminSessionsSchema))
    query: AdminSessionsInput,
  ) {
    return this.admin.sessions(query);
  }

  @Get('sessions/:id')
  session(@Param('id', ParseUUIDPipe) id: string) {
    return this.admin.session(id);
  }

  @Get('flags')
  flags(
    @Query(new ZodValidationPipe(adminFlagsSchema)) query: AdminFlagsInput,
  ) {
    return this.admin.flags(query);
  }

  @Patch('flags/:id')
  reviewFlag(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(z.strictObject({ reviewed: z.boolean() })))
    body: { reviewed: boolean },
    @Req() req: Request,
  ) {
    return this.admin.reviewFlag(id, user.id, body.reviewed, req.ip ?? null);
  }

  @Get('keys')
  keyStatus() {
    return this.keys.status();
  }

  /** Write-only: the saved key is never returned, only its last 4 characters. */
  @Patch('keys/:provider')
  setKey(
    @CurrentUser() user: AuthUser,
    @Param('provider', new ZodValidationPipe(providerParam))
    provider: z.infer<typeof providerParam>,
    @Body(new ZodValidationPipe(setKeySchema))
    body: z.infer<typeof setKeySchema>,
    @Req() req: Request,
  ) {
    return this.keys.set(provider, body.apiKey, user.id, req.ip ?? null);
  }

  @Post('keys/:provider/test')
  testKey(
    @Param('provider', new ZodValidationPipe(providerParam))
    provider: z.infer<typeof providerParam>,
  ) {
    return this.router.test(provider);
  }
}
