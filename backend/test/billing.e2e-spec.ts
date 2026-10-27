/**
 * Phase 3 acceptance checks, run against the real database (docker compose up -d).
 * Run: npm run test:e2e
 */
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Role, SubscriptionStatus } from '@prisma/client';
import cookieParser from 'cookie-parser';
import { hash } from 'bcryptjs';
import { authenticator } from 'otplib';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import TestAgent from 'supertest/lib/agent';
import { AppModule } from '../src/app.module';
import { addDays } from '../src/billing/pricing';
import { RemindersService } from '../src/billing/reminders.service';
import { MailService } from '../src/mail/mail.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { RateLimitService } from '../src/rate-limit/rate-limit.service';
import { R2Service } from '../src/storage/r2.service';

const PASSWORD = 'Secret123pass';
const run = randomUUID().slice(0, 8);
const email = (name: string) => `${name}.${run}@test.logiclab.pk`;
const today = () => new Date().toISOString().slice(0, 10);

class FakeMail {
  invoices: { to: string; invoiceNo: string; pdf: Buffer }[] = [];
  rejections: { to: string; reason: string }[] = [];
  reminders: { to: string; days: number }[] = [];
  sendVerificationCode() {
    return Promise.resolve(true);
  }
  sendPasswordReset() {
    return Promise.resolve(true);
  }
  sendInvoice(to: string, _name: string, invoiceNo: string, pdf: Buffer) {
    this.invoices.push({ to, invoiceNo, pdf });
    return Promise.resolve(true);
  }
  sendPaymentRejected(to: string, _name: string, reason: string) {
    this.rejections.push({ to, reason });
    return Promise.resolve(true);
  }
  sendExpiryReminder(to: string, _name: string, days: number) {
    this.reminders.push({ to, days });
    return Promise.resolve(true);
  }
}

describe('Phase 3: free trial, payments and invoices', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let admin: TestAgent;
  const mail = new FakeMail();
  const uploaded = new Set<string>();
  const stored = new Map<string, Uint8Array>();

  const fixtures = {
    trackA: '',
    trackB: '',
    lessonA: '',
    lessonB: '',
    planId: '',
    couponCode: `SAVE10${run}`.toUpperCase(),
  };

  async function createUser(address: string, role: Role = Role.student) {
    return prisma.asAdmin(Role.super_admin, async (tx) => {
      const u = await tx.user.create({
        data: {
          email: address,
          passwordHash: await hash(PASSWORD, 4),
          emailVerifiedAt: new Date(),
        },
      });
      await tx.profile.update({
        where: { id: u.id },
        data: { role, fullName: 'Test Person' },
      });
      return u.id;
    });
  }

  async function login(address: string) {
    const a = request.agent(app.getHttpServer());
    const res = await a
      .post('/auth/login')
      .send({ email: address, password: PASSWORD })
      .expect(200);
    if (res.body.mfa === 'setup') {
      const setup = await a.post('/auth/mfa/setup').expect(201);
      await a
        .post('/auth/mfa/enable')
        .send({ code: authenticator.generate(setup.body.secret as string) })
        .expect(200);
    }
    return a;
  }

  async function newStudent(name: string) {
    const id = await createUser(email(name));
    return { id, agent: await login(email(name)) };
  }

  /** Gets an upload URL and pretends the browser PUT the file to R2. */
  async function uploadSlip(student: TestAgent) {
    const res = await student
      .post('/student/payments/upload-url')
      .send({ contentType: 'image/jpeg', size: 200_000 })
      .expect(201);
    const key = res.body.key as string;
    uploaded.add(key);
    return key;
  }

  async function createPublishedCourse(trackId: string, label: string) {
    const course = await admin
      .post('/admin/content/courses')
      .send({ trackId, title: `${label} ${run}`, isPublished: true })
      .expect(201);
    const mod = await admin
      .post(`/admin/content/courses/${course.body.id}/modules`)
      .send({ title: 'Module 1', isPublished: true })
      .expect(201);
    const lesson = await admin
      .post(`/admin/content/modules/${mod.body.id}/lessons`)
      .send({
        title: `${label} lesson`,
        type: 'article',
        isPublished: true,
        content: {
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: 'Secret content' }],
            },
          ],
        },
      })
      .expect(201);
    return lesson.body.id as string;
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(MailService)
      .useValue(mail)
      .overrideProvider(RateLimitService)
      .useValue({ consume: () => Promise.resolve() })
      .compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    await app.init();
    prisma = app.get(PrismaService);

    // No network calls to R2: uploads and stored PDFs live in memory.
    const r2 = app.get(R2Service);
    jest
      .spyOn(r2, 'exists')
      .mockImplementation((key) => Promise.resolve(uploaded.has(key)));
    jest.spyOn(r2, 'putObject').mockImplementation((key, body) => {
      stored.set(key, body);
      return Promise.resolve();
    });

    await createUser(email('admin'), Role.super_admin);
    admin = await login(email('admin'));

    const trackA = await admin
      .post('/admin/content/tracks')
      .send({ title: `Track A ${run}`, isPublished: true })
      .expect(201);
    const trackB = await admin
      .post('/admin/content/tracks')
      .send({ title: `Track B ${run}`, isPublished: true })
      .expect(201);
    fixtures.trackA = trackA.body.id;
    fixtures.trackB = trackB.body.id;
    fixtures.lessonA = await createPublishedCourse(fixtures.trackA, 'Course A');
    fixtures.lessonB = await createPublishedCourse(fixtures.trackB, 'Course B');

    const plan = await admin
      .post('/admin/billing/plans')
      .send({
        name: `Monthly A+B ${run}`,
        pricePkr: 3000,
        durationDays: 30,
        trackIds: [fixtures.trackA, fixtures.trackB],
      })
      .expect(201);
    fixtures.planId = plan.body.id;
    await admin
      .post('/admin/billing/coupons')
      .send({
        code: fixtures.couponCode.toLowerCase(),
        discountType: 'percent',
        discountValue: 10,
        planIds: [fixtures.planId],
      })
      .expect(201);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('free trial', () => {
    it('a new student gets 7 days on one track, then sees the paywall', async () => {
      const { id, agent } = await newStudent('trial');

      const before = await agent.get('/student/billing').expect(200);
      expect(before.body.needsTrackChoice).toBe(true);
      expect(before.body.hasAccess).toBe(false);
      const blocked = await agent
        .get(`/learn/lessons/${fixtures.lessonA}`)
        .expect(403);
      expect(blocked.body.code).toBe('SUBSCRIPTION_REQUIRED');
      expect(blocked.body.paywallUrl).toBe('/student/billing');

      const trial = await agent
        .post('/student/trial')
        .send({ trackId: fixtures.trackA })
        .expect(201);
      expect(trial.body.status).toBe('trial');
      const days =
        (Date.parse(trial.body.endsAt as string) -
          Date.parse(trial.body.startsAt as string)) /
        86_400_000;
      expect(days).toBe(7);

      const lesson = await agent
        .get(`/learn/lessons/${fixtures.lessonA}`)
        .expect(200);
      expect(JSON.stringify(lesson.body.content)).toContain('Secret content');
      // Trial covers only the chosen track.
      await agent.get(`/learn/lessons/${fixtures.lessonB}`).expect(403);

      const again = await agent
        .post('/student/trial')
        .send({ trackId: fixtures.trackB })
        .expect(409);
      expect(again.body.code).toBe('TRIAL_ALREADY_USED');

      // 7 days later...
      await prisma.subscription.updateMany({
        where: { userId: id },
        data: { endsAt: new Date(Date.now() - 1000) },
      });
      await agent.get(`/learn/lessons/${fixtures.lessonA}`).expect(403);
      await app.get(RemindersService).run();
      const sub = await prisma.subscription.findFirstOrThrow({
        where: { userId: id },
      });
      expect(sub.status).toBe(SubscriptionStatus.expired);
    });

    it('only one trial per email, even with Gmail dots and +aliases', async () => {
      const first = `trial.${run}@gmail.com`;
      const second = `trial${run}+again@gmail.com`;
      await createUser(first);
      await createUser(second);
      const a = await login(first);
      const b = await login(second);
      await a
        .post('/student/trial')
        .send({ trackId: fixtures.trackA })
        .expect(201);
      const res = await b
        .post('/student/trial')
        .send({ trackId: fixtures.trackA })
        .expect(409);
      expect(res.body.code).toBe('TRIAL_ALREADY_USED');
      expect(
        (await b.get('/student/billing').expect(200)).body.canStartTrial,
      ).toBe(false);
    });
  });

  describe('payment by slip, approval and invoice', () => {
    let payer: { id: string; agent: TestAgent };
    let other: { id: string; agent: TestAgent };
    let paymentId: string;
    let invoiceId: string;
    let invoiceNo: string;
    const txn = `EP ${run} 001`;

    beforeAll(async () => {
      payer = await newStudent('payer');
      other = await newStudent('other');
    });

    it('quotes the price with a coupon', async () => {
      const q = await payer.agent
        .post('/student/billing/quote')
        .send({
          planId: fixtures.planId,
          couponCode: fixtures.couponCode.toLowerCase(),
        })
        .expect(200);
      expect(q.body).toMatchObject({
        pricePkr: 3000,
        discount: 300,
        total: 2700,
      });
      await payer.agent
        .post('/student/billing/quote')
        .send({ planId: fixtures.planId, couponCode: 'NOPE' })
        .expect(400);
    });

    it('validates the slip upload', async () => {
      await payer.agent
        .post('/student/payments/upload-url')
        .send({ contentType: 'image/gif', size: 1000 })
        .expect(400);
      await payer.agent
        .post('/student/payments/upload-url')
        .send({ contentType: 'application/pdf', size: 6 * 1024 * 1024 })
        .expect(400);
      const res = await payer.agent
        .post('/student/payments/upload-url')
        .send({ contentType: 'application/pdf', size: 1000 })
        .expect(201);
      expect(res.body.key).toMatch(new RegExp(`^slips/${payer.id}/`));

      // Never uploaded, or someone else's key.
      const notUploaded = await payer.agent
        .post('/student/payments')
        .send({
          planId: fixtures.planId,
          method: 'easypaisa',
          transactionId: 'X1234',
          amount: 3000,
          paidAt: today(),
          slipKey: res.body.key,
        })
        .expect(400);
      expect(notUploaded.body.code).toBe('SLIP_NOT_UPLOADED');
      const othersKey = await uploadSlip(other.agent);
      await payer.agent
        .post('/student/payments')
        .send({
          planId: fixtures.planId,
          method: 'easypaisa',
          transactionId: 'X1234',
          amount: 3000,
          paidAt: today(),
          slipKey: othersKey,
        })
        .expect(400);
    });

    it('submits a payment for review', async () => {
      const slipKey = await uploadSlip(payer.agent);
      const res = await payer.agent
        .post('/student/payments')
        .send({
          planId: fixtures.planId,
          couponCode: fixtures.couponCode,
          method: 'easypaisa',
          transactionId: txn,
          amount: 2700,
          paidAt: today(),
          slipKey,
          ocrText: `Easypaisa\nTID: ${txn.replaceAll(' ', '')}\nAmount Rs 2,700.00`,
        })
        .expect(201);
      paymentId = res.body.id;
      expect(res.body).toMatchObject({
        status: 'pending',
        expectedAmount: 2700,
      });

      const slip1 = await uploadSlip(payer.agent);
      const second = await payer.agent
        .post('/student/payments')
        .send({
          planId: fixtures.planId,
          method: 'jazzcash',
          transactionId: `${run}999`,
          amount: 3000,
          paidAt: today(),
          slipKey: slip1,
        })
        .expect(409);
      expect(second.body.code).toBe('PAYMENT_ALREADY_PENDING');
    });

    it('the same transaction ID cannot be submitted twice', async () => {
      const slip2 = await uploadSlip(other.agent);
      const res = await other.agent
        .post('/student/payments')
        .send({
          planId: fixtures.planId,
          method: 'easypaisa',
          transactionId: txn.toLowerCase().replaceAll(' ', ''), // same ID, different format
          amount: 3000,
          paidAt: today(),
          slipKey: slip2,
        })
        .expect(409);
      expect(res.body.code).toBe('DUPLICATE_TRANSACTION_ID');
    });

    it('admin sees the payment in the queue with OCR checks and the slip', async () => {
      const queue = await admin
        .get('/admin/payments')
        .query({ status: 'pending' })
        .expect(200);
      const item = queue.body.items.find(
        (p: { id: string }) => p.id === paymentId,
      );
      expect(item.warnings).toEqual([]);
      expect(item.ocrText).toBeUndefined();

      const detail = await admin
        .get(`/admin/payments/${paymentId}`)
        .expect(200);
      expect(detail.body.slipUrl).toMatch(/X-Amz-Signature=/);
      expect(detail.body.ocrText).toContain('2,700');
      expect(detail.body.user.email).toBe(email('payer'));
    });

    it('approval activates access, issues the invoice and emails the PDF', async () => {
      await payer.agent.get(`/learn/lessons/${fixtures.lessonA}`).expect(403);

      const res = await admin
        .post(`/admin/payments/${paymentId}/approve`)
        .expect(200);
      expect(res.body.status).toBe('approved');
      expect(res.body.emailed).toBe(true);
      invoiceNo = res.body.invoice.invoiceNo;
      invoiceId = res.body.invoice.id;
      expect(invoiceNo).toMatch(/^INV-\d{4}-\d{5}$/);

      const sent = mail.invoices.find((m) => m.invoiceNo === invoiceNo)!;
      expect(sent.to).toBe(email('payer'));
      expect(sent.pdf.subarray(0, 5).toString()).toBe('%PDF-');
      expect(stored.has(`invoices/${payer.id}/${invoiceNo}.pdf`)).toBe(true);

      await payer.agent.get(`/learn/lessons/${fixtures.lessonA}`).expect(200);
      await payer.agent.get(`/learn/lessons/${fixtures.lessonB}`).expect(200);

      const coupon = await prisma.coupon.findUniqueOrThrow({
        where: { code: fixtures.couponCode },
      });
      expect(coupon.redeemedCount).toBe(1);

      const logs = await admin
        .get('/admin/audit-logs')
        .query({ targetId: paymentId })
        .expect(200);
      expect(logs.body[0].action).toBe('payment.approved');

      const again = await admin
        .post(`/admin/payments/${paymentId}/approve`)
        .expect(409);
      expect(again.body.code).toBe('PAYMENT_ALREADY_REVIEWED');
    });

    it('billing history shows the invoice and the student can download it', async () => {
      const billing = await payer.agent.get('/student/billing').expect(200);
      expect(billing.body.hasAccess).toBe(true);
      expect(billing.body.payments[0].invoice.invoiceNo).toBe(invoiceNo);
      const dl = await payer.agent
        .get(`/student/invoices/${invoiceId}/download`)
        .expect(200);
      expect(dl.body.url).toContain(
        encodeURIComponent(invoiceNo).replace(/%2F/g, '/'),
      );
    });

    it("a student cannot see another student's slip or invoice", async () => {
      const inv = await other.agent
        .get(`/student/invoices/${invoiceId}/download`)
        .expect(404);
      expect(inv.body.code).toBe('INVOICE_NOT_FOUND');
      await other.agent.get(`/student/payments/${paymentId}/slip`).expect(404);
      await payer.agent.get(`/student/payments/${paymentId}/slip`).expect(200);
      await other.agent.get('/admin/payments').expect(403);
    });

    it('rejection emails the reason; the student re-uploads; the next invoice number follows', async () => {
      const ocrTxn = `JC${run}777`.toUpperCase();
      const slip3 = await uploadSlip(other.agent);
      const first = await other.agent
        .post('/student/payments')
        .send({
          planId: fixtures.planId,
          method: 'jazzcash',
          transactionId: ocrTxn,
          amount: 2000, // wrong amount
          paidAt: today(),
          slipKey: slip3,
          ocrText: 'blurry text',
        })
        .expect(201);

      const detail = await admin
        .get(`/admin/payments/${first.body.id}`)
        .expect(200);
      expect(detail.body.warnings).toHaveLength(3); // amount differs, not found, ID not found

      await admin
        .post(`/admin/payments/${first.body.id}/reject`)
        .send({})
        .expect(400);
      await admin
        .post(`/admin/payments/${first.body.id}/reject`)
        .send({ reason: 'Amount does not match the plan price' })
        .expect(200);
      expect(mail.rejections).toContainEqual({
        to: email('other'),
        reason: 'Amount does not match the plan price',
      });
      await other.agent.get(`/learn/lessons/${fixtures.lessonA}`).expect(403);

      // Same transaction ID is allowed again for the same student after a rejection.
      const slip4 = await uploadSlip(other.agent);
      const retry = await other.agent
        .post('/student/payments')
        .send({
          planId: fixtures.planId,
          method: 'jazzcash',
          transactionId: ocrTxn,
          amount: 3000,
          paidAt: today(),
          slipKey: slip4,
        })
        .expect(201);
      expect(retry.body.id).toBe(first.body.id);

      const approved = await admin
        .post(`/admin/payments/${retry.body.id}/approve`)
        .expect(200);
      const [, year, n] = /^INV-(\d{4})-(\d{5})$/.exec(invoiceNo)!;
      const next = approved.body.invoice.invoiceNo as string;
      expect(next.startsWith(`INV-${year}-`)).toBe(true);
      expect(Number(next.slice(-5))).toBeGreaterThan(Number(n));
    });
  });

  describe('expiry reminders', () => {
    it('sends 3-day and 1-day reminders once each', async () => {
      const { id } = await newStudent('expiring');
      const now = new Date();
      const sub = await prisma.subscription.create({
        data: {
          userId: id,
          status: SubscriptionStatus.active,
          planId: fixtures.planId,
          trackIds: [fixtures.trackA],
          startsAt: addDays(now, -28),
          endsAt: addDays(now, 2),
        },
      });
      const reminders = app.get(RemindersService);
      const mine = () =>
        mail.reminders.filter((r) => r.to === email('expiring'));

      await reminders.run(now);
      await reminders.run(now);
      expect(mine()).toEqual([{ to: email('expiring'), days: 3 }]);

      await reminders.run(addDays(now, 1.5)); // half a day left
      expect(mine().map((r) => r.days)).toEqual([3, 1]);

      await reminders.run(addDays(now, 3));
      const after = await prisma.subscription.findUniqueOrThrow({
        where: { id: sub.id },
      });
      expect(after.status).toBe(SubscriptionStatus.expired);
    });
  });

  describe('admin settings', () => {
    it('payment instructions are editable and shown on the billing page', async () => {
      const original = (
        await admin.get('/admin/settings/payment_instructions').expect(200)
      ).body;
      const instructions = {
        easypaisa: { accountTitle: 'LogicLab', number: '0345-1234567' },
        jazzcash: null,
        bank: {
          bankName: 'Meezan Bank',
          accountTitle: 'LogicLab',
          iban: 'pk36 mezn 0001 2345 6789 0123',
        },
        note: 'Write your email in the payment remarks.',
      };
      const saved = await admin
        .put('/admin/settings/payment_instructions')
        .send(instructions)
        .expect(200);
      expect(saved.body.bank.iban).toBe('PK36MEZN0001234567890123');

      const { agent } = await newStudent('settings');
      const billing = await agent.get('/student/billing').expect(200);
      expect(billing.body.paymentInstructions.easypaisa.number).toBe(
        '0345-1234567',
      );

      await admin
        .put('/admin/settings/payment_instructions')
        .send({ ...instructions, bank: { ...instructions.bank, iban: '123' } })
        .expect(400);
      await admin
        .put('/admin/settings/payment_instructions')
        .send(original)
        .expect(200);
    });
  });
});
