/**
 * Phase 1 acceptance checks, run against the real database (docker compose up -d).
 * Run: npm run test:e2e
 */
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { Role } from '@prisma/client';
import cookieParser from 'cookie-parser';
import { authenticator } from 'otplib';
import { hash } from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { Env } from '../src/config/env';
import { MailService } from '../src/mail/mail.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { RateLimitService } from '../src/rate-limit/rate-limit.service';

class FakeMail {
  codes = new Map<string, string>();
  resetLinks = new Map<string, string>();
  sendVerificationCode(to: string, _name: string, code: string) {
    this.codes.set(to, code);
    return Promise.resolve();
  }
  sendPasswordReset(to: string, _name: string, link: string) {
    this.resetLinks.set(to, link);
    return Promise.resolve();
  }
}

/** Real limiter, but off by default so the other tests don't trip it. */
class ToggleRateLimit extends RateLimitService {
  enabled = false;
  consume(keys: string[]) {
    return this.enabled ? super.consume(keys) : Promise.resolve();
  }
}

const PASSWORD = 'Secret123pass';
const run = randomUUID().slice(0, 8);
const email = (name: string) => `${name}.${run}@test.logiclab.pk`;

describe('Phase 1: authentication and roles', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const mail = new FakeMail();
  let limiter: ToggleRateLimit;

  const agent = () => request.agent(app.getHttpServer());

  async function signupAndVerify(address: string) {
    const a = agent();
    await a
      .post('/auth/signup')
      .send({ email: address, password: PASSWORD, fullName: 'Test User' })
      .expect(201);
    await a
      .post('/auth/verify-email')
      .send({ email: address, code: mail.codes.get(address) })
      .expect(200);
    const user = await prisma.user.findUniqueOrThrow({
      where: { email: address },
    });
    return { agent: a, id: user.id };
  }

  async function login(address: string, userAgent = 'jest') {
    const a = agent();
    const res = await a
      .post('/auth/login')
      .set('User-Agent', userAgent)
      .send({ email: address, password: PASSWORD });
    return { agent: a, res };
  }

  async function createAdmin(address: string, role: Role) {
    await prisma.asAdmin(Role.super_admin, async (tx) => {
      const u = await tx.user.create({
        data: {
          email: address,
          passwordHash: await hash(PASSWORD, 4),
          emailVerifiedAt: new Date(),
        },
      });
      await tx.profile.update({ where: { id: u.id }, data: { role } });
    });
  }

  /** Logs in a mentor/admin and completes 2FA setup. */
  async function loginWithMfa(address: string) {
    const { agent: a, res } = await login(address);
    expect(res.body.mfa).toBe('setup');
    const setup = await a.post('/auth/mfa/setup').expect(201);
    const secret = setup.body.secret as string;
    await a
      .post('/auth/mfa/enable')
      .send({ code: authenticator.generate(secret) })
      .expect(200);
    return a;
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(MailService)
      .useValue(mail)
      .overrideProvider(RateLimitService)
      .useFactory({
        factory: (config: ConfigService<Env, true>) =>
          new ToggleRateLimit(config),
        inject: [ConfigService],
      })
      .compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    await app.init();
    prisma = app.get(PrismaService);
    limiter = app.get(RateLimitService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('email signup works, and an unverified email cannot log in', async () => {
    const address = email('unverified');
    await agent()
      .post('/auth/signup')
      .send({ email: address, password: PASSWORD, fullName: 'Ali' })
      .expect(201);

    const { res } = await login(address);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('EMAIL_NOT_VERIFIED');

    await agent()
      .post('/auth/verify-email')
      .send({ email: address, code: '000000' })
      .expect(400);

    const a = agent();
    const verified = await a
      .post('/auth/verify-email')
      .send({ email: address, code: mail.codes.get(address) })
      .expect(200);
    expect(verified.body.user.role).toBe('student');
    expect(verified.body.mfa).toBe('none');
    await a.get('/student/dashboard').expect(200);

    const again = await login(address);
    expect(again.res.status).toBe(200);
  });

  it('a new user gets a student profile from the database trigger', async () => {
    const { id } = await signupAndVerify(email('trigger'));
    const profile = await prisma.profile.findUniqueOrThrow({ where: { id } });
    expect(profile.role).toBe(Role.student);
    expect(profile.fullName).toBe('Test User');
  });

  it('unauthenticated users get 401; a student is blocked from /admin and /mentor', async () => {
    await agent().get('/student/dashboard').expect(401);
    const { agent: a } = await signupAndVerify(email('student'));
    const res = await a.get('/admin/dashboard').expect(403);
    expect(res.body.code).toBe('FORBIDDEN_ROLE');
    await a.get('/mentor/dashboard').expect(403);
    await a.get('/admin/users').expect(403);
  });

  it('a student cannot change their own role, even with a direct call', async () => {
    const { agent: a, id } = await signupAndVerify(email('escalate'));
    const res = await a
      .patch('/me')
      .send({ role: 'admin', reason: 'test' })
      .expect(400);
    expect(res.body.code).toBe('VALIDATION_FAILED');
    await a
      .patch(`/admin/users/${id}/role`)
      .send({ role: 'admin', reason: 'test' })
      .expect(403);

    // Even code that bypasses the API cannot do it without admin context.
    await expect(
      prisma.profile.update({ where: { id }, data: { role: Role.admin } }),
    ).rejects.toThrow(/only admins can change role or status/);

    const profile = await prisma.profile.findUniqueOrThrow({ where: { id } });
    expect(profile.role).toBe(Role.student);
    await a.patch('/me').send({ fullName: 'New Name' }).expect(200);
  });

  it('mentors and admins are forced to set up 2FA, then verify it on each login', async () => {
    const address = email('admin');
    await createAdmin(address, Role.admin);

    const first = await login(address);
    expect(first.res.body.mfa).toBe('setup');
    const blocked = await first.agent.get('/admin/dashboard').expect(403);
    expect(blocked.body.code).toBe('MFA_SETUP_REQUIRED');

    const setup = await first.agent.post('/auth/mfa/setup').expect(201);
    expect(setup.body.qrCodeDataUrl).toMatch(/^data:image\/png;base64,/);
    await first.agent
      .post('/auth/mfa/enable')
      .send({ code: '123456' })
      .expect(400);
    await first.agent
      .post('/auth/mfa/enable')
      .send({ code: authenticator.generate(setup.body.secret as string) })
      .expect(200);
    await first.agent.get('/admin/dashboard').expect(200);

    const second = await login(address);
    expect(second.res.body.mfa).toBe('verify');
    const needsCode = await second.agent.get('/admin/dashboard').expect(403);
    expect(needsCode.body.code).toBe('MFA_VERIFY_REQUIRED');
    await second.agent
      .post('/auth/mfa/verify')
      .send({ code: authenticator.generate(setup.body.secret as string) })
      .expect(200);
    await second.agent.get('/admin/dashboard').expect(200);
  });

  it('a third device login signs out the oldest session', async () => {
    const address = email('devices');
    await signupAndVerify(address); // device 1 (from verify-email)

    const d2 = await login(address, 'device-2');
    const d3 = await login(address, 'device-3');
    expect(d2.res.status).toBe(200);
    expect(d3.res.status).toBe(200);

    const user = await prisma.user.findUniqueOrThrow({
      where: { email: address },
      include: { sessions: { orderBy: { createdAt: 'asc' } } },
    });
    const active = user.sessions.filter((s) => !s.revokedAt);
    expect(active).toHaveLength(2);
    expect(user.sessions[0].revokedReason).toBe('device_limit');

    await d2.agent.get('/me').expect(200);
    await d3.agent.get('/me').expect(200);
  });

  it('the signed-out device gets a clear message', async () => {
    const address = email('devices2');
    const { agent: d1 } = await signupAndVerify(address);
    await login(address, 'device-2');
    await login(address, 'device-3');
    const res = await d1.get('/me').expect(401);
    expect(res.body.code).toBe('SESSION_REVOKED_DEVICE_LIMIT');
  });

  it('admin role change and ban are enforced and written to the audit log', async () => {
    const superAddress = email('super');
    await createAdmin(superAddress, Role.super_admin);
    const admin = await loginWithMfa(superAddress);

    const { agent: student, id } = await signupAndVerify(email('promote'));

    await admin
      .patch(`/admin/users/${id}/role`)
      .send({ role: 'mentor', reason: 'hired' })
      .expect(200);

    // Role change signs the user out; on the next login they must set up 2FA.
    await student.get('/me').expect(401);
    const mentor = await login(email('promote'));
    expect(mentor.res.body.user.role).toBe('mentor');
    expect(mentor.res.body.mfa).toBe('setup');
    await mentor.agent.get('/mentor/dashboard').expect(403);

    await admin
      .patch(`/admin/users/${id}/status`)
      .send({ status: 'banned' })
      .expect(400); // reason required
    await admin
      .patch(`/admin/users/${id}/status`)
      .send({ status: 'banned', reason: 'cheating' })
      .expect(200);

    const banned = await mentor.agent.get('/me').expect(403);
    expect(banned.body.code).toBe('ACCOUNT_BANNED');
    const relogin = await login(email('promote'));
    expect(relogin.res.status).toBe(403);
    expect(relogin.res.body.code).toBe('ACCOUNT_BANNED');
    expect(relogin.res.body.reason).toBe('cheating');

    const logs = await admin
      .get('/admin/audit-logs')
      .query({ targetId: id })
      .expect(200);
    const actions = (logs.body as { action: string }[]).map((l) => l.action);
    expect(actions).toEqual(
      expect.arrayContaining(['user.role_changed', 'user.banned']),
    );
  });

  it('a banned user with a live session is logged out with a message', async () => {
    const { agent: a, id } = await signupAndVerify(email('liveban'));
    await prisma.asAdmin(Role.admin, (tx) =>
      tx.profile.update({
        where: { id },
        data: { status: 'banned', bannedReason: 'spam' },
      }),
    );
    const res = await a.get('/me').expect(403);
    expect(res.body.code).toBe('ACCOUNT_BANNED');
    expect(res.body.reason).toBe('spam');
    expect(res.headers['set-cookie']).toEqual(
      expect.arrayContaining([expect.stringMatching(/^ll_access=;/)]),
    );
  });

  it('audit_logs is insert-only', async () => {
    await expect(
      prisma.auditLog.updateMany({ data: { action: 'tampered' } }),
    ).rejects.toThrow(/insert-only/);
    await expect(prisma.auditLog.deleteMany({})).rejects.toThrow(/insert-only/);
  });

  it('forgot and reset password works and signs out other sessions', async () => {
    const address = email('reset');
    const { agent: old } = await signupAndVerify(address);
    await agent()
      .post('/auth/forgot-password')
      .send({ email: address })
      .expect(200);
    const link = new URL(mail.resetLinks.get(address)!);
    const token = link.searchParams.get('token')!;

    await agent()
      .post('/auth/reset-password')
      .send({ token, password: 'BrandNew456pass' })
      .expect(200);
    await agent()
      .post('/auth/reset-password')
      .send({ token, password: 'Another789pass' })
      .expect(400); // single use

    await old.get('/me').expect(401);
    await agent()
      .post('/auth/login')
      .send({ email: address, password: 'BrandNew456pass' })
      .expect(200);
  });

  it('refresh rotates the token and logout ends the session', async () => {
    const { agent: a } = await signupAndVerify(email('refresh'));
    await a.post('/auth/refresh').expect(200);
    await a.get('/me').expect(200);
    await a.post('/auth/logout').expect(200);
    await a.get('/me').expect(401);
    await a.post('/auth/refresh').expect(401);
  });

  it('rate limits login to 5 attempts per 15 minutes per email', async () => {
    limiter.enabled = true;
    try {
      const address = email('ratelimit');
      for (let i = 0; i < 5; i++) {
        await agent()
          .post('/auth/login')
          .send({ email: address, password: 'wrong-password1' })
          .expect(401);
      }
      const res = await agent()
        .post('/auth/login')
        .send({ email: address, password: 'wrong-password1' })
        .expect(429);
      expect(res.body.code).toBe('RATE_LIMITED');
    } finally {
      limiter.enabled = false;
    }
  });

  it('Google login returns 503 when not configured', async () => {
    await agent().get('/auth/google').expect(503);
  });
});
