import { Module } from '@nestjs/common';
import { BillingModule } from '../billing/billing.module';
import { PointsModule } from '../points/points.module';
import { AdminChallengeController, StudentChallengeController } from './challenge.controller';
import { ChallengeService } from './challenge.service';

@Module({
  imports: [BillingModule, PointsModule],
  controllers: [StudentChallengeController, AdminChallengeController],
  providers: [ChallengeService],
})
export class ChallengeModule {}
