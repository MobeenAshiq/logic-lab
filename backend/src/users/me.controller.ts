import { Body, Controller, Get, Patch } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import type { AuthUser } from '../auth/auth.types';
import { AllowPendingMfa, CurrentUser } from '../auth/decorators';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { updateMeSchema } from './users.schemas';
import type { UpdateMeInput } from './users.schemas';
import { UsersService } from './users.service';

@Controller('me')
export class MeController {
  constructor(
    private readonly auth: AuthService,
    private readonly users: UsersService,
  ) {}

  /** The frontend calls this on load to know who is logged in and where to route them. */
  @AllowPendingMfa()
  @Get()
  async me(@CurrentUser() user: AuthUser) {
    return { user: await this.auth.me(user.id), mfa: user.mfa };
  }

  @Patch()
  update(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(updateMeSchema)) body: UpdateMeInput,
  ) {
    return this.users.updateMe(user, body);
  }
}
