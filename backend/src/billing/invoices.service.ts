import { HttpStatus, Injectable } from '@nestjs/common';
import { Coupon, Payment, Plan, Prisma, Profile, User } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { ADMIN_ROLES, AuthUser } from '../auth/auth.types';
import { AppException } from '../common/app-exception';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { R2Service } from '../storage/r2.service';
import { renderInvoicePdf } from './invoice-pdf';

const METHOD_LABEL = {
  easypaisa: 'EasyPaisa',
  jazzcash: 'JazzCash',
  bank: 'Bank transfer',
} as const;

export interface InvoiceSource {
  payment: Payment & {
    user: User & { profile: Profile | null };
    plan: Plan;
    coupon: Coupon | null;
  };
  periodStart: Date;
  periodEnd: Date;
}

/** Invoice year in Pakistan time, so numbering resets at local midnight on Jan 1. */
function invoiceYear(now: Date) {
  return Number(
    new Intl.DateTimeFormat('en', {
      timeZone: 'Asia/Karachi',
      year: 'numeric',
    }).format(now),
  );
}

@Injectable()
export class InvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly r2: R2Service,
    private readonly mail: MailService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Inside the approval transaction: takes the next gapless number
   * (INV-2026-00001), renders the PDF, stores it in R2 (when file storage is set
   * up), and saves the invoice row. Without R2 the PDF is rebuilt on download.
   * If anything fails, the whole approval rolls back (and the number is not used).
   */
  async issue(tx: Prisma.TransactionClient, src: InvoiceSource) {
    const now = new Date();
    const year = invoiceYear(now);
    const [{ last_no }] = await tx.$queryRaw<{ last_no: number }[]>`
      INSERT INTO invoice_counters (id, year, last_no, created_at, updated_at)
      VALUES (gen_random_uuid(), ${year}, 1, now(), now())
      ON CONFLICT (year)
      DO UPDATE SET last_no = invoice_counters.last_no + 1, updated_at = now()
      RETURNING last_no`;
    const invoiceNo = `INV-${year}-${String(last_no).padStart(5, '0')}`;

    const { payment } = src;
    const pdf = await this.render(invoiceNo, now, src);

    let pdfKey: string | null = null;
    if (this.r2.isConfigured) {
      pdfKey = `invoices/${payment.userId}/${invoiceNo}.pdf`;
      await this.r2.putObject(pdfKey, pdf, 'application/pdf');
    }

    const invoice = await tx.invoice.create({
      data: {
        invoiceNo,
        paymentId: payment.id,
        userId: payment.userId,
        amount: payment.amount,
        pdfKey,
        issuedAt: now,
      },
    });
    return { invoice, pdf };
  }

  /** Emails the invoice; records when it was sent. Never throws. */
  async email(
    invoice: { id: string; invoiceNo: string },
    to: { email: string; name: string },
    pdf: Buffer,
  ) {
    const sent = await this.mail.sendInvoice(
      to.email,
      to.name,
      invoice.invoiceNo,
      pdf,
    );
    if (sent) {
      await this.prisma.invoice.update({
        where: { id: invoice.id },
        data: { emailedAt: new Date() },
      });
    }
    return sent;
  }

  private render(invoiceNo: string, issuedAt: Date, src: InvoiceSource) {
    const { payment } = src;
    return renderInvoicePdf({
      invoiceNo,
      issuedAt,
      customerName: payment.user.profile?.fullName ?? '',
      customerEmail: payment.user.email,
      planName: payment.plan.name,
      periodStart: src.periodStart,
      periodEnd: src.periodEnd,
      pricePkr: payment.plan.pricePkr,
      discountPkr: payment.plan.pricePkr - payment.expectedAmount,
      couponCode: payment.coupon?.code ?? null,
      totalPkr: payment.amount,
      method: METHOD_LABEL[payment.method],
      transactionId: payment.transactionId,
    });
  }

  /** Students can see only their own invoices; admins any. */
  private async find(auth: AuthUser, invoiceId: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: {
        id: invoiceId,
        ...(ADMIN_ROLES.includes(auth.role) ? {} : { userId: auth.id }),
      },
      include: {
        payment: {
          include: {
            user: { include: { profile: true } },
            plan: true,
            coupon: true,
            subscription: true,
          },
        },
      },
    });
    if (!invoice) {
      throw new AppException(HttpStatus.NOT_FOUND, 'INVOICE_NOT_FOUND');
    }
    return invoice;
  }

  /** The stored PDF, or (without file storage) one rebuilt from the database. */
  private async pdfOf(invoice: Awaited<ReturnType<InvoicesService['find']>>) {
    if (invoice.pdfKey && this.r2.isConfigured) {
      return this.r2.getObject(invoice.pdfKey);
    }
    const { payment } = invoice;
    return this.render(invoice.invoiceNo, invoice.issuedAt, {
      payment,
      periodStart: payment.subscription.startsAt ?? invoice.issuedAt,
      periodEnd: payment.subscription.endsAt ?? invoice.issuedAt,
    });
  }

  /** A link to the invoice PDF: signed R2 URL, or our own PDF endpoint. */
  async downloadUrl(auth: AuthUser, invoiceId: string) {
    const invoice = await this.find(auth, invoiceId);
    const url =
      invoice.pdfKey && this.r2.isConfigured
        ? await this.r2.getDownloadUrl(invoice.pdfKey)
        : `/api/invoices/${invoice.id}/pdf`;
    return { invoiceNo: invoice.invoiceNo, url };
  }

  /** The PDF bytes, for the /invoices/:id/pdf endpoint. */
  async pdf(auth: AuthUser, invoiceId: string) {
    const invoice = await this.find(auth, invoiceId);
    return { invoiceNo: invoice.invoiceNo, pdf: await this.pdfOf(invoice) };
  }

  /** Admin: send the stored PDF again (e.g. if the first email failed). */
  async resend(auth: AuthUser, invoiceId: string, ip: string | null) {
    const invoice = await this.find(auth, invoiceId);
    const pdf = await this.pdfOf(invoice);
    const { user } = invoice.payment;
    const sent = await this.email(
      invoice,
      { email: user.email, name: user.profile?.fullName ?? '' },
      pdf,
    );
    await this.audit.log({
      actorId: auth.id,
      action: 'invoice.resent',
      targetType: 'invoice',
      targetId: invoice.id,
      metadata: { invoiceNo: invoice.invoiceNo, sent },
      ip,
    });
    return { sent };
  }
}
