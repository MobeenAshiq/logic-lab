import { Module } from '@nestjs/common';
import { BillingModule } from '../billing/billing.module';
import {
  CommunityController,
  ModerationController,
} from './community.controller';
import { CommunityService } from './community.service';
import { ModerationService } from './moderation.service';

@Module({
  imports: [BillingModule],
  controllers: [CommunityController, ModerationController],
  providers: [CommunityService, ModerationService],
})
export class CommunityModule {}
