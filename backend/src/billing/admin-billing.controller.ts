import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import type { Request } from 'express';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser, Roles } from '../auth/decorators';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import {
  createCouponSchema,
  createPlanSchema,
  listPaymentsSchema,
  rejectPaymentSchema,
  updateCouponSchema,
  updatePlanSchema,
} from './billing.schemas';
import type {
  CreateCouponInput,
  CreatePlanInput,
  ListPaymentsInput,
  RejectPaymentInput,
  UpdateCouponInput,
  UpdatePlanInput,
} from './billing.schemas';
import { InvoicesService } from './invoices.service';
import { PaymentsService } from './payments.service';
import { PlansService } from './plans.service';

@Roles(Role.admin, Role.super_admin)
@Controller('admin')
export class AdminBillingController {
  constructor(
    private readonly plans: PlansService,
    private readonly payments: PaymentsService,
    private readonly invoices: InvoicesService,
  ) {}

  // --- Plans ---

  @Get('billing/plans')
  listPlans() {
    return this.plans.listAll();
  }

  @Post('billing/plans')
  createPlan(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createPlanSchema)) body: CreatePlanInput,
    @Req() req: Request,
  ) {
    return this.plans.createPlan(user, body, req.ip ?? null);
  }

  @Patch('billing/plans/:id')
  updatePlan(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updatePlanSchema)) body: UpdatePlanInput,
    @Req() req: Request,
  ) {
    return this.plans.updatePlan(user, id, body, req.ip ?? null);
  }

  // --- Coupons ---

  @Get('billing/coupons')
  listCoupons() {
    return this.plans.listCoupons();
  }

  @Post('billing/coupons')
  createCoupon(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createCouponSchema)) body: CreateCouponInput,
    @Req() req: Request,
  ) {
    return this.plans.createCoupon(user, body, req.ip ?? null);
  }

  @Patch('billing/coupons/:id')
  updateCoupon(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateCouponSchema)) body: UpdateCouponInput,
    @Req() req: Request,
  ) {
    return this.plans.updateCoupon(user, id, body, req.ip ?? null);
  }

  // --- Payment review queue (/admin/payments) ---

  @Get('payments')
  listPayments(
    @Query(new ZodValidationPipe(listPaymentsSchema)) query: ListPaymentsInput,
  ) {
    return this.payments.list(query);
  }

  @Get('payments/:id')
  getPayment(@Param('id', ParseUUIDPipe) id: string) {
    return this.payments.get(id);
  }

  @HttpCode(HttpStatus.OK)
  @Post('payments/:id/approve')
  approve(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
  ) {
    return this.payments.approve(user, id, req.ip ?? null);
  }

  @HttpCode(HttpStatus.OK)
  @Post('payments/:id/reject')
  reject(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(rejectPaymentSchema)) body: RejectPaymentInput,
    @Req() req: Request,
  ) {
    return this.payments.reject(user, id, body.reason, req.ip ?? null);
  }

  // --- Invoices ---

  @Get('invoices/:id/download')
  downloadInvoice(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.invoices.downloadUrl(user, id);
  }

  @HttpCode(HttpStatus.OK)
  @Post('invoices/:id/resend')
  resendInvoice(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
  ) {
    return this.invoices.resend(user, id, req.ip ?? null);
  }
}
