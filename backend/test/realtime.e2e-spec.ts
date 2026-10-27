/**
 * Phase 7 acceptance checks: realtime chat, points, leaderboard, notifications.
 * Uses real Socket.IO clients against a listening test server.
 */
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PointReason, Role } from '@prisma/client';
import cookieParser from 'cookie-parser';
import { hash } from 'bcryptjs';
import { authenticator } from 'otplib';
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { io, Socket } from 'socket.io-client';
import request from 'supertest';
import { App } from 'supertest/types';
import TestAgent from 'supertest/lib/agent';
import { AppModule } from '../src/app.module';
import { MailService } from '../src/mail/mail.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { RateLimitService } from '../src/rate-limit/rate-limit.service';
import { pktClock } from '../src/chat/office-hours';

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

/** Resolves with the first `event` payload matching `match`, or rejects after `ms`. */
function next<T>(
  socket: Socket,
  event: string,
  match: (p: T) => boolean = () => true,
  ms = 4000,
) {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, handler);
      reject(new Error(`timeout waiting for ${event}`));
    }, ms);
    const handler = (payload: T) => {
      if (!match(payload)) return;
      clearTimeout(timer);
      socket.off(event, handler);
      resolve(payload);
    };
    socket.on(event, handler);
  });
}

describe('Phase 7: realtime chat, points, leaderboard, notifications', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let url: string;
  const mail = new FakeMail();
  const sockets: Socket[] = [];
  let admin: TestAgent;
  let mentor: TestAgent;
  let otherMentor: TestAgent;
  let student: TestAgent;
  let student2: TestAgent;
  let outsider: TestAgent;
  const ids = {
    student: '',
    student2: '',
    mentor: '',
    track: '',
    trackSlug: '',
    course: '',
    quizLesson: '',
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

  async function connect(agent: TestAgent) {
    const { body } = await agent.get('/realtime/token').expect(200);
    const socket = io(url, {
      auth: { token: body.token },
      transports: ['websocket'],
      forceNew: true,
    });
    sockets.push(socket);
    await new Promise<void>((resolve, reject) => {
      socket.once('connect', () => resolve());
      socket.once('connect_error', reject);
    });
    return socket;
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
    await app.listen(0);
    url = `http://127.0.0.1:${((app.getHttpServer() as unknown as Server).address() as AddressInfo).port}`;
    prisma = app.get(PrismaService);

    await createUser(email('admin'), Role.super_admin);
    admin = await login(email('admin'));
    ids.mentor = await createUser(email('mentor'), Role.mentor);
    await createUser(email('other-mentor'), Role.mentor);
    mentor = await login(email('mentor'));
    otherMentor = await login(email('other-mentor'));
    ids.student = await createUser(email('student'), Role.student);
    ids.student2 = await createUser(email('student2'), Role.student);
    await createUser(email('outsider'), Role.student);
    student = await login(email('student'));
    student2 = await login(email('student2'));
    outsider = await login(email('outsider'));

    const track = await admin
      .post('/admin/content/tracks')
      .send({ title: `Realtime Track ${run}`, isPublished: true })
      .expect(201);
    ids.track = track.body.id;
    ids.trackSlug = track.body.slug;
    const course = await admin
      .post('/admin/content/courses')
      .send({
        trackId: ids.track,
        title: `Chat course ${run}`,
        isPublished: true,
      })
      .expect(201);
    ids.course = course.body.id;
    const mod = await admin
      .post(`/admin/content/courses/${ids.course}/modules`)
      .send({ title: 'Basics', isPublished: true })
      .expect(201);
    ids.quizLesson = (
      await admin
        .post(`/admin/content/modules/${mod.body.id}/lessons`)
        .send({ title: 'Warm-up quiz', type: 'quiz', isPublished: true })
        .expect(201)
    ).body.id;
    await admin
      .post(`/admin/content/courses/${ids.course}/mentors`)
      .send({ mentorId: ids.mentor })
      .expect(201);
    await student
      .post('/student/trial')
      .send({ trackId: ids.track })
      .expect(201);
    await student2
      .post('/student/trial')
      .send({ trackId: ids.track })
      .expect(201);
  });

  afterAll(async () => {
    sockets.forEach((s) => s.disconnect());
    await app.close();
  });

  describe('socket authentication', () => {
    it('rejects sockets without a valid token', async () => {
      const socket = io(url, {
        auth: { token: 'nope' },
        transports: ['websocket'],
        forceNew: true,
      });
      sockets.push(socket);
      await next(socket, 'auth_error');
      await new Promise((r) => setTimeout(r, 100));
      expect(socket.connected).toBe(false);
      await request(app.getHttpServer()).get('/realtime/token').expect(401);
    });
  });

  describe('chat with mentors', () => {
    let conversationId: string;
    let studentSocket: Socket;
    let mentorSocket: Socket;

    beforeAll(async () => {
      studentSocket = await connect(student);
      mentorSocket = await connect(mentor);
    });

    it('a doubt goes to the course mentors’ queue instantly', async () => {
      await outsider
        .post('/chat/conversations')
        .send({ courseId: ids.course, subject: 'Help', body: 'Please help' })
        .expect(403);

      const queued = next<{ conversationId: string }>(
        mentorSocket,
        'queue:updated',
      );
      const notified = next<{ type: string }>(
        mentorSocket,
        'notification:new',
        (n) => n.type === 'new_doubt',
      );
      const res = await student
        .post('/chat/conversations')
        .send({
          courseId: ids.course,
          subject: 'Loop question',
          body: 'Why does my loop never end?',
        })
        .expect(201);
      conversationId = res.body.id;
      expect(res.body).toMatchObject({ status: 'waiting', side: 'student' });
      expect((await queued).conversationId).toBe(conversationId);
      await notified;
      expect(mail.notifications.some((m) => m.to === email('mentor'))).toBe(
        true,
      );

      const queue = await mentor.get('/chat/queue').expect(200);
      expect(queue.body.map((c: { id: string }) => c.id)).toContain(
        conversationId,
      );
      expect((await otherMentor.get('/chat/queue').expect(200)).body).toEqual(
        [],
      );
      await otherMentor
        .get(`/chat/conversations/${conversationId}`)
        .expect(403);
    });

    it('a mentor claims it; nobody else can', async () => {
      const updated = next(studentSocket, 'conversation:updated');
      const claimed = await mentor
        .post(`/chat/conversations/${conversationId}/claim`)
        .expect(200);
      expect(claimed.body).toMatchObject({ status: 'open', side: 'mentor' });
      await updated;
      const again = await admin
        .post(`/chat/conversations/${conversationId}/claim`)
        .expect(409);
      expect(again.body.code).toBe('ALREADY_CLAIMED');
    });

    it('messages appear instantly on the other side, with typing and read receipts', async () => {
      const typing = next<{ isTyping: boolean }>(mentorSocket, 'typing');
      studentSocket.emit('typing', { conversationId, isTyping: true });
      expect((await typing).isTyping).toBe(true);

      const arrived = next<{ message: { body: string } }>(
        studentSocket,
        'message:new',
      );
      const started = Date.now();
      await mentor
        .post(`/chat/conversations/${conversationId}/messages`)
        .send({
          body: 'Add `i++` inside the loop:\n```js\nwhile (i < 5) { i++; }\n```',
        })
        .expect(201);
      const payload = await arrived;
      expect(payload.message.body).toContain('i++');
      expect(Date.now() - started).toBeLessThan(1000);

      const receipt = next<{ side: string }>(mentorSocket, 'message:read');
      await student
        .post(`/chat/conversations/${conversationId}/read`)
        .expect(200);
      expect((await receipt).side).toBe('student');

      const list = await student.get('/chat/conversations').expect(200);
      expect(
        list.body.find((c: { id: string }) => c.id === conversationId).unread,
      ).toBe(0);
    });

    it('a mentor reply notifies the student (in-app and email, unless switched off)', async () => {
      expect(mail.notifications.some((m) => m.to === email('student'))).toBe(
        true,
      );
      await student
        .put('/notifications/preferences')
        .send({ chat_reply: false })
        .expect(200);
      const before = mail.notifications.filter(
        (m) => m.to === email('student'),
      ).length;
      await mentor
        .post(`/chat/conversations/${conversationId}/messages`)
        .send({ body: 'Any luck?' })
        .expect(201);
      expect(
        mail.notifications.filter((m) => m.to === email('student')).length,
      ).toBe(before);

      const inbox = await student.get('/notifications').expect(200);
      expect(inbox.body.items.map((n: { type: string }) => n.type)).toEqual(
        expect.arrayContaining(['doubt_claimed', 'chat_reply']),
      );
      expect(inbox.body.unread).toBeGreaterThan(0);
      await student.post('/notifications/read-all').expect(200);
      expect(
        (await student.get('/notifications').expect(200)).body.unread,
      ).toBe(0);
    });

    it('outside office hours the student is told the mentor will reply later', async () => {
      const { weekday } = pktClock();
      const otherDay = (weekday + 3) % 7;
      await mentor
        .put('/mentor/office-hours')
        .send({ slots: [{ weekday: otherDay, start: '09:00', end: '17:00' }] })
        .expect(200);
      let view = await student
        .get(`/chat/conversations/${conversationId}`)
        .expect(200);
      expect(view.body.availability).toMatchObject({
        hasOfficeHours: true,
        withinOfficeHours: false,
      });

      await mentor
        .put('/mentor/office-hours')
        .send({ slots: [{ weekday, start: '00:00', end: '24:00' }] })
        .expect(200);
      view = await student
        .get(`/chat/conversations/${conversationId}`)
        .expect(200);
      expect(view.body.availability.withinOfficeHours).toBe(true);
      await mentor
        .put('/mentor/office-hours')
        .send({ slots: [{ weekday, start: '10:00', end: '09:00' }] })
        .expect(400);
    });

    it('closed conversations accept no more messages', async () => {
      await student
        .post(`/chat/conversations/${conversationId}/close`)
        .expect(200);
      const res = await mentor
        .post(`/chat/conversations/${conversationId}/messages`)
        .send({ body: 'hi' })
        .expect(409);
      expect(res.body.code).toBe('CONVERSATION_CLOSED');
    });
  });

  describe('points and leaderboard', () => {
    let studentSocket: Socket;

    beforeAll(async () => {
      studentSocket = await connect(student);
    });

    it('points cannot be added from the browser', async () => {
      await student.post('/points').send({ points: 1000 }).expect(404);
      await student.put('/points/me').send({ seasonPoints: 1000 }).expect(404);
      await student.post('/leaderboard').send({}).expect(404);
    });

    it('passing a quiz earns points once, pushed live', async () => {
      const q = await mentor
        .post(`/teach/courses/${ids.course}/questions`)
        .send({
          type: 'mcq',
          prompt: '2 + 2 = ?',
          options: [
            { id: 'a', text: '4' },
            { id: 'b', text: '5' },
          ],
          correctOptionIds: ['a'],
        })
        .expect(201);
      await mentor
        .put(`/teach/lessons/${ids.quizLesson}/quiz/questions`)
        .send({ questionIds: [q.body.id] })
        .expect(200);
      await mentor
        .put(`/teach/lessons/${ids.quizLesson}/quiz`)
        .send({
          timeLimitMinutes: 5,
          startsAt: null,
          endsAt: null,
          passMark: 50,
          maxAttempts: 2,
        })
        .expect(200);

      const awarded = next<{ reason: string; points: number }>(
        studentSocket,
        'points:awarded',
      );
      const attempt = await student
        .post(`/learn/lessons/${ids.quizLesson}/quiz/attempts`)
        .expect(201);
      await student
        .put(`/learn/attempts/${attempt.body.id}/answers/${q.body.id}`)
        .send({ optionIds: ['a'] })
        .expect(200);
      await student
        .post(`/learn/attempts/${attempt.body.id}/submit`)
        .expect(200);
      expect(await awarded).toEqual({ reason: 'quiz_passed', points: 20 });

      // Passing again does not pay twice.
      const second = await student
        .post(`/learn/lessons/${ids.quizLesson}/quiz/attempts`)
        .expect(201);
      await student
        .put(`/learn/attempts/${second.body.id}/answers/${q.body.id}`)
        .send({ optionIds: ['a'] })
        .expect(200);
      await student
        .post(`/learn/attempts/${second.body.id}/submit`)
        .expect(200);
      const me = await student.get('/points/me').expect(200);
      expect(me.body).toMatchObject({ seasonPoints: 20, totalPoints: 20 });
    });

    it('accepted answers earn +10; changing the accepted answer moves the points', async () => {
      const post = await student2
        .post('/community/posts')
        .send({
          title: 'What is a variable exactly?',
          body: 'I am confused about variables.',
          trackId: ids.track,
        })
        .expect(201);
      const a1 = await student
        .post(`/community/posts/${post.body.id}/answers`)
        .send({ body: 'A named box that holds a value.' })
        .expect(201);
      const answerId = a1.body.answers[0].id as string;
      const a2 = await mentor
        .post(`/community/posts/${post.body.id}/answers`)
        .send({ body: 'A name bound to a value in memory.' })
        .expect(201);
      const mentorAnswer = a2.body.answers.find(
        (a: { isStaff: boolean }) => a.isStaff,
      ).id as string;

      const leaderboardSocket = await connect(student2);
      await leaderboardSocket.emitWithAck('leaderboard:subscribe');
      const live = next(leaderboardSocket, 'leaderboard:updated');

      await student2
        .post(`/community/posts/${post.body.id}/accept`)
        .send({ answerId })
        .expect(200);
      await student2
        .post(`/community/posts/${post.body.id}/accept`)
        .send({ answerId })
        .expect(200);
      expect(
        (await student.get('/points/me').expect(200)).body.seasonPoints,
      ).toBe(30);
      await live; // the leaderboard updates live

      await student2
        .post(`/community/posts/${post.body.id}/accept`)
        .send({ answerId: mentorAnswer })
        .expect(200);
      expect(
        (await student.get('/points/me').expect(200)).body.seasonPoints,
      ).toBe(20);
      await student2
        .post(`/community/posts/${post.body.id}/accept`)
        .send({ answerId })
        .expect(200);
      expect(
        (await student.get('/points/me').expect(200)).body.seasonPoints,
      ).toBe(30);
    });

    it('the leaderboard shows the current month only, overall and per track', async () => {
      // Points from an earlier month must not count.
      const old = await prisma.season.upsert({
        where: { key: '2001-01' },
        create: {
          key: '2001-01',
          startsAt: new Date('2000-12-31T19:00:00Z'),
          endsAt: new Date('2001-01-31T19:00:00Z'),
        },
        update: {},
      });
      await prisma.pointEvent.deleteMany({ where: { seasonId: old.id } });
      await prisma.pointEvent.create({
        data: {
          userId: ids.student2,
          reason: PointReason.quiz_passed,
          points: 999,
          sourceId: `old-${run}`,
          seasonId: old.id,
        },
      });

      const board = await student2
        .get('/leaderboard')
        .query({ track: ids.trackSlug })
        .expect(200);
      expect(board.body.entries).toEqual([
        expect.objectContaining({ userId: ids.student, points: 30, rank: 1 }),
      ]);
      expect(board.body.me).toBeNull();
      expect(board.body.season.key).toMatch(/^\d{4}-\d{2}$/);
      expect(board.body.season.key).not.toBe('2001-01');

      const past = await student2
        .get('/leaderboard')
        .query({ season: '2001-01' })
        .expect(200);
      expect(past.body.entries[0]).toMatchObject({
        userId: ids.student2,
        points: 999,
      });

      const mine = await student
        .get('/leaderboard')
        .query({ track: ids.trackSlug })
        .expect(200);
      expect(mine.body.me).toEqual({ rank: 1, points: 30 });
    });

    it('a mentor confirms plagiarism once, taking the configured points', async () => {
      const mod = await admin
        .post(`/admin/content/courses/${ids.course}/modules`)
        .send({ title: 'Projects', isPublished: true })
        .expect(201);
      const lessonId = (
        await admin
          .post(`/admin/content/modules/${mod.body.id}/lessons`)
          .send({ title: 'Essay', type: 'assignment', isPublished: true })
          .expect(201)
      ).body.id as string;
      await mentor
        .put(`/teach/lessons/${lessonId}/assignment`)
        .send({ instructions: 'Write.', dueAt: null, maxMarks: 10, rubric: [] })
        .expect(200);
      await student
        .post(`/learn/lessons/${lessonId}/assignment/submit`)
        .send({ content: 'My essay.' })
        .expect(200);
      expect(
        (await student.get('/points/me').expect(200)).body.seasonPoints,
      ).toBe(45); // +15 on time

      const queue = await mentor.get('/teach/grading').expect(200);
      const sub = queue.body.find(
        (i: { lesson: { id: string } }) => i.lesson.id === lessonId,
      );
      await student
        .post(`/teach/submissions/${sub.id}/confirm-plagiarism`)
        .send({ note: 'copied' })
        .expect(403);
      await otherMentor
        .post(`/teach/submissions/${sub.id}/confirm-plagiarism`)
        .send({ note: 'copied' })
        .expect(403);
      await mentor
        .post(`/teach/submissions/${sub.id}/confirm-plagiarism`)
        .send({ note: 'Copied from a blog.' })
        .expect(200);
      await mentor
        .post(`/teach/submissions/${sub.id}/confirm-plagiarism`)
        .send({ note: 'Copied again?' })
        .expect(200);
      expect(
        (await student.get('/points/me').expect(200)).body.seasonPoints,
      ).toBe(-5);

      const logs = await admin
        .get('/admin/audit-logs')
        .query({ targetId: sub.id })
        .expect(200);
      expect(logs.body[0].action).toBe('integrity.plagiarism_confirmed');
    });

    it('admins can change the point rules', async () => {
      const rules = (await admin.get('/admin/settings/point_rules').expect(200))
        .body;
      expect(rules.accepted_answer).toBe(10);
      await admin
        .put('/admin/settings/point_rules')
        .send({ ...rules, accepted_answer: 12 })
        .expect(200);
      expect(
        (await admin.get('/admin/settings/point_rules').expect(200)).body
          .accepted_answer,
      ).toBe(12);
      await admin.put('/admin/settings/point_rules').send(rules).expect(200);
      await student.get('/admin/settings/point_rules').expect(403);
    });
  });
});
