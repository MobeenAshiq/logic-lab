import { Module } from '@nestjs/common';
import { LearningModule } from '../learning/learning.module';
import { AssignmentsService } from './assignments.service';
import { AiService } from './ai.service';
import { LearnAiController, TeachAiController } from './ai.controller';
import { GradingQueueService } from './grading-queue.service';
import { LearnAssessmentsController } from './learn-assessments.controller';
import { QuestionBankService } from './question-bank.service';
import { QuizzesService } from './quizzes.service';
import { StaffAccessService } from './staff-access.service';
import { TeachAssessmentsController } from './teach-assessments.controller';

@Module({
  imports: [LearningModule],
  controllers: [TeachAssessmentsController, LearnAssessmentsController, LearnAiController, TeachAiController],
  providers: [
    StaffAccessService,
    QuestionBankService,
    QuizzesService,
    AssignmentsService,
    GradingQueueService,
    AiService,
  ],
})
export class AssessmentsModule {}
