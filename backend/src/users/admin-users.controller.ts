import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  Req,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import type { Request } from 'express';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser, Roles } from '../auth/decorators';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import {
  changeRoleSchema,
  changeStatusSchema,
  listAuditSchema,
  listUsersSchema,
} from './users.schemas';
import type {
  ChangeRoleInput,
  ChangeStatusInput,
  ListAuditInput,
  ListUsersInput,
} from './users.schemas';
import { UsersService } from './users.service';

@Roles(Role.admin, Role.super_admin)
@Controller('admin')
export class AdminUsersController {
  constructor(
    private readonly users: UsersService,
    private readonly audit: AuditService,
  ) {}

  @Get('users')
  list(
    @CurrentUser() user: AuthUser,
    @Query(new ZodValidationPipe(listUsersSchema)) query: ListUsersInput,
  ) {
    return this.users.list(user, query);
  }

  @Patch('users/:id/role')
  changeRole(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(changeRoleSchema)) body: ChangeRoleInput,
    @Req() req: Request,
  ) {
    return this.users.changeRole(user, id, body, req.ip ?? null);
  }

  @Patch('users/:id/status')
  changeStatus(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(changeStatusSchema)) body: ChangeStatusInput,
    @Req() req: Request,
  ) {
    return this.users.changeStatus(user, id, body, req.ip ?? null);
  }

  @Get('audit-logs')
  auditLogs(
    @Query(new ZodValidationPipe(listAuditSchema)) query: ListAuditInput,
  ) {
    return this.audit.list({
      targetId: query.targetId,
      take: query.pageSize,
      skip: (query.page - 1) * query.pageSize,
    });
  }
}
