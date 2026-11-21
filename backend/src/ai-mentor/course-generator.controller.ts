import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { z } from 'zod';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser, Roles } from '../auth/decorators';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { CourseGeneratorService } from './course-generator.service';

const startSchema = z.strictObject({
  prompt: z
    .string()
    .trim()
    .min(20, 'Describe the course in at least one sentence.')
    .max(2000),
  trackId: z.uuid().optional(),
});

/** Admin › Content › Generate with AI. */
@Roles(Role.admin, Role.super_admin)
@Controller('admin/course-generator')
export class CourseGeneratorController {
  constructor(private readonly generator: CourseGeneratorService) {}

  @Post()
  start(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(startSchema)) body: z.infer<typeof startSchema>,
  ) {
    return this.generator.start(user, body);
  }

  @Get(':courseId')
  status(@Param('courseId', ParseUUIDPipe) courseId: string) {
    return this.generator.status(courseId);
  }
}
