/**
 * Phase 8 acceptance checks: live classes & attendance.
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

class FakeMail {
  notifications: { to: string; subject: string }[] = [];
  sendVerificationCode() {
    return Promise.resolve(true);
  }
  sendNotification(to: string, subject: string) {
    this.notifications.push({ to, subject });
    return Promise.resolve(true);
  }
}

describe('Phase 8: live classes & attendance', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const mail = new FakeMail();
  let admin: TestAgent;
  let mentor: TestAgent;
  let otherMentor: TestAgent;
  let studentWithAccess: TestAgent;
  let studentWithoutAccess: TestAgent;

  const ids = {
    mentor: '',
    otherMentor: '',
    studentWithAccess: '',
    studentWithoutAccess: '',
    track: '',
    course: '',
    module: '',
    sessionId: '',
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

    await createUser(email('admin'), Role.super_admin);
    admin = await login(email('admin'));

    ids.mentor = await createUser(email('mentor'), Role.mentor);
    mentor = await login(email('mentor'));

    ids.otherMentor = await createUser(email('other-mentor'), Role.mentor);
    otherMentor = await login(email('other-mentor'));

    ids.studentWithAccess = await createUser(
      email('student-access'),
      Role.student,
    );
    studentWithAccess = await login(email('student-access'));

    ids.studentWithoutAccess = await createUser(
      email('student-noaccess'),
      Role.student,
    );
    studentWithoutAccess = await login(email('student-noaccess'));

    const track = await admin
      .post('/admin/content/tracks')
      .send({ title: `Live Track ${run}`, isPublished: true })
      .expect(201);
    ids.track = track.body.id;

    const courseRes = await admin
      .post('/admin/content/courses')
      .send({
        trackId: ids.track,
        title: `Live Course ${run}`,
        isPublished: true,
      });
    if (courseRes.status !== 201) {
      console.error('Course create failed:', courseRes.status, courseRes.body);
    }
    expect(courseRes.status).toBe(201);
    ids.course = courseRes.body.id;

    const mod = await admin
      .post(`/admin/content/courses/${ids.course}/modules`)
      .send({ title: 'Module 1', isPublished: true })
      .expect(201);
    ids.module = mod.body.id;

    // Assign mentor to course
    await admin
      .post(`/admin/content/courses/${ids.course}/mentors`)
      .send({ mentorId: ids.mentor })
      .expect(201);

    // Give studentWithAccess a trial on this track
    await studentWithAccess
      .post('/student/trial')
      .send({ trackId: ids.track })
      .expect(201);
  });

  afterAll(async () => {
    await app.close();
  });

  it('unassigned mentor cannot schedule a live session for the course', async () => {
    const startsAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    await otherMentor
      .post('/teach/live-sessions')
      .send({
        courseId: ids.course,
        title: 'Unauthorized Live Session',
        startsAt,
        durationMinutes: 60,
      })
      .expect(403);
  });

  it('assigned mentor schedules a live session with an unguessable room name', async () => {
    // Schedule session 5 minutes in future (so within 10-minute window for joining)
    const startsAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    const res = await mentor
      .post('/teach/live-sessions')
      .send({
        courseId: ids.course,
        title: `Intro to Live Coding ${run}`,
        description: 'First interactive session',
        startsAt,
        durationMinutes: 60,
      })
      .expect(201);

    expect(res.body.id).toBeDefined();
    expect(res.body.roomName).toMatch(/^logiclab-[a-f0-9]{32}$/);
    expect(res.body.title).toContain('Intro to Live Coding');
    ids.sessionId = res.body.id;
  });

  it('student without access cannot get the room link', async () => {
    const res = await studentWithoutAccess
      .get(`/live-sessions/${ids.sessionId}/room`)
      .expect(403);
    expect(res.body.code).toBe('SUBSCRIPTION_REQUIRED');
  });

  it('student with access cannot get room link if session is > 10 min away', async () => {
    // Schedule a future session 2 hours away
    const farFuture = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    const futureSession = await mentor
      .post('/teach/live-sessions')
      .send({
        courseId: ids.course,
        title: 'Future Session',
        startsAt: farFuture,
        durationMinutes: 45,
      })
      .expect(201);

    const res = await studentWithAccess
      .get(`/live-sessions/${futureSession.body.id}/room`)
      .expect(400);
    expect(res.body.code).toBe('TOO_EARLY_FOR_LIVE_SESSION');

    // But mentor can always access their room
    const mentorRes = await mentor
      .get(`/live-sessions/${futureSession.body.id}/room`)
      .expect(200);
    expect(mentorRes.body.roomName).toBe(futureSession.body.roomName);
  });

  it('student with access gets the room link within 10 min of start', async () => {
    const res = await studentWithAccess
      .get(`/live-sessions/${ids.sessionId}/room`)
      .expect(200);

    expect(res.body.roomName).toMatch(/^logiclab-[a-f0-9]{32}$/);
    expect(res.body.domain).toBe('meet.jit.si');
    expect(res.body.displayName).toBeDefined();
  });

  it('attendance records join and leave times, and awards points to student', async () => {
    // Check initial points
    const beforePoints = await studentWithAccess.get('/points/me').expect(200);
    const initialTotal = beforePoints.body.totalPoints;

    // Student joins
    const joinRes = await studentWithAccess
      .post(`/live-sessions/${ids.sessionId}/join`)
      .expect(200);
    expect(joinRes.body.ok).toBe(true);
    expect(joinRes.body.joinedAt).toBeDefined();

    // Student leaves
    const leaveRes = await studentWithAccess
      .post(`/live-sessions/${ids.sessionId}/leave`)
      .expect(200);
    expect(leaveRes.body.ok).toBe(true);

    // Points awarded: +5 for live_class_attended
    const afterPoints = await studentWithAccess.get('/points/me').expect(200);
    expect(afterPoints.body.totalPoints).toBe(initialTotal + 5);
    expect(
      afterPoints.body.recent.some(
        (e: any) => e.reason === 'live_class_attended',
      ),
    ).toBe(true);
  });

  it("attendance shows join and leave times in the mentor's view", async () => {
    const res = await mentor
      .get(`/teach/live-sessions/${ids.sessionId}`)
      .expect(200);

    expect(res.body.id).toBe(ids.sessionId);
    expect(res.body.attendance).toHaveLength(1);
    const studentRecord = res.body.attendance[0];
    expect(studentRecord.userId).toBe(ids.studentWithAccess);
    expect(studentRecord.joinedAt).toBeDefined();
    expect(studentRecord.leftAt).toBeDefined();
  });

  it('mentor uploads recording and publishes it as a course lesson', async () => {
    // 1. Get recording upload URL
    const uploadRes = await mentor
      .post(`/teach/live-sessions/${ids.sessionId}/recording-url`)
      .send({ contentType: 'video/mp4', size: 1048576 })
      .expect(201);

    expect(uploadRes.body.uploadUrl).toBeDefined();
    expect(uploadRes.body.key).toMatch(/^live-sessions\//);

    // 2. Complete recording
    await mentor
      .post(`/teach/live-sessions/${ids.sessionId}/recording-complete`)
      .send({ key: uploadRes.body.key })
      .expect(200);

    // 3. Publish as lesson
    const lessonRes = await mentor
      .post(`/teach/live-sessions/${ids.sessionId}/publish-as-lesson`)
      .send({
        moduleId: ids.module,
        title: 'Class Recording: Intro to Live Coding',
      })
      .expect(201);

    expect(lessonRes.body.id).toBeDefined();
    expect(lessonRes.body.type).toBe('video');
    expect(lessonRes.body.videoKey).toBe(uploadRes.body.key);
    expect(lessonRes.body.isPublished).toBe(true);
  });
});
