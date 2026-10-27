import { Module } from '@nestjs/common';
import { BillingModule } from '../billing/billing.module';
import { LearnController } from './learn.controller';
import { LearnService } from './learn.service';
import { LessonAccessService } from './lesson-access.service';
import { ProgressService } from './progress.service';
import { QuestionsService } from './questions.service';
import { TeachController } from './teach.controller';
import { TeachingService } from './teaching.service';

@Module({
  imports: [BillingModule],
  controllers: [LearnController, TeachController],
  providers: [
    LessonAccessService,
    LearnService,
    ProgressService,
    QuestionsService,
    TeachingService,
  ],
  exports: [LessonAccessService, ProgressService],
})
export class LearningModule {}
