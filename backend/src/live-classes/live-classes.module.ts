import { Module } from '@nestjs/common';
import { BillingModule } from '../billing/billing.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PointsModule } from '../points/points.module';
import { StorageModule } from '../storage/storage.module';
import {
  LiveSessionsController,
  StudentLiveSessionsController,
  TeachLiveSessionsController,
} from './live-classes.controller';
import { LiveClassesRemindersService } from './live-classes.reminders';
import { LiveClassesService } from './live-classes.service';

@Module({
  imports: [BillingModule, PointsModule, NotificationsModule, StorageModule],
  controllers: [
    TeachLiveSessionsController,
    StudentLiveSessionsController,
    LiveSessionsController,
  ],
  providers: [LiveClassesService, LiveClassesRemindersService],
  exports: [LiveClassesService],
})
export class LiveClassesModule {}
