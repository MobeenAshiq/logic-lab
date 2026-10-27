import { Module } from '@nestjs/common';
import { AdminBillingController } from './admin-billing.controller';
import { InvoicesService } from './invoices.service';
import { PaymentsService } from './payments.service';
import { PlansService } from './plans.service';
import { RemindersService } from './reminders.service';
import { StudentBillingController } from './student-billing.controller';
import { SubscriptionsService } from './subscriptions.service';

@Module({
  controllers: [StudentBillingController, AdminBillingController],
  providers: [
    SubscriptionsService,
    PlansService,
    PaymentsService,
    InvoicesService,
    RemindersService,
  ],
  exports: [SubscriptionsService],
})
export class BillingModule {}
