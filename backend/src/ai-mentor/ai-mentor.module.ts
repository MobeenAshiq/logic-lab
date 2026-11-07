import { Module } from '@nestjs/common';
import { BillingModule } from '../billing/billing.module';
import { LearningModule } from '../learning/learning.module';
import { PointsModule } from '../points/points.module';
import { AdminAiService } from './admin-ai.service';
import {
  AdminAutonomousController,
  StudentAutonomousController,
} from './autonomous-content.controller';
import { AutonomousContentService } from './autonomous-content.service';
import { AdminAiController, MentorController } from './mentor.controller';
import { MentorService } from './mentor.service';

@Module({
  imports: [LearningModule, BillingModule, PointsModule],
  controllers: [
    MentorController,
    AdminAiController,
    AdminAutonomousController,
    StudentAutonomousController,
  ],
  providers: [MentorService, AdminAiService, AutonomousContentService],
  exports: [MentorService, AdminAiService, AutonomousContentService],
})
export class AiMentorModule {}
