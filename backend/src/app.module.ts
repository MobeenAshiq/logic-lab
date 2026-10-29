import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AssessmentsModule } from './assessments/assessments.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { BillingModule } from './billing/billing.module';
import { ChatModule } from './chat/chat.module';
import { ChallengeModule } from './challenges/challenge.module';
import { CommunityModule } from './community/community.module';
import { ContentModule } from './content/content.module';
import { LearningModule } from './learning/learning.module';
import { LiveClassesModule } from './live-classes/live-classes.module';
import { validateEnv } from './config/env';
import { MailModule } from './mail/mail.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PointsModule } from './points/points.module';
import { PortalsController } from './portals/portals.controller';
import { PrismaModule } from './prisma/prisma.module';
import { RateLimitModule } from './rate-limit/rate-limit.module';
import { RealtimeModule } from './realtime/realtime.module';
import { SettingsModule } from './settings/settings.module';
import { StorageModule } from './storage/storage.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuditModule,
    MailModule,
    RateLimitModule,
    StorageModule,
    SettingsModule,
    RealtimeModule,
    NotificationsModule,
    PointsModule,
    AuthModule,
    UsersModule,
    ContentModule,
    BillingModule,
    LearningModule,
    AssessmentsModule,
    CommunityModule,
    ChatModule,
    ChallengeModule,
    LiveClassesModule,
  ],
  controllers: [AppController, PortalsController],
})
export class AppModule {}
