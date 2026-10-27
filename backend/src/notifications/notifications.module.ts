import {
  Body,
  Controller,
  Get,
  Global,
  HttpCode,
  HttpStatus,
  Module,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { z } from 'zod';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { EMAIL_TYPES, NotificationsService } from './notifications.service';

const listSchema = z.object({
  unread: z.enum(['true', 'false']).default('false'),
  before: z.iso.datetime().optional(),
});

const preferencesSchema = z.strictObject(
  Object.fromEntries(
    EMAIL_TYPES.map((t) => [t, z.boolean().optional()]),
  ) as Record<(typeof EMAIL_TYPES)[number], z.ZodOptional<z.ZodBoolean>>,
);

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query(new ZodValidationPipe(listSchema)) query: z.infer<typeof listSchema>,
  ) {
    return this.notifications.list(user.id, {
      unreadOnly: query.unread === 'true',
      before: query.before,
    });
  }

  @HttpCode(HttpStatus.OK)
  @Post('read-all')
  readAll(@CurrentUser() user: AuthUser) {
    return this.notifications.markAllRead(user.id);
  }

  @HttpCode(HttpStatus.OK)
  @Post(':id/read')
  read(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.notifications.markRead(user.id, id);
  }

  @Get('preferences')
  preferences(@CurrentUser() user: AuthUser) {
    return this.notifications.preferences(user.id);
  }

  @Put('preferences')
  updatePreferences(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(preferencesSchema))
    body: z.infer<typeof preferencesSchema>,
  ) {
    return this.notifications.updatePreferences(user.id, body);
  }
}

@Global()
@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
