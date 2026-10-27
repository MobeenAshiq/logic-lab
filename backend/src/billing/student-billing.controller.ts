import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser, Public, Roles } from '../auth/decorators';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { SettingsService } from '../settings/settings.service';
import { slipUploadSchema } from '../storage/uploads';
import type { SlipUploadInput } from '../storage/uploads';
import {
  quoteSchema,
  startTrialSchema,
  submitPaymentSchema,
} from './billing.schemas';
import type {
  QuoteInput,
  StartTrialInput,
  SubmitPaymentInput,
} from './billing.schemas';
import { InvoicesService } from './invoices.service';
import { PaymentsService } from './payments.service';
import { PlansService } from './plans.service';
import { SubscriptionsService } from './subscriptions.service';

@Controller()
export class StudentBillingController {
  constructor(
    private readonly subscriptions: SubscriptionsService,
    private readonly plans: PlansService,
    private readonly payments: PaymentsService,
    private readonly invoices: InvoicesService,
    private readonly settings: SettingsService,
  ) {}

  /** Public pricing page. */
  @Public()
  @Get('plans')
  listPlans() {
    return this.plans.listActive();
  }

  /** Everything for /student/billing in one call. */
  @Roles(Role.student)
  @Get('student/billing')
  async billing(@CurrentUser() user: AuthUser) {
    const [access, plans, payments, instructions] = await Promise.all([
      this.subscriptions.overview(user.id),
      this.plans.listActive(),
      this.payments.listMine(user.id),
      this.settings.get('payment_instructions'),
    ]);
    return { ...access, plans, payments, paymentInstructions: instructions };
  }

  @Roles(Role.student)
  @Post('student/trial')
  startTrial(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(startTrialSchema)) body: StartTrialInput,
  ) {
    return this.subscriptions.startTrial(user, body.trackId);
  }

  @Roles(Role.student)
  @HttpCode(HttpStatus.OK)
  @Post('student/billing/quote')
  async quote(@Body(new ZodValidationPipe(quoteSchema)) body: QuoteInput) {
    const q = await this.plans.quote(body.planId, body.couponCode);
    return {
      planId: q.plan.id,
      planName: q.plan.name,
      couponCode: q.coupon?.code ?? null,
      pricePkr: q.pricePkr,
      discount: q.discount,
      total: q.total,
    };
  }

  @Roles(Role.student)
  @Post('student/payments/upload-url')
  slipUploadUrl(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(slipUploadSchema)) body: SlipUploadInput,
  ) {
    return this.payments.slipUploadUrl(user, body);
  }

  @Roles(Role.student)
  @Post('student/payments')
  submitPayment(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(submitPaymentSchema)) body: SubmitPaymentInput,
  ) {
    return this.payments.submit(user, body);
  }

  @Roles(Role.student)
  @Get('student/payments/:id/slip')
  slip(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.payments.slipUrl(user, id);
  }

  @Roles(Role.student)
  @Get('student/invoices/:id/download')
  invoice(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.invoices.downloadUrl(user, id);
  }
}
