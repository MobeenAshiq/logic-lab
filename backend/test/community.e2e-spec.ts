/**
 * Phase 6 acceptance checks (community Q&A, votes, accepted answers, moderation).
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
import { MailService } from '../src/mail/mail.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { RateLimitService } from '../src/rate-limit/rate-limit.service';

const PASSWORD = 'Secret123pass';
const run = randomUUID().slice(0, 8);
const email = (name: string) => `${name}.${run}@test.logiclab.pk`;
const tag = `loops${run}`;

describe('Phase 6: community Q&A feed', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let admin: TestAgent;
  let mentor: TestAgent;
  let asker: TestAgent;
  let helper: TestAgent;
  let outsider: TestAgent;
  const ids = {
    asker: '',
    track: '',
    trackSlug: '',
    post: '',
    helperAnswer: '',
    mentorAnswer: '',
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

  const feed = (agent: TestAgent, query: Record<string, string> = {}) =>
    agent
      .get('/community/posts')
      .query({ tag, ...query })
      .expect(200);

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
    await createUser(email('mentor'), Role.mentor);
    mentor = await login(email('mentor'));
    ids.asker = await createUser(email('asker'), Role.student);
    await createUser(email('helper'), Role.student);
    await createUser(email('outsider'), Role.student);
    asker = await login(email('asker'));
    helper = await login(email('helper'));
    outsider = await login(email('outsider'));

    const track = await admin
      .post('/admin/content/tracks')
      .send({ title: `Community Track ${run}`, isPublished: true })
      .expect(201);
    ids.track = track.body.id;
    ids.trackSlug = track.body.slug;
    await asker.post('/student/trial').send({ trackId: ids.track }).expect(201);
    await helper
      .post('/student/trial')
      .send({ trackId: ids.track })
      .expect(201);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('posting', () => {
    it('anyone logged in reads; posting needs a trial or plan', async () => {
      await feed(outsider);
      const me = await outsider.get('/community/me').expect(200);
      expect(me.body.canParticipate).toBe(false);
      const res = await outsider
        .post('/community/posts')
        .send({
          title: 'How do loops work?',
          body: 'Please explain loops to me.',
        })
        .expect(403);
      expect(res.body.code).toBe('COMMUNITY_ACCESS_REQUIRED');
      await request(app.getHttpServer()).get('/community/posts').expect(401);
    });

    it('only mentors and admins post pinned announcements', async () => {
      await asker
        .post('/community/posts')
        .send({
          kind: 'announcement',
          title: 'Big news everyone',
          body: 'This should not work.',
        })
        .expect(403);
      const ann = await mentor
        .post('/community/posts')
        .send({
          kind: 'announcement',
          title: `Tip of the week ${run}`,
          body: 'Practice one problem daily.',
          tags: [tag],
        })
        .expect(201);
      expect(ann.body.isPinned).toBe(true);
      const list = await feed(helper);
      expect(list.body.pinned.map((p: { id: string }) => p.id)).toContain(
        ann.body.id,
      );
      expect(list.body.items.map((p: { id: string }) => p.id)).not.toContain(
        ann.body.id,
      );
    });

    it('creates a question with code, tags, track and own images only', async () => {
      const foreign = await asker
        .post('/community/posts')
        .send({
          title: 'Why does my loop never stop?',
          body: `See ![screen](r2:community/${randomUUID()}/${randomUUID()}.png)`,
        })
        .expect(400);
      expect(foreign.body.code).toBe('INVALID_IMAGE_REF');

      const upload = await asker
        .post('/community/uploads')
        .send({ contentType: 'image/png', size: 2048 })
        .expect(201);
      expect(upload.body.key).toMatch(new RegExp(`^community/${ids.asker}/`));
      const post = await asker
        .post('/community/posts')
        .send({
          title: 'Why does my loop never stop?',
          body: `My while loop runs forever.\n\n![screen](r2:${upload.body.key})`,
          codeSnippet: 'let i = 0;\nwhile (i < 5) {\n  console.log(i);\n}',
          codeLanguage: 'javascript',
          tags: [tag, 'JavaScript'],
          trackId: ids.track,
        })
        .expect(201);
      ids.post = post.body.id;
      expect(post.body).toMatchObject({
        kind: 'question',
        tags: [tag, 'javascript'],
        codeLanguage: 'javascript',
      });
      expect(post.body.assetUrls[upload.body.key]).toMatch(/X-Amz-Signature=/);
    });

    it('filters by track and tag, searches titles, lists unanswered', async () => {
      expect(
        (await feed(helper, { track: ids.trackSlug })).body.items.map(
          (p: { id: string }) => p.id,
        ),
      ).toEqual([ids.post]);
      expect(
        (await feed(helper, { search: 'never STOP' })).body.items,
      ).toHaveLength(1);
      expect(
        (await feed(helper, { search: 'pandas' })).body.items,
      ).toHaveLength(0);
      expect(
        (await feed(helper, { sort: 'unanswered' })).body.items,
      ).toHaveLength(1);
    });
  });

  describe('votes', () => {
    it('a user can vote only once per post', async () => {
      const vote = (value: number) =>
        helper
          .put('/community/votes')
          .send({ targetType: 'post', targetId: ids.post, value })
          .expect(200);
      expect((await vote(1)).body.score).toBe(1);
      expect((await vote(1)).body.score).toBe(1); // same vote again: no change
      expect((await vote(-1)).body.score).toBe(-1); // switching moves by 2
      expect((await vote(0)).body.score).toBe(0);
      expect((await vote(1)).body.score).toBe(1);

      const own = await asker
        .put('/community/votes')
        .send({ targetType: 'post', targetId: ids.post, value: 1 })
        .expect(403);
      expect(own.body.code).toBe('CANNOT_VOTE_OWN');

      // The database itself refuses a second vote row.
      const helperId = (
        await prisma.user.findUniqueOrThrow({
          where: { email: email('helper') },
        })
      ).id;
      await expect(
        prisma.vote.create({
          data: { userId: helperId, postId: ids.post, value: 1 },
        }),
      ).rejects.toThrow();
      await expect(
        prisma.vote.create({ data: { userId: helperId, value: 2 } }),
      ).rejects.toThrow();
    });
  });

  describe('answers', () => {
    it('anyone with access answers; mentor answers are marked', async () => {
      const a1 = await helper
        .post(`/community/posts/${ids.post}/answers`)
        .send({ body: 'You never increase i, so the condition stays true.' })
        .expect(201);
      ids.helperAnswer = a1.body.answers[0].id;
      const a2 = await mentor
        .post(`/community/posts/${ids.post}/answers`)
        .send({
          body: 'Add i++ inside the loop body.',
          codeSnippet: 'i++;',
          codeLanguage: 'javascript',
        })
        .expect(201);
      ids.mentorAnswer = a2.body.answers.find(
        (a: { isStaff: boolean }) => a.isStaff,
      ).id;
      expect(a2.body.answerCount).toBe(2);
      expect(
        (await feed(helper, { sort: 'unanswered' })).body.items,
      ).toHaveLength(0);

      await asker
        .put('/community/votes')
        .send({ targetType: 'answer', targetId: ids.mentorAnswer, value: 1 })
        .expect(200);
    });

    it('only the asker or a mentor can accept an answer', async () => {
      const res = await helper
        .post(`/community/posts/${ids.post}/accept`)
        .send({ answerId: ids.helperAnswer })
        .expect(403);
      expect(res.body.code).toBe('NOT_ALLOWED_TO_ACCEPT');

      const accepted = await asker
        .post(`/community/posts/${ids.post}/accept`)
        .send({ answerId: ids.helperAnswer })
        .expect(200);
      expect(accepted.body.acceptedAnswerId).toBe(ids.helperAnswer);
      // Accepted answer is listed first even with a lower score.
      expect(accepted.body.answers[0]).toMatchObject({
        id: ids.helperAnswer,
        accepted: true,
      });

      const byMentor = await mentor
        .post(`/community/posts/${ids.post}/accept`)
        .send({ answerId: ids.mentorAnswer })
        .expect(200);
      expect(byMentor.body.acceptedAnswerId).toBe(ids.mentorAnswer);
      expect((await feed(helper)).body.items[0].accepted).toBe(true);
    });

    it('deleting an accepted answer clears it and updates the count', async () => {
      await asker.delete(`/community/answers/${ids.mentorAnswer}`).expect(403);
      await mentor.delete(`/community/answers/${ids.mentorAnswer}`).expect(204);
      const post = await asker.get(`/community/posts/${ids.post}`).expect(200);
      expect(post.body).toMatchObject({
        acceptedAnswerId: null,
        answerCount: 1,
      });
    });
  });

  describe('reports and moderation', () => {
    it('reported content appears in the admin queue', async () => {
      await helper
        .post('/community/reports')
        .send({
          targetType: 'post',
          targetId: ids.post,
          reason: 'off_topic',
          details: 'Not about the course.',
        })
        .expect(201);
      const again = await helper
        .post('/community/reports')
        .send({ targetType: 'post', targetId: ids.post, reason: 'spam' })
        .expect(409);
      expect(again.body.code).toBe('ALREADY_REPORTED');
      await asker
        .post('/community/reports')
        .send({ targetType: 'post', targetId: ids.post, reason: 'spam' })
        .expect(403); // own post
      await outsider
        .post('/community/reports')
        .send({
          targetType: 'answer',
          targetId: ids.helperAnswer,
          reason: 'abuse',
        })
        .expect(201);

      await helper.get('/admin/moderation').expect(403);
      const queue = await admin.get('/admin/moderation').expect(200);
      const postGroup = queue.body.find(
        (g: { targetId: string }) => g.targetId === ids.post,
      );
      expect(postGroup).toMatchObject({
        targetType: 'post',
        title: 'Why does my loop never stop?',
      });
      expect(postGroup.reports).toHaveLength(1);
      expect(postGroup.reports[0]).toMatchObject({
        reason: 'off_topic',
        details: 'Not about the course.',
      });
      expect(
        queue.body.some(
          (g: { targetId: string }) => g.targetId === ids.helperAnswer,
        ),
      ).toBe(true);
    });

    it('hiding removes the post from the feed; the author still sees it', async () => {
      await admin
        .post('/admin/moderation/resolve')
        .send({
          targetType: 'post',
          targetId: ids.post,
          action: 'hide',
          note: 'Off topic',
        })
        .expect(200);
      expect((await feed(helper)).body.items).toHaveLength(0);
      await helper.get(`/community/posts/${ids.post}`).expect(404);
      const own = await asker.get(`/community/posts/${ids.post}`).expect(200);
      expect(own.body.hidden).toBe(true);

      const closed = await admin
        .get('/admin/moderation')
        .query({ status: 'closed' })
        .expect(200);
      const group = closed.body.find(
        (g: { targetId: string }) => g.targetId === ids.post,
      );
      expect(group.reports[0]).toMatchObject({
        status: 'resolved',
        action: 'hide',
      });

      const logs = await admin
        .get('/admin/audit-logs')
        .query({ targetId: ids.post })
        .expect(200);
      expect(logs.body[0].action).toBe('moderation.hide');

      await admin
        .post('/admin/moderation/resolve')
        .send({ targetType: 'post', targetId: ids.post, action: 'restore' })
        .expect(200);
      await helper.get(`/community/posts/${ids.post}`).expect(200);
    });

    it('warning the author shows them the warning', async () => {
      await admin
        .post('/admin/moderation/resolve')
        .send({
          targetType: 'answer',
          targetId: ids.helperAnswer,
          action: 'warn',
          note: '',
        })
        .expect(400); // a warning needs text
      await admin
        .post('/admin/moderation/resolve')
        .send({
          targetType: 'answer',
          targetId: ids.helperAnswer,
          action: 'warn',
          note: 'Please keep answers respectful.',
        })
        .expect(200);
      const me = await helper.get('/community/me').expect(200);
      expect(me.body.warnings).toMatchObject([
        { reason: 'Please keep answers respectful.' },
      ]);
      await helper.post('/community/me/warnings/acknowledge').expect(204);
      expect(
        (await helper.get('/community/me').expect(200)).body.warnings,
      ).toEqual([]);
    });
  });
});
