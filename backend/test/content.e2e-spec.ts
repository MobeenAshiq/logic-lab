/**
 * Phase 2 acceptance checks, run against the real database (docker compose up -d).
 * Run: npm run test:e2e
 */
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Role } from '@prisma/client';
import cookieParser from 'cookie-parser';
import { hash } from 'bcryptjs';
import { authenticator } from 'otplib';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import TestAgent from 'supertest/lib/agent';
import { AppModule } from '../src/app.module';
import { MailService } from '../src/mail/mail.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { RateLimitService } from '../src/rate-limit/rate-limit.service';

const PASSWORD = 'Secret123pass';
const run = randomUUID().slice(0, 8);
const email = (name: string) => `${name}.${run}@test.logiclab.pk`;
const imageKey = `content/lesson-image/${randomUUID()}.png`;

describe('Phase 2: CMS and course structure', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let admin: TestAgent;
  const codes = new Map<string, string>();

  const agent = () => request.agent(app.getHttpServer());

  async function createUser(address: string, role: Role) {
    return prisma.asAdmin(Role.super_admin, async (tx) => {
      const u = await tx.user.create({
        data: {
          email: address,
          passwordHash: await hash(PASSWORD, 4),
          emailVerifiedAt: new Date(),
        },
      });
      await tx.profile.update({ where: { id: u.id }, data: { role } });
      return u.id;
    });
  }

  async function login(address: string) {
    const a = agent();
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

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(MailService)
      .useValue({
        sendVerificationCode: (to: string, _n: string, code: string) => {
          codes.set(to, code);
          return Promise.resolve();
        },
        sendPasswordReset: () => Promise.resolve(),
      })
      .overrideProvider(RateLimitService)
      .useValue({ consume: () => Promise.resolve() })
      .compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    await app.init();
    prisma = app.get(PrismaService);

    await createUser(email('super'), Role.super_admin);
    admin = await login(email('super'));
  });

  afterAll(async () => {
    await app.close();
  });

  it('only admins can use the CMS', async () => {
    await agent().get('/admin/content/tracks').expect(401);
    await createUser(email('student'), Role.student);
    const student = await login(email('student'));
    const res = await student.get('/admin/content/tracks').expect(403);
    expect(res.body.code).toBe('FORBIDDEN_ROLE');
    await student.post('/admin/uploads').send({}).expect(403);
  });

  describe('admin builds a course and publishes it to the catalog', () => {
    let trackSlug: string;
    let courseId: string;
    let courseSlug: string;
    let m1: string;
    let m2: string;
    let article: string;
    let video: string;

    it('creates a track, a course, modules and lessons', async () => {
      const track = await admin
        .post('/admin/content/tracks')
        .send({ title: `Test Track ${run}`, isPublished: true })
        .expect(201);
      trackSlug = track.body.slug;
      expect(trackSlug).toBe(`test-track-${run}`);

      const course = await admin
        .post('/admin/content/courses')
        .send({
          trackId: track.body.id,
          title: `Intro to Loops ${run}`,
          shortDescription: 'for, while and do-while',
          level: 'beginner',
        })
        .expect(201);
      courseId = course.body.id;
      courseSlug = course.body.slug;
      expect(course.body.isPublished).toBe(false);

      m1 = (
        await admin
          .post(`/admin/content/courses/${courseId}/modules`)
          .send({ title: 'Basics' })
          .expect(201)
      ).body.id;
      m2 = (
        await admin
          .post(`/admin/content/courses/${courseId}/modules`)
          .send({ title: 'Nested loops', unlockAfterModuleId: m1 })
          .expect(201)
      ).body.id;

      const created = await admin
        .post(`/admin/content/modules/${m1}/lessons`)
        .send({
          title: 'What is a loop?',
          type: 'article',
          content: {
            type: 'doc',
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: 'A loop repeats code.' }],
              },
              {
                type: 'codeBlock',
                attrs: { language: 'python' },
                content: [
                  { type: 'text', text: 'for i in range(3): print(i)' },
                ],
              },
              { type: 'image', attrs: { key: imageKey, alt: 'diagram' } },
            ],
          },
        })
        .expect(201);
      article = created.body.id;
      expect(created.body.assetUrls[imageKey]).toMatch(/X-Amz-Signature=/);

      video = (
        await admin
          .post(`/admin/content/modules/${m1}/lessons`)
          .send({ title: 'Loop demo', type: 'video', durationSeconds: 300 })
          .expect(201)
      ).body.id;
    });

    it('unpublished content is not in the public catalog', async () => {
      await agent().get(`/courses/${courseSlug}`).expect(404);
      const list = await agent()
        .get('/courses')
        .query({ track: trackSlug })
        .expect(200);
      expect(list.body).toHaveLength(0);
    });

    it('after publishing, the course appears with published modules and lesson titles only', async () => {
      await admin
        .patch(`/admin/content/courses/${courseId}`)
        .send({ isPublished: true })
        .expect(200);
      await admin
        .patch(`/admin/content/modules/${m1}`)
        .send({ isPublished: true })
        .expect(200);
      await admin
        .patch(`/admin/content/lessons/${article}`)
        .send({ isPublished: true })
        .expect(200);

      const list = await agent()
        .get('/courses')
        .query({ track: trackSlug })
        .expect(200);
      expect(list.body.map((c: { slug: string }) => c.slug)).toEqual([
        courseSlug,
      ]);

      const detail = await agent().get(`/courses/${courseSlug}`).expect(200);
      expect(detail.body.modules).toHaveLength(1); // m2 is unpublished
      const lessons = detail.body.modules[0].lessons;
      expect(lessons).toEqual([
        {
          id: article,
          title: 'What is a loop?',
          type: 'article',
          position: 1,
          durationSeconds: null,
        },
      ]); // video is unpublished; no content field
    });

    it('reorders modules and lessons (drag and drop)', async () => {
      const res = await admin
        .put(`/admin/content/courses/${courseId}/modules/order`)
        .send({ ids: [m2, m1] })
        .expect(200);
      expect(res.body.map((m: { id: string }) => m.id)).toEqual([m2, m1]);

      const bad = await admin
        .put(`/admin/content/courses/${courseId}/modules/order`)
        .send({ ids: [m1] })
        .expect(400);
      expect(bad.body.code).toBe('INVALID_ORDER');

      const lessons = await admin
        .put(`/admin/content/modules/${m1}/lessons/order`)
        .send({ ids: [video, article] })
        .expect(200);
      expect(lessons.body.map((l: { id: string }) => l.id)).toEqual([
        video,
        article,
      ]);
    });

    it('rejects unlock loops and invalid lesson content', async () => {
      const loop = await admin
        .patch(`/admin/content/modules/${m1}`)
        .send({ unlockAfterModuleId: m2 })
        .expect(400);
      expect(loop.body.code).toBe('INVALID_UNLOCK_MODULE');

      await admin
        .patch(`/admin/content/lessons/${video}`)
        .send({ content: { type: 'doc', content: [] } })
        .expect(400); // only articles have content

      await admin
        .post(`/admin/content/modules/${m1}/lessons`)
        .send({
          title: 'Bad image',
          type: 'article',
          content: {
            type: 'doc',
            content: [
              { type: 'image', attrs: { src: 'https://evil.example/x.png' } },
            ],
          },
        })
        .expect(400);
    });

    it('published items must be unpublished before deleting', async () => {
      const res = await admin
        .delete(`/admin/content/courses/${courseId}`)
        .expect(409);
      expect(res.body.code).toBe('UNPUBLISH_BEFORE_DELETE');
      await admin.delete(`/admin/content/lessons/${video}`).expect(204);
    });

    it('assigns mentors to courses; only mentors can be assigned', async () => {
      const studentId = await createUser(email('notmentor'), Role.student);
      const notMentor = await admin
        .post(`/admin/content/courses/${courseId}/mentors`)
        .send({ mentorId: studentId })
        .expect(400);
      expect(notMentor.body.code).toBe('NOT_A_MENTOR');

      const mentorId = await createUser(email('mentor'), Role.mentor);
      const course = await admin
        .post(`/admin/content/courses/${courseId}/mentors`)
        .send({ mentorId })
        .expect(201);
      expect(course.body.mentors.map((m: { id: string }) => m.id)).toEqual([
        mentorId,
      ]);

      const logs = await admin
        .get('/admin/audit-logs')
        .query({ targetId: courseId })
        .expect(200);
      expect(logs.body[0].action).toBe('course.mentor_assigned');

      // No longer a mentor -> no longer assigned.
      await admin
        .patch(`/admin/users/${mentorId}/role`)
        .send({ role: 'student', reason: 'left the team' })
        .expect(200);
      const after = await admin
        .get(`/admin/content/courses/${courseId}`)
        .expect(200);
      expect(after.body.mentors).toEqual([]);
    });
  });

  describe('landing page CMS', () => {
    let originalHero: object;

    beforeAll(async () => {
      originalHero = (await admin.get('/admin/content/site').expect(200)).body
        .hero;
    });

    afterAll(async () => {
      await admin
        .put('/admin/content/site/hero')
        .send(originalHero)
        .expect(200);
    });

    it('changing hero text in the CMS updates the landing page', async () => {
      const hero = {
        title: `Learn logic ${run}`,
        subtitle: 'Now with mentors',
        ctaText: 'Start free',
        ctaHref: '/signup',
      };
      await admin.put('/admin/content/site/hero').send(hero).expect(200);
      const page = await agent().get('/site-content').expect(200);
      expect(page.body.hero).toEqual(hero);
    });

    it('validates blocks and blocks unsafe links', async () => {
      await admin
        .put('/admin/content/site/hero')
        .send({
          title: 'x',
          subtitle: '',
          ctaText: 'Go',
          ctaHref: 'javascript:alert(1)',
        })
        .expect(400);
      await admin.put('/admin/content/site/unknown').send({}).expect(404);
    });

    it('only shows active banners inside their date window', async () => {
      const original = (await admin.get('/admin/content/site').expect(200)).body
        .banners;
      const banner = {
        href: null,
        variant: 'promo',
        startsAt: null,
        endsAt: null,
      };
      await admin
        .put('/admin/content/site/banners')
        .send({
          items: [
            { ...banner, id: 'on', text: 'Live', active: true },
            { ...banner, id: 'off', text: 'Hidden', active: false },
            {
              ...banner,
              id: 'old',
              text: 'Expired',
              active: true,
              endsAt: '2020-01-01T00:00:00Z',
            },
          ],
        })
        .expect(200);
      const page = await agent().get('/site-content').expect(200);
      expect(page.body.banners.items.map((b: { id: string }) => b.id)).toEqual([
        'on',
      ]);
      await admin.put('/admin/content/site/banners').send(original).expect(200);
    });
  });

  describe('uploads to R2', () => {
    it('returns a presigned PUT URL for allowed images', async () => {
      const res = await admin
        .post('/admin/uploads')
        .send({ purpose: 'lesson-image', contentType: 'image/png', size: 1024 })
        .expect(201);
      expect(res.body.key).toMatch(
        /^content\/lesson-image\/[0-9a-f-]{36}\.png$/,
      );
      expect(res.body.uploadUrl).toMatch(/X-Amz-Expires=600/);
    });

    it('rejects wrong types and files over 5 MB', async () => {
      await admin
        .post('/admin/uploads')
        .send({
          purpose: 'lesson-image',
          contentType: 'application/pdf',
          size: 1024,
        })
        .expect(400);
      await admin
        .post('/admin/uploads')
        .send({
          purpose: 'course-cover',
          contentType: 'image/png',
          size: 6 * 1024 * 1024,
        })
        .expect(400);
    });
  });

  describe('user management', () => {
    it('requires a reason and filters by role and search', async () => {
      const id = await createUser(email('managed'), Role.student);
      await admin
        .patch(`/admin/users/${id}/role`)
        .send({ role: 'mentor' })
        .expect(400);
      await admin
        .patch(`/admin/users/${id}/role`)
        .send({ role: 'mentor', reason: 'new hire' })
        .expect(200);

      const res = await admin
        .get('/admin/users')
        .query({ role: 'mentor', search: `managed.${run}` })
        .expect(200);
      expect(res.body.items.map((u: { id: string }) => u.id)).toEqual([id]);
    });
  });
});
