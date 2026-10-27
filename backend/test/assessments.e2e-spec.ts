/**
 * Phase 5 acceptance checks (quizzes, assignments, integrity, grading).
 * Runs on the test database.
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
import { QuizzesService } from '../src/assessments/quizzes.service';
import { MailService } from '../src/mail/mail.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { RateLimitService } from '../src/rate-limit/rate-limit.service';

const PASSWORD = 'Secret123pass';
const run = randomUUID().slice(0, 8);
const email = (name: string) => `${name}.${run}@test.logiclab.pk`;

/** Typing events for `text`, one character every `gapMs`. */
function typed(text: string, start = Date.now(), gapMs = 200) {
  return [...text].map((ch, i) => ({
    at: start + i * gapMs,
    pos: i,
    del: 0,
    ins: ch,
  }));
}

describe('Phase 5: assignments and quizzes with integrity checks', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let admin: TestAgent;
  let mentor: TestAgent;
  let otherMentor: TestAgent;
  let student: TestAgent;
  let student2: TestAgent;
  const ids = {
    course: '',
    otherCourse: '',
    quizLesson: '',
    assignmentLesson: '',
    lockedLesson: '',
    mcq: '',
    multi: '',
    short: '',
    foreign: '',
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
      .useValue({})
      .overrideProvider(RateLimitService)
      .useValue({ consume: () => Promise.resolve() })
      .compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    await app.init();
    prisma = app.get(PrismaService);

    await createUser(email('admin'), Role.super_admin);
    admin = await login(email('admin'));
    const mentorId = await createUser(email('mentor'), Role.mentor);
    await createUser(email('other-mentor'), Role.mentor);
    mentor = await login(email('mentor'));
    otherMentor = await login(email('other-mentor'));

    const track = await admin
      .post('/admin/content/tracks')
      .send({ title: `Quiz Track ${run}`, isPublished: true })
      .expect(201);
    const course = await admin
      .post('/admin/content/courses')
      .send({
        trackId: track.body.id,
        title: `Logic quizzes ${run}`,
        isPublished: true,
      })
      .expect(201);
    ids.course = course.body.id;
    const other = await admin
      .post('/admin/content/courses')
      .send({
        trackId: track.body.id,
        title: `Other ${run}`,
        isPublished: true,
      })
      .expect(201);
    ids.otherCourse = other.body.id;

    const m1 = await admin
      .post(`/admin/content/courses/${ids.course}/modules`)
      .send({ title: 'Conditions', isPublished: true })
      .expect(201);
    const m2 = await admin
      .post(`/admin/content/courses/${ids.course}/modules`)
      .send({
        title: 'Loops',
        isPublished: true,
        unlockAfterModuleId: m1.body.id,
      })
      .expect(201);
    const lesson = (moduleId: string, title: string, type: string) =>
      admin
        .post(`/admin/content/modules/${moduleId}/lessons`)
        .send({ title, type, isPublished: true })
        .expect(201)
        .then((r) => r.body.id as string);
    ids.quizLesson = await lesson(m1.body.id, 'Conditions quiz', 'quiz');
    ids.assignmentLesson = await lesson(
      m1.body.id,
      'FizzBuzz write-up',
      'assignment',
    );
    ids.lockedLesson = await lesson(m2.body.id, 'While loops', 'article');
    await admin
      .post(`/admin/content/courses/${ids.course}/mentors`)
      .send({ mentorId })
      .expect(201);

    await createUser(email('student'), Role.student);
    await createUser(email('student2'), Role.student);
    student = await login(email('student'));
    student2 = await login(email('student2'));
    await student
      .post('/student/trial')
      .send({ trackId: track.body.id })
      .expect(201);
    await student2
      .post('/student/trial')
      .send({ trackId: track.body.id })
      .expect(201);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('question bank and quiz builder', () => {
    it('only the course mentors manage its question bank', async () => {
      await otherMentor
        .get(`/teach/courses/${ids.course}/questions`)
        .expect(403);
      await student.get(`/teach/courses/${ids.course}/questions`).expect(403);
    });

    it('validates MCQs and creates questions', async () => {
      const bad = await mentor
        .post(`/teach/courses/${ids.course}/questions`)
        .send({
          type: 'mcq',
          prompt: 'Pick one',
          options: [{ id: 'a', text: 'Only' }],
          correctOptionIds: ['a'],
        })
        .expect(400);
      expect(bad.body.code).toBe('VALIDATION_FAILED');

      const mcq = await mentor
        .post(`/teach/courses/${ids.course}/questions`)
        .send({
          type: 'mcq',
          prompt: 'What does `5 > 3 && 2 > 4` evaluate to?',
          options: [
            { id: 'a', text: 'true' },
            { id: 'b', text: 'false' },
          ],
          correctOptionIds: ['b'],
          explanation: 'Both sides must be true for &&.',
          points: 2,
          tags: ['operators'],
        })
        .expect(201);
      ids.mcq = mcq.body.id;
      const multi = await mentor
        .post(`/teach/courses/${ids.course}/questions`)
        .send({
          type: 'mcq',
          prompt: 'Which are comparison operators?',
          options: [
            { id: 'a', text: '==' },
            { id: 'b', text: '+' },
            { id: 'c', text: '<=' },
          ],
          correctOptionIds: ['a', 'c'],
          allowMultiple: true,
          points: 2,
        })
        .expect(201);
      ids.multi = multi.body.id;
      const short = await mentor
        .post(`/teach/courses/${ids.course}/questions`)
        .send({
          type: 'short',
          prompt: 'Explain an if/else in your own words.',
          sampleAnswer: 'Runs one branch.',
          points: 4,
        })
        .expect(201);
      ids.short = short.body.id;
      expect(short.body.options).toEqual([]);

      const foreign = await admin
        .post(`/teach/courses/${ids.otherCourse}/questions`)
        .send({ type: 'short', prompt: 'Other course question' })
        .expect(201);
      ids.foreign = foreign.body.id;

      const list = await mentor
        .get(`/teach/courses/${ids.course}/questions`)
        .query({ tag: 'operators' })
        .expect(200);
      expect(list.body.map((q: { id: string }) => q.id)).toEqual([ids.mcq]);
    });

    it('builds the quiz from this course’s questions only', async () => {
      await mentor
        .put(`/teach/lessons/${ids.quizLesson}/quiz/questions`)
        .send({ questionIds: [ids.mcq, ids.foreign] })
        .expect(400);
      const quiz = await mentor
        .put(`/teach/lessons/${ids.quizLesson}/quiz/questions`)
        .send({ questionIds: [ids.mcq, ids.multi, ids.short] })
        .expect(200);
      expect(quiz.body.totalPoints).toBe(8);
      await mentor
        .put(`/teach/lessons/${ids.quizLesson}/quiz`)
        .send({
          timeLimitMinutes: 10,
          startsAt: null,
          endsAt: null,
          passMark: 50,
          maxAttempts: 2,
        })
        .expect(200);
      await mentor.delete(`/teach/questions/${ids.mcq}`).expect(409);
      await mentor
        .get(`/teach/lessons/${ids.assignmentLesson}/quiz`)
        .expect(400);
    });
  });

  describe('taking a quiz', () => {
    let attemptId: string;

    it('the next module is locked until the quiz is passed', async () => {
      const res = await student
        .get(`/learn/lessons/${ids.lockedLesson}`)
        .expect(403);
      expect(res.body.code).toBe('MODULE_LOCKED');
    });

    it('starts with a server deadline and hides correct answers', async () => {
      const info = await student
        .get(`/learn/lessons/${ids.quizLesson}/quiz`)
        .expect(200);
      expect(info.body).toMatchObject({
        ready: true,
        questionCount: 3,
        totalPoints: 8,
        canStart: true,
      });

      const attempt = await student
        .post(`/learn/lessons/${ids.quizLesson}/quiz/attempts`)
        .expect(201);
      attemptId = attempt.body.id;
      const deadline =
        Date.parse(attempt.body.deadlineAt) -
        Date.parse(attempt.body.startedAt);
      expect(deadline).toBe(10 * 60 * 1000);
      expect(attempt.body.questions[0]).not.toHaveProperty('correctOptionIds');
      expect(attempt.body.questions.map((q: { id: string }) => q.id)).toEqual([
        ids.mcq,
        ids.multi,
        ids.short,
      ]);

      // Starting again returns the same attempt.
      const again = await student
        .post(`/learn/lessons/${ids.quizLesson}/quiz/attempts`)
        .expect(201);
      expect(again.body.id).toBe(attemptId);
      await student2.get(`/learn/attempts/${attemptId}`).expect(404);
    });

    it('saves answers, typing and tab switches; rejects invalid answers', async () => {
      await student
        .put(`/learn/attempts/${attemptId}/answers/${ids.mcq}`)
        .send({ optionIds: ['b'] })
        .expect(200);
      await student
        .put(`/learn/attempts/${attemptId}/answers/${ids.mcq}`)
        .send({ optionIds: ['a', 'b'] })
        .expect(400); // single answer only
      await student
        .put(`/learn/attempts/${attemptId}/answers/${ids.multi}`)
        .send({ optionIds: ['c', 'a'] })
        .expect(200);

      const text = 'It picks a branch';
      await student
        .post(`/learn/attempts/${attemptId}/typing`)
        .send({
          questionId: ids.short,
          events: [...typed(text), { at: Date.now(), kind: 'paste_blocked' }],
        })
        .expect(200);
      await student
        .put(`/learn/attempts/${attemptId}/answers/${ids.short}`)
        .send({ text })
        .expect(200);
      await student.post(`/learn/attempts/${attemptId}/tab-switch`).expect(200);
      await student.post(`/learn/attempts/${attemptId}/tab-switch`).expect(200);
    });

    it('MCQs are graded on submit; written answers wait for the mentor', async () => {
      const res = await student
        .post(`/learn/attempts/${attemptId}/submit`)
        .expect(200);
      expect(res.body.status).toBe('submitted');
      expect(res.body.result).toMatchObject({
        autoScore: 4,
        maxScore: 8,
        pendingReview: true,
        passed: null,
      });
      // A second attempt is still allowed, so answers stay hidden.
      expect(res.body.reveal).toBe(false);
      await student
        .put(`/learn/attempts/${attemptId}/answers/${ids.mcq}`)
        .send({ optionIds: ['a'] })
        .expect(409);
    });

    it('a mentor of another course cannot grade it; the course mentor sees flags and typing', async () => {
      await otherMentor.get(`/teach/attempts/${attemptId}`).expect(403);
      const queue = await mentor.get('/teach/grading').expect(200);
      const item = queue.body.find((i: { id: string }) => i.id === attemptId);
      expect(item).toMatchObject({
        kind: 'attempt',
        flagged: true,
        tabSwitches: 2,
      });

      const detail = await mentor
        .get(`/teach/attempts/${attemptId}`)
        .expect(200);
      const short = detail.body.questions.find(
        (q: { id: string }) => q.id === ids.short,
      );
      expect(short.typingEvents.length).toBeGreaterThan(10);
      expect(short.flags).toMatchObject({
        pasteAttempts: 1,
        contentMismatch: false,
        burst: false,
      });
      expect(detail.body.tabSwitches).toBe(2);

      await mentor
        .post(`/teach/attempts/${attemptId}/grade`)
        .send({ questionScores: { [ids.short]: 5 }, feedback: 'Good' })
        .expect(400); // more than 4 points
      const graded = await mentor
        .post(`/teach/attempts/${attemptId}/grade`)
        .send({
          questionScores: { [ids.short]: 3 },
          feedback: 'Clear explanation.',
        })
        .expect(200);
      expect(graded.body).toMatchObject({
        status: 'graded',
        score: 7,
        percent: 88,
        passed: true,
      });
    });

    it('passing the quiz unlocks the next module', async () => {
      await student.get(`/learn/lessons/${ids.lockedLesson}`).expect(200);
    });

    it('auto-submits when time runs out, even if the student closed the tab', async () => {
      const attempt = await student2
        .post(`/learn/lessons/${ids.quizLesson}/quiz/attempts`)
        .expect(201);
      await student2
        .put(`/learn/attempts/${attempt.body.id}/answers/${ids.mcq}`)
        .send({ optionIds: ['b'] })
        .expect(200);
      // The student leaves. Time passes...
      await prisma.quizAttempt.update({
        where: { id: attempt.body.id },
        data: { deadlineAt: new Date(Date.now() - 1000) },
      });
      await student2
        .put(`/learn/attempts/${attempt.body.id}/answers/${ids.multi}`)
        .send({ optionIds: ['a'] })
        .expect(409);

      const row = await prisma.quizAttempt.findUniqueOrThrow({
        where: { id: attempt.body.id },
      });
      expect(row).toMatchObject({
        status: 'submitted',
        autoSubmitted: true,
        autoScore: 2,
      });
    });

    it('the scheduled job submits expired attempts nobody touches', async () => {
      const attempt = await student2
        .post(`/learn/lessons/${ids.quizLesson}/quiz/attempts`)
        .expect(201);
      await prisma.quizAttempt.update({
        where: { id: attempt.body.id },
        data: { deadlineAt: new Date(Date.now() - 1000) },
      });
      await app.get(QuizzesService).finalizeExpiredScheduled();
      const row = await prisma.quizAttempt.findUniqueOrThrow({
        where: { id: attempt.body.id },
      });
      expect(row.autoSubmitted).toBe(true);

      // Both attempts used: correct answers are now shown, and no new attempt.
      const info = await student2
        .get(`/learn/lessons/${ids.quizLesson}/quiz`)
        .expect(200);
      expect(info.body).toMatchObject({
        canStart: false,
        blockedReason: 'NO_ATTEMPTS_LEFT',
      });
      const view = await student2
        .get(`/learn/attempts/${attempt.body.id}`)
        .expect(200);
      expect(view.body.reveal).toBe(true);
      expect(view.body.questions[0]).toMatchObject({
        correctOptionIds: ['b'],
        explanation: 'Both sides must be true for &&.',
      });
    });
  });

  describe('assignments with the write-only editor', () => {
    let submissionId: string;

    it('mentor sets instructions, due date and a rubric that adds up', async () => {
      const rubric = [
        { id: 'logic', title: 'Correct logic', maxPoints: 6 },
        { id: 'style', title: 'Clear writing', maxPoints: 4 },
      ];
      await mentor
        .put(`/teach/lessons/${ids.assignmentLesson}/assignment`)
        .send({
          instructions: 'Explain FizzBuzz.',
          dueAt: new Date(Date.now() - 60_000).toISOString(),
          maxMarks: 20,
          rubric,
        })
        .expect(400); // 6 + 4 != 20
      const res = await mentor
        .put(`/teach/lessons/${ids.assignmentLesson}/assignment`)
        .send({
          instructions: 'Explain FizzBuzz.',
          dueAt: new Date(Date.now() - 60_000).toISOString(),
          maxMarks: 10,
          rubric,
        })
        .expect(200);
      expect(res.body.rubric).toHaveLength(2);
    });

    it('drafts autosave; typing is recorded; a burst of 300 characters is flagged', async () => {
      const intro = 'FizzBuzz prints numbers. ';
      await student
        .post(`/learn/lessons/${ids.assignmentLesson}/assignment/typing`)
        .send({ events: typed(intro) })
        .expect(200);
      await student
        .put(`/learn/lessons/${ids.assignmentLesson}/assignment/draft`)
        .send({ content: intro })
        .expect(200);

      const blob = 'x'.repeat(300);
      await student
        .post(`/learn/lessons/${ids.assignmentLesson}/assignment/typing`)
        .send({
          events: [
            { at: Date.now() + 60_000, pos: intro.length, del: 0, ins: blob },
          ],
        })
        .expect(200);
      const submitted = await student
        .post(`/learn/lessons/${ids.assignmentLesson}/assignment/submit`)
        .send({ content: intro + blob })
        .expect(200);
      expect(submitted.body.submission).toMatchObject({
        status: 'submitted',
        late: true,
        grade: null,
      });

      await student
        .put(`/learn/lessons/${ids.assignmentLesson}/assignment/draft`)
        .send({ content: 'more' })
        .expect(409);
    });

    it('text that was never typed is flagged as a mismatch', async () => {
      await student2
        .post(`/learn/lessons/${ids.assignmentLesson}/assignment/typing`)
        .send({ events: typed('short') })
        .expect(200);
      await student2
        .post(`/learn/lessons/${ids.assignmentLesson}/assignment/submit`)
        .send({
          content: 'A long answer that appeared without any typing at all.',
        })
        .expect(200);
      const queue = await mentor.get('/teach/grading').expect(200);
      const items = queue.body.filter(
        (i: { kind: string; lesson: { id: string } }) =>
          i.kind === 'submission' && i.lesson.id === ids.assignmentLesson,
      );
      expect(items).toHaveLength(2);
      expect(items.every((i: { flagged: boolean }) => i.flagged)).toBe(true);
      submissionId = items.find(
        (i: { student: { email: string } }) =>
          i.student.email === email('student'),
      ).id;
    });

    it('mentor replays the typing, scores the rubric and returns the work', async () => {
      await otherMentor.get(`/teach/submissions/${submissionId}`).expect(403);
      const detail = await mentor
        .get(`/teach/submissions/${submissionId}`)
        .expect(200);
      expect(detail.body.flags).toMatchObject({
        burst: true,
        burstMaxChars: 300,
        contentMismatch: false,
      });
      expect(detail.body.typingEvents.length).toBe(26);

      await mentor
        .post(`/teach/submissions/${submissionId}/grade`)
        .send({ rubricScores: { logic: 5 }, feedback: 'x' })
        .expect(400); // every criterion
      const graded = await mentor
        .post(`/teach/submissions/${submissionId}/grade`)
        .send({
          rubricScores: { logic: 5, style: 2 },
          feedback: 'Please write it yourself.',
        })
        .expect(200);
      expect(graded.body).toMatchObject({ status: 'returned', grade: 7 });

      const mine = await student
        .get(`/learn/lessons/${ids.assignmentLesson}/assignment`)
        .expect(200);
      expect(mine.body.submission).toMatchObject({
        status: 'returned',
        grade: 7,
        rubricScores: { logic: 5, style: 2 },
        feedback: 'Please write it yourself.',
      });
      expect(mine.body.submission).not.toHaveProperty('flags');
    });
  });
});
