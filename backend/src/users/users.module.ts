import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminUsersController } from './admin-users.controller';
import { MeController } from './me.controller';
import { UsersService } from './users.service';

@Module({
  imports: [AuthModule],
  controllers: [MeController, AdminUsersController],
  providers: [UsersService],
})
export class UsersModule {}
