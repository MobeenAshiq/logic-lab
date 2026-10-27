import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Param,
  Put,
  Req,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import type { Request } from 'express';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser, Roles } from '../auth/decorators';
import { AppException } from '../common/app-exception';
import { isSettingKey } from './settings';
import { SettingsService } from './settings.service';

@Roles(Role.admin, Role.super_admin)
@Controller('admin/settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get(':key')
  get(@Param('key') key: string) {
    if (!isSettingKey(key)) {
      throw new AppException(HttpStatus.NOT_FOUND, 'UNKNOWN_SETTING');
    }
    return this.settings.get(key);
  }

  @Put(':key')
  update(
    @CurrentUser() user: AuthUser,
    @Param('key') key: string,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    return this.settings.update(key, body, user.id, req.ip ?? null);
  }
}
