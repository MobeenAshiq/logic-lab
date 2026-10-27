import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import {
  NotificationType,
  PaymentStatus,
  Prisma,
  SubscriptionStatus,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../auth/auth.types';
import { AppException } from '../common/app-exception';
import { t } from '../common/i18n/en';
import { MailService } from '../mail/mail.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { PRESIGN_TTL_SECONDS, R2Service } from '../storage/r2.service';
import { isUploadKey, newUploadKey, SlipUploadInput } from '../storage/uploads';
import { ListPaymentsInput, SubmitPaymentInput } from './billing.schemas';
import { InvoicesService } from './invoices.service';
import { PlansService } from './plans.service';
import { addDays, normalizeTransactionId, ocrWarnings } from './pricing';

const MAX_SLIP_AGE_DAYS = 90;

const adminInclude = {
  user: {
    select: { id: true, email: true, profile: { select: { fullName: true } } },
  },
  plan: {
    select: { id: true, name: true, pricePkr: true, durationDays: true },
  },
  coupon: { select: { code: true, discountType: true, discountValue: true } },
  invoice: { select: { id: true, invoiceNo: true, emailedAt: true } },
} satisfies Prisma.PaymentInclude;

function isUniqueViolation(err: unknown) {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002'
  );
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly r2: R2Service,
    private readonly plans: PlansService,
    private readonly invoices: InvoicesService,
    private readonly mail: MailService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  // --- Student ---

  /** Step 1: presigned URL to upload the slip to slips/<userId>/... */
  async slipUploadUrl(auth: AuthUser, input: SlipUploadInput) {
    const key = newUploadKey('payment-slip', input.contentType, auth.id);
    return {
      key,
      uploadUrl: await this.r2.getUploadUrl(key, input.contentType, input.size),
      method: 'PUT',
      headers: { 'Content-Type': input.contentType },
      expiresInSeconds: PRESIGN_TTL_SECONDS,
    };
  }

  /** Step 2: submit the payment details for admin review. */
  async submit(auth: AuthUser, input: SubmitPaymentInput) {
    const quote = await this.plans.quote(input.planId, input.couponCode);
    this.assertPaidAt(input.paidAt);
    if (
      !isUploadKey('payment-slip', input.slipKey, auth.id) ||
      !(await this.r2.exists(input.slipKey))
    ) {
      throw new AppException(HttpStatus.BAD_REQUEST, 'SLIP_NOT_UPLOADED');
    }
    const transactionId = normalizeTransactionId(input.transactionId);

    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT 1 AS ok FROM pg_advisory_xact_lock(hashtext(${auth.id}))`;

        const pending = await tx.payment.count({
          where: { userId: auth.id, status: PaymentStatus.pending },
        });
        if (pending > 0) {
          throw new AppException(
            HttpStatus.CONFLICT,
            'PAYMENT_ALREADY_PENDING',
          );
        }

        // A transaction ID is used once. The only exception: the same student
        // re-submitting after their payment with that ID was rejected.
        const existing = await tx.payment.findUnique({
          where: { transactionId },
        });
        if (
          existing &&
          !(
            existing.userId === auth.id &&
            existing.status === PaymentStatus.rejected
          )
        ) {
          throw new AppException(
            HttpStatus.CONFLICT,
            'DUPLICATE_TRANSACTION_ID',
          );
        }

        const subscriptionData = {
          planId: quote.plan.id,
          allTracks: quote.plan.allTracks,
          trackIds: quote.plan.trackIds,
        };
        const pendingSub = await tx.subscription.findFirst({
          where: { userId: auth.id, status: SubscriptionStatus.pending },
        });
        const subscription = pendingSub
          ? await tx.subscription.update({
              where: { id: pendingSub.id },
              data: subscriptionData,
            })
          : await tx.subscription.create({
              data: {
                ...subscriptionData,
                userId: auth.id,
                status: SubscriptionStatus.pending,
              },
            });

        const data = {
          subscriptionId: subscription.id,
          planId: quote.plan.id,
          couponId: quote.coupon?.id ?? null,
          method: input.method,
          amount: input.amount,
          expectedAmount: quote.total,
          paidAt: new Date(input.paidAt),
          slipKey: input.slipKey,
          ocrText: input.ocrText ?? null,
          status: PaymentStatus.pending,
          reviewedBy: null,
          reviewedAt: null,
          rejectReason: null,
        };
        const payment = existing
          ? await tx.payment.update({ where: { id: existing.id }, data })
          : await tx.payment.create({
              data: { ...data, userId: auth.id, transactionId },
            });
        return this.toStudentView(payment, null);
      });
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new AppException(HttpStatus.CONFLICT, 'DUPLICATE_TRANSACTION_ID');
      }
      throw err;
    }
  }

  async listMine(userId: string) {
    const payments = await this.prisma.payment.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        plan: { select: { name: true } },
        invoice: { select: { id: true, invoiceNo: true, issuedAt: true } },
      },
    });
    return payments.map((p) => this.toStudentView(p, p.invoice, p.plan.name));
  }

  /** A student can only open their own slip. */
  async slipUrl(auth: AuthUser, paymentId: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, userId: auth.id },
    });
    if (!payment)
      throw new AppException(HttpStatus.NOT_FOUND, 'PAYMENT_NOT_FOUND');
    return { url: await this.r2.getDownloadUrl(payment.slipKey) };
  }

  // --- Admin ---

  async list(q: ListPaymentsInput) {
    const where: Prisma.PaymentWhereInput = { status: q.status };
    const [total, payments] = await Promise.all([
      this.prisma.payment.count({ where }),
      this.prisma.payment.findMany({
        where,
        // Oldest first for the pending queue; newest first for history.
        orderBy: {
          createdAt: q.status === PaymentStatus.pending ? 'asc' : 'desc',
        },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
        include: adminInclude,
      }),
    ]);
    return {
      total,
      page: q.page,
      // The full OCR text is only in the detail view.
      items: payments.map((p) => ({
        ...p,
        ocrText: undefined,
        warnings: ocrWarnings(p),
      })),
    };
  }

  async get(id: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: adminInclude,
    });
    if (!payment)
      throw new AppException(HttpStatus.NOT_FOUND, 'PAYMENT_NOT_FOUND');
    const previousPayments = await this.prisma.payment.count({
      where: { userId: payment.userId, NOT: { id } },
    });
    return {
      ...payment,
      warnings: ocrWarnings(payment),
      slipUrl: await this.r2.getDownloadUrl(payment.slipKey),
      previousPayments,
    };
  }

  /**
   * Approve in one database transaction: activate the subscription, mark the
   * payment, count the coupon, issue the invoice (number + PDF in R2) and write
   * the audit log. The email is sent after the commit.
   */
  async approve(auth: AuthUser, id: string, ip: string | null) {
    const { invoice, pdf, payment } = await this.prisma.$transaction(
      async (tx) => {
        const payment = await this.lockPending(tx, id);
        const plan = payment.plan;

        // Renewals start when the current paid access ends; otherwise now.
        const now = new Date();
        const current = await tx.subscription.findFirst({
          where: {
            userId: payment.userId,
            status: SubscriptionStatus.active,
            endsAt: { gt: now },
            NOT: { id: payment.subscriptionId },
          },
          orderBy: { endsAt: 'desc' },
        });
        const startsAt = current?.endsAt ?? now;
        const endsAt = addDays(startsAt, plan.durationDays);

        await tx.subscription.update({
          where: { id: payment.subscriptionId },
          data: {
            status: SubscriptionStatus.active,
            planId: plan.id,
            allTracks: plan.allTracks,
            trackIds: plan.trackIds,
            startsAt,
            endsAt,
          },
        });
        await tx.payment.update({
          where: { id },
          data: {
            status: PaymentStatus.approved,
            reviewedBy: auth.id,
            reviewedAt: now,
          },
        });
        if (payment.couponId) {
          await tx.coupon.update({
            where: { id: payment.couponId },
            data: { redeemedCount: { increment: 1 } },
          });
        }
        const { invoice, pdf } = await this.invoices.issue(tx, {
          payment,
          periodStart: startsAt,
          periodEnd: endsAt,
        });
        await this.audit.log(
          {
            actorId: auth.id,
            action: 'payment.approved',
            targetType: 'payment',
            targetId: id,
            metadata: {
              userId: payment.userId,
              amount: payment.amount,
              transactionId: payment.transactionId,
              invoiceNo: invoice.invoiceNo,
              accessUntil: endsAt.toISOString(),
            },
            ip,
          },
          tx,
        );
        return { invoice, pdf, payment };
      },
      { timeout: 30_000 },
    );

    const emailed = await this.invoices.email(
      invoice,
      {
        email: payment.user.email,
        name: payment.user.profile?.fullName ?? '',
      },
      pdf,
    );
    if (!emailed) this.logger.warn(`Invoice ${invoice.invoiceNo} email failed`);
    await this.notifications.notify(payment.userId, {
      type: NotificationType.payment_approved,
      title: t.notifications.paymentApproved,
      body: invoice.invoiceNo,
      link: '/student/billing',
    });
    return { ...(await this.get(id)), emailed };
  }

  async reject(auth: AuthUser, id: string, reason: string, ip: string | null) {
    const payment = await this.prisma.$transaction(async (tx) => {
      const payment = await this.lockPending(tx, id);
      await tx.payment.update({
        where: { id },
        data: {
          status: PaymentStatus.rejected,
          rejectReason: reason,
          reviewedBy: auth.id,
          reviewedAt: new Date(),
        },
      });
      await this.audit.log(
        {
          actorId: auth.id,
          action: 'payment.rejected',
          targetType: 'payment',
          targetId: id,
          metadata: {
            userId: payment.userId,
            amount: payment.amount,
            transactionId: payment.transactionId,
            reason,
          },
          ip,
        },
        tx,
      );
      return payment;
    });
    await this.notifications.notify(payment.userId, {
      type: NotificationType.payment_rejected,
      title: t.notifications.paymentRejected,
      body: reason,
      link: '/student/billing',
    });
    // The subscription stays pending, so the student can upload a new slip.
    await this.mail.sendPaymentRejected(
      payment.user.email,
      payment.user.profile?.fullName ?? '',
      reason,
    );
    return this.get(id);
  }

  // --- Helpers ---

  /** Row-locks the payment so two admins cannot review it at the same time. */
  private async lockPending(tx: Prisma.TransactionClient, id: string) {
    await tx.$queryRaw`SELECT id FROM payments WHERE id = ${id}::uuid FOR UPDATE`;
    const payment = await tx.payment.findUnique({
      where: { id },
      include: {
        user: { include: { profile: true } },
        plan: true,
        coupon: true,
      },
    });
    if (!payment)
      throw new AppException(HttpStatus.NOT_FOUND, 'PAYMENT_NOT_FOUND');
    if (payment.status !== PaymentStatus.pending) {
      throw new AppException(HttpStatus.CONFLICT, 'PAYMENT_ALREADY_REVIEWED');
    }
    return payment;
  }

  private assertPaidAt(paidAt: string) {
    const date = new Date(`${paidAt}T00:00:00+05:00`);
    const now = new Date();
    if (date > addDays(now, 1) || date < addDays(now, -MAX_SLIP_AGE_DAYS)) {
      throw new AppException(HttpStatus.BAD_REQUEST, 'VALIDATION_FAILED', {
        errors: [
          {
            field: 'paidAt',
            message: `Use the payment date from the last ${MAX_SLIP_AGE_DAYS} days.`,
          },
        ],
      });
    }
  }

  private toStudentView(
    p: {
      id: string;
      method: string;
      transactionId: string;
      amount: number;
      expectedAmount: number;
      paidAt: Date;
      status: PaymentStatus;
      rejectReason: string | null;
      createdAt: Date;
    },
    invoice: { id: string; invoiceNo: string } | null,
    planName?: string,
  ) {
    return {
      id: p.id,
      planName,
      method: p.method,
      transactionId: p.transactionId,
      amount: p.amount,
      expectedAmount: p.expectedAmount,
      paidAt: p.paidAt,
      status: p.status,
      rejectReason: p.rejectReason,
      createdAt: p.createdAt,
      invoice,
    };
  }
}
