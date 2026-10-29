import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { z } from 'zod';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser, Roles } from '../auth/decorators';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { ChallengeService } from './challenge.service';
import { createChallengeSchema, submitChallengeSchema } from './challenge.schemas';

const dateQuery = z.strictObject({ date: z.iso.date().optional() });

@Roles(Role.student)
@Controller('student/challenges')
export class StudentChallengeController {
  constructor(private readonly challenges: ChallengeService) {}

  @Get(':trackSlug')
  daily(
    @CurrentUser() user: AuthUser,
    @Param('trackSlug') trackSlug: string,
    @Query(new ZodValidationPipe(dateQuery)) query: z.infer<typeof dateQuery>,
  ) {
    return this.challenges.daily(user, trackSlug, query.date);
  }

  @Post(':id/submissions')
  submit(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) challengeId: string,
    @Body(new ZodValidationPipe(submitChallengeSchema)) body: z.infer<typeof submitChallengeSchema>,
  ) {
    return this.challenges.submit(user, challengeId, body);
  }
}

@Roles(Role.admin, Role.super_admin)
@Controller('admin/challenges')
export class AdminChallengeController {
  constructor(private readonly challenges: ChallengeService) {}

  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createChallengeSchema)) body: z.infer<typeof createChallengeSchema>,
  ) {
    return this.challenges.create(user, body);
  }
}
