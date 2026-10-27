import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Module,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser, Roles } from '../auth/decorators';
import { BillingModule } from '../billing/billing.module';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { chatImageSchema } from '../storage/uploads';
import type { ChatImageInput } from '../storage/uploads';
import {
  listConversationsSchema,
  officeHoursSchema,
  openDoubtSchema,
  sendMessageSchema,
} from './chat.schemas';
import type {
  ListConversationsInput,
  OfficeHoursInput,
  OpenDoubtInput,
  SendMessageInput,
} from './chat.schemas';
import { ChatService } from './chat.service';

const uuid = () => new ParseUUIDPipe();

@Controller('chat')
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  @Post('uploads')
  upload(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(chatImageSchema)) body: ChatImageInput,
  ) {
    return this.chat.uploadUrl(user, body);
  }

  @Roles(Role.student)
  @Post('conversations')
  open(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(openDoubtSchema)) body: OpenDoubtInput,
  ) {
    return this.chat.open(user, body);
  }

  @Get('conversations')
  mine(
    @CurrentUser() user: AuthUser,
    @Query(new ZodValidationPipe(listConversationsSchema))
    query: ListConversationsInput,
  ) {
    return this.chat.mine(user, query.status);
  }

  @Roles(Role.mentor, Role.admin, Role.super_admin)
  @Get('queue')
  queue(@CurrentUser() user: AuthUser) {
    return this.chat.queue(user);
  }

  @Get('conversations/:id')
  get(@CurrentUser() user: AuthUser, @Param('id', uuid()) id: string) {
    return this.chat.get(user, id);
  }

  @Roles(Role.mentor, Role.admin, Role.super_admin)
  @HttpCode(HttpStatus.OK)
  @Post('conversations/:id/claim')
  claim(@CurrentUser() user: AuthUser, @Param('id', uuid()) id: string) {
    return this.chat.claim(user, id);
  }

  @Post('conversations/:id/messages')
  send(
    @CurrentUser() user: AuthUser,
    @Param('id', uuid()) id: string,
    @Body(new ZodValidationPipe(sendMessageSchema)) body: SendMessageInput,
  ) {
    return this.chat.send(user, id, body);
  }

  @HttpCode(HttpStatus.OK)
  @Post('conversations/:id/read')
  read(@CurrentUser() user: AuthUser, @Param('id', uuid()) id: string) {
    return this.chat.read(user, id);
  }

  @HttpCode(HttpStatus.OK)
  @Post('conversations/:id/close')
  close(@CurrentUser() user: AuthUser, @Param('id', uuid()) id: string) {
    return this.chat.close(user, id);
  }
}

@Roles(Role.mentor)
@Controller('mentor/office-hours')
export class OfficeHoursController {
  constructor(private readonly chat: ChatService) {}

  @Get()
  get(@CurrentUser() user: AuthUser) {
    return this.chat.officeHours(user.id);
  }

  @Put()
  set(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(officeHoursSchema)) body: OfficeHoursInput,
  ) {
    return this.chat.setOfficeHours(user, body);
  }
}

@Module({
  imports: [BillingModule],
  controllers: [ChatController, OfficeHoursController],
  providers: [ChatService],
})
export class ChatModule {}
