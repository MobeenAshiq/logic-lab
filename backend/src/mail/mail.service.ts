import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { Env } from '../config/env';
import { t } from '../common/i18n/en';

export interface MailAttachment {
  filename: string;
  content: Buffer;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly resend: Resend | null;
  private readonly from: string;
  private readonly frontendUrl: string;

  constructor(config: ConfigService<Env, true>) {
    const key = config.get('RESEND_API_KEY', { infer: true });
    this.resend = key ? new Resend(key) : null;
    this.from = config.get('EMAIL_FROM', { infer: true });
    this.frontendUrl = config.get('FRONTEND_URL', { infer: true });
  }

  sendVerificationCode(to: string, name: string, code: string) {
    return this.send(to, t.email.verifySubject, t.email.verifyBody(name, code));
  }

  sendPasswordReset(to: string, name: string, link: string) {
    return this.send(to, t.email.resetSubject, t.email.resetBody(name, link));
  }

  sendInvoice(to: string, name: string, invoiceNo: string, pdf: Buffer) {
    return this.send(
      to,
      t.email.invoiceSubject(invoiceNo),
      t.email.invoiceBody(name, invoiceNo),
      [{ filename: `${invoiceNo}.pdf`, content: pdf }],
    );
  }

  sendPaymentRejected(to: string, name: string, reason: string) {
    return this.send(
      to,
      t.email.paymentRejectedSubject,
      t.email.paymentRejectedBody(
        name,
        reason,
        `${this.frontendUrl}/student/billing`,
      ),
    );
  }

  sendExpiryReminder(to: string, name: string, days: number, endsAt: Date) {
    return this.send(
      to,
      t.email.expirySubject(days),
      t.email.expiryBody(
        name,
        days,
        endsAt,
        `${this.frontendUrl}/student/billing`,
      ),
    );
  }

  /** Generic notification email with a link back into the app. */
  sendNotification(
    to: string,
    subject: string,
    body: string,
    link: string | null,
  ) {
    const url = link ? `${this.frontendUrl}${link}` : this.frontendUrl;
    return this.send(to, subject, `${body}\n\n${t.email.openInApp}: ${url}`);
  }

  /** Returns false if sending failed (never throws), so callers can record it. */
  private async send(
    to: string,
    subject: string,
    text: string,
    attachments: MailAttachment[] = [],
  ): Promise<boolean> {
    if (!this.resend) {
      const files = attachments.map((a) => a.filename).join(', ');
      this.logger.warn(
        `[dev email] to=${to} subject="${subject}"${files ? ` attachments=${files}` : ''}\n${text}`,
      );
      return true;
    }
    const { error } = await this.resend.emails.send({
      from: this.from,
      to,
      subject,
      text,
      attachments,
    });
    if (error) {
      this.logger.error(`Resend failed for ${to}: ${error.message}`);
      return false;
    }
    return true;
  }
}
