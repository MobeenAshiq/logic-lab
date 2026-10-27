/**
 * Phase 4 acceptance checks (videos, progress, Q&A). Runs on the test database.
 * R2 network calls are stubbed; URL signing is real.
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
import { R2Service } from '../src/storage/r2.service';

const PASSWORD = 'Secret123pass';
const run = randomUUID().slice(0, 8);
const email = (name: string) => `${name}.${run}@test.logiclab.pk`;
const MB = 1024 * 1024;

describe('Phase 4: recorded lectures and progress', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let admin: TestAgent;
  let mentor: TestAgent;
  let otherMentor: TestAgent;
  let student: TestAgent;
  let studentId: string;
  let outsider: TestAgent;
  const stored = new Map<string, number>(); // key -> size
  const ids = {
    course: '',
    courseSlug: '',
    m1: '',
    m2: '',
    video: '',
    article: '',
    locked: '',
  };

  async function createUser(address: string, role: Role) {
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
        data: { role, fullName: `${role} ${run}` },
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

  /** Lets the next ping credit up to `seconds` of watch time (the server caps by wall clock). */
  async function pretendTimePassed(lessonId: string, seconds: number) {
    await prisma.lessonProgress.update({
      where: { userId_lessonId: { userId: studentId, lessonId } },
      data: { lastPingAt: new Date(Date.now() - seconds * 1000) },
    });
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(MailService)
      .useValue({})
      .overrideProvider(RateLimitService)
      .useValue({ consume: () => Promise.resolve() })
      .compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    await app.init();
    prisma = app.get(PrismaService);

    const r2 = app.get(R2Service);
    jest.spyOn(r2, 'createMultipartUpload').mockResolvedValue('upload-1');
    jest.spyOn(r2, 'completeMultipartUpload').mockImplementation((key) => {
      stored.set(key, 50 * MB);
      return Promise.resolve();
    });
    jest.spyOn(r2, 'abortMultipartUpload').mockResolvedValue();
    jest.spyOn(r2, 'deleteObject').mockResolvedValue();
    jest
      .spyOn(r2, 'objectSize')
      .mockImplementation((key) => Promise.resolve(stored.get(key) ?? null));

    await createUser(email('admin'), Role.super_admin);
    admin = await login(email('admin'));
    const mentorId = await createUser(email('mentor'), Role.mentor);
    await createUser(email('other-mentor'), Role.mentor);
    mentor = await login(email('mentor'));
    otherMentor = await login(email('other-mentor'));

    // Course: module 1 (video + article), module 2 unlocks after module 1.
    const track = await admin
      .post('/admin/content/tracks')
      .send({ title: `Video Track ${run}`, isPublished: true })
      .expect(201);
    const course = await admin
      .post('/admin/content/courses')
      .send({
        trackId: track.body.id,
        title: `Loops on video ${run}`,
        isPublished: true,
      })
      .expect(201);
    ids.course = course.body.id;
    ids.courseSlug = course.body.slug;
    const m1 = await admin
      .post(`/admin/content/courses/${ids.course}/modules`)
      .send({ title: 'Basics', isPublished: true })
      .expect(201);
    const m2 = await admin
      .post(`/admin/content/courses/${ids.course}/modules`)
      .send({
        title: 'Advanced',
        isPublished: true,
        unlockAfterModuleId: m1.body.id,
      })
      .expect(201);
    ids.m1 = m1.body.id;
    ids.m2 = m2.body.id;
    const lesson = (moduleId: string, title: string, type: string) =>
      admin
        .post(`/admin/content/modules/${moduleId}/lessons`)
        .send({ title, type, isPublished: true })
        .expect(201)
        .then((r) => r.body.id as string);
    ids.video = await lesson(ids.m1, 'Loop video', 'video');
    ids.article = await lesson(ids.m1, 'Loop notes', 'article');
    ids.locked = await lesson(ids.m2, 'Nested loops', 'article');
    await admin
      .post(`/admin/content/courses/${ids.course}/mentors`)
      .send({ mentorId })
      .expect(201);

    studentId = await createUser(email('student'), Role.student);
    student = await login(email('student'));
    await student
      .post('/student/trial')
      .send({ trackId: track.body.id })
      .expect(201);
    await createUser(email('outsider'), Role.student);
    outsider = await login(email('outsider'));
  });

  afterAll(async () => {
    await app.close();
  });

  describe('mentor uploads a video, notes and attachments', () => {
    it('only mentors of the course can upload', async () => {
      const res = await otherMentor
        .post(`/teach/lessons/${ids.video}/video/start`)
        .send({ contentType: 'video/mp4', size: 50 * MB })
        .expect(403);
      expect(res.body.code).toBe('NOT_COURSE_MENTOR');
      const courses = await otherMentor.get('/teach/courses').expect(200);
      expect(courses.body).toEqual([]);
      await student.get('/teach/courses').expect(403);
    });

    it('uploads a large video in parts', async () => {
      await mentor
        .post(`/teach/lessons/${ids.article}/video/start`)
        .send({ contentType: 'video/mp4', size: 50 * MB })
        .expect(400);
      await mentor
        .post(`/teach/lessons/${ids.video}/video/start`)
        .send({ contentType: 'video/x-msvideo', size: 50 * MB })
        .expect(400);

      const start = await mentor
        .post(`/teach/lessons/${ids.video}/video/start`)
        .send({ contentType: 'video/mp4', size: 50 * MB })
        .expect(201);
      expect(start.body.key).toMatch(
        new RegExp(`^videos/${ids.video}/[0-9a-f-]{36}\\.mp4$`),
      );
      expect(start.body.partCount).toBe(5);

      const parts = await mentor
        .post(`/teach/lessons/${ids.video}/video/parts`)
        .send({
          key: start.body.key,
          uploadId: 'upload-1',
          partNumbers: [1, 2, 3, 4, 5],
        })
        .expect(200);
      expect(parts.body.urls).toHaveLength(5);
      const partUrl = parts.body.urls[0].url as string;
      expect(partUrl).toContain('partNumber=1');
      expect(partUrl).toContain('X-Amz-Signature=');
      // No checksum of an empty body baked into the URL (R2 would reject the upload).
      expect(partUrl).not.toContain('x-amz-checksum');

      // A key from another lesson is refused.
      await mentor
        .post(`/teach/lessons/${ids.video}/video/complete`)
        .send({
          key: `videos/${ids.article}/${randomUUID()}.mp4`,
          uploadId: 'upload-1',
          parts: [{ partNumber: 1, etag: '"a"' }],
          durationSeconds: 200,
        })
        .expect(400);

      const done = await mentor
        .post(`/teach/lessons/${ids.video}/video/complete`)
        .send({
          key: start.body.key,
          uploadId: 'upload-1',
          parts: [1, 2, 3, 4, 5].map((n) => ({
            partNumber: n,
            etag: `"etag${n}"`,
          })),
          durationSeconds: 200,
        })
        .expect(200);
      expect(done.body.video.url).toMatch(/X-Amz-Expires=600/);
      expect(done.body.durationSeconds).toBe(200);
    });

    it('adds notes and a downloadable attachment', async () => {
      await mentor
        .patch(`/teach/lessons/${ids.video}`)
        .send({ notes: 'Remember: i++ runs after the body.' })
        .expect(200);
      const ticket = await mentor
        .post(`/teach/lessons/${ids.video}/attachments/upload-url`)
        .send({
          filename: 'loops.pdf',
          contentType: 'application/pdf',
          size: 2 * MB,
        })
        .expect(201);
      expect(ticket.body.key).toMatch(new RegExp(`^attachments/${ids.video}/`));
      stored.set(ticket.body.key as string, 2 * MB);
      const saved = await mentor
        .post(`/teach/lessons/${ids.video}/attachments`)
        .send({ key: ticket.body.key, filename: 'Loops cheatsheet.pdf' })
        .expect(201);
      expect(saved.body.attachments).toMatchObject([
        {
          filename: 'Loops cheatsheet.pdf',
          contentType: 'application/pdf',
          size: 2 * MB,
        },
      ]);
    });
  });

  describe('student watches', () => {
    it('video URLs are short-lived and only for students with access', async () => {
      const blocked = await outsider
        .get(`/learn/lessons/${ids.video}/video-url`)
        .expect(403);
      expect(blocked.body.code).toBe('SUBSCRIPTION_REQUIRED');

      const lesson = await student
        .get(`/learn/lessons/${ids.video}`)
        .expect(200);
      expect(lesson.body.video.url).toMatch(/X-Amz-Expires=600/);
      expect(lesson.body.video.expiresInSeconds).toBe(600);
      expect(lesson.body.watermark).toBe(email('student'));
      expect(lesson.body.notes).toContain('i++');
      expect(lesson.body.nextLessonId).toBe(ids.article);

      const fresh = await student
        .get(`/learn/lessons/${ids.video}/video-url`)
        .expect(200);
      expect(fresh.body.url).toMatch(/X-Amz-Signature=/);

      const file = await student
        .get(`/learn/attachments/${lesson.body.attachments[0].id}`)
        .expect(200);
      expect(decodeURIComponent(file.body.url as string)).toContain(
        "response-content-disposition=attachment; filename*=UTF-8''Loops%20cheatsheet.pdf",
      );
      await outsider
        .get(`/learn/attachments/${lesson.body.attachments[0].id}`)
        .expect(403);
    });

    it('the student resumes where they left off', async () => {
      const first = await student
        .post(`/learn/lessons/${ids.video}/progress`)
        .send({ positionSeconds: 30, watchedDelta: 30 })
        .expect(200);
      expect(first.body).toEqual({
        positionSeconds: 30,
        watchedSeconds: 30,
        completed: false,
      });

      const again = await student
        .get(`/learn/lessons/${ids.video}`)
        .expect(200);
      expect(again.body.progress.positionSeconds).toBe(30);
    });

    it('cannot fake watch time, and completes at 90% watched', async () => {
      // An immediate second ping claiming 10 minutes gets only a few seconds.
      const fake = await student
        .post(`/learn/lessons/${ids.video}/progress`)
        .send({ positionSeconds: 190, watchedDelta: 600 })
        .expect(200);
      expect(fake.body.watchedSeconds).toBeLessThan(40);
      expect(fake.body.completed).toBe(false);

      await pretendTimePassed(ids.video, 300);
      await student
        .post(`/learn/lessons/${ids.video}/progress`)
        .send({ positionSeconds: 160, watchedDelta: 120 })
        .expect(200);
      await pretendTimePassed(ids.video, 300);
      const done = await student
        .post(`/learn/lessons/${ids.video}/progress`)
        .send({ positionSeconds: 195, watchedDelta: 60 })
        .expect(200);
      expect(done.body.watchedSeconds).toBeGreaterThanOrEqual(180);
      expect(done.body.completed).toBe(true);
    });

    it('the next module unlocks when the previous one is complete', async () => {
      const locked = await student
        .get(`/learn/lessons/${ids.locked}`)
        .expect(403);
      expect(locked.body.code).toBe('MODULE_LOCKED');
      expect(locked.body.unlockAfter).toBe('Basics');

      // Videos complete by watching; articles by the button.
      await student.post(`/learn/lessons/${ids.article}/complete`).expect(200);
      await student.get(`/learn/lessons/${ids.locked}`).expect(200);

      const outline = await student
        .get(`/learn/courses/${ids.courseSlug}`)
        .expect(200);
      expect(outline.body).toMatchObject({
        hasAccess: true,
        completedLessons: 2,
        totalLessons: 3,
        percent: 67,
      });
      expect(
        outline.body.modules.map((m: { locked: boolean }) => m.locked),
      ).toEqual([false, false]);
    });
  });

  describe('timestamped Q&A', () => {
    it('questions show the timestamp and the mentor answer', async () => {
      const q = await student
        .post(`/learn/lessons/${ids.video}/questions`)
        .send({ body: 'Why does the loop stop at 5?', timestampSeconds: 95 })
        .expect(201);

      const inbox = await mentor.get('/teach/questions').expect(200);
      expect(inbox.body.map((x: { id: string }) => x.id)).toContain(q.body.id);
      const otherInbox = await otherMentor.get('/teach/questions').expect(200);
      expect(otherInbox.body.map((x: { id: string }) => x.id)).not.toContain(
        q.body.id,
      );

      await mentor
        .post(`/learn/questions/${q.body.id}/answers`)
        .send({ body: 'Because the condition is i < 5.' })
        .expect(201);

      const list = await student
        .get(`/learn/lessons/${ids.video}/questions`)
        .expect(200);
      const mine = list.body.find((x: { id: string }) => x.id === q.body.id);
      expect(mine.timestampSeconds).toBe(95);
      expect(mine.answers).toMatchObject([
        {
          body: 'Because the condition is i < 5.',
          isStaff: true,
          author: { role: 'mentor' },
        },
      ]);

      const after = await mentor.get('/teach/questions').expect(200);
      expect(after.body.map((x: { id: string }) => x.id)).not.toContain(
        q.body.id,
      );
      await outsider.get(`/learn/lessons/${ids.video}/questions`).expect(403);
    });
  });

  describe('student dashboard', () => {
    it('shows continue learning, course progress, streak and time this week', async () => {
      const res = await student.get('/student/learning').expect(200);
      expect(res.body.streakDays).toBe(1);
      expect(res.body.weekSeconds).toBeGreaterThanOrEqual(180);
      expect(res.body.continueLearning.lessonId).toBe(ids.locked);
      expect(res.body.courses).toMatchObject([
        {
          courseId: ids.course,
          completedLessons: 2,
          totalLessons: 3,
          percent: 67,
        },
      ]);
    });
  });
});
