import { HttpStatus, Injectable } from '@nestjs/common';
import {
  NotificationType,
  PointReason,
  PostKind,
  Prisma,
  Role,
} from '@prisma/client';
import { ADMIN_ROLES, AuthUser } from '../auth/auth.types';
import { SubscriptionsService } from '../billing/subscriptions.service';
import { AppException } from '../common/app-exception';
import { t } from '../common/i18n/en';
import { NotificationsService } from '../notifications/notifications.service';
import { PointsService } from '../points/points.service';
import { PrismaService } from '../prisma/prisma.service';
import { PRESIGN_TTL_SECONDS, R2Service } from '../storage/r2.service';
import { CommunityImageInput, newUploadKey } from '../storage/uploads';
import {
  AcceptInput,
  AnswerInput,
  CreatePostInput,
  FeedInput,
  ReportInput,
  UpdateAnswerInput,
  UpdatePostInput,
  VoteInput,
} from './community.schemas';
import { excerpt, imageKeys, ownImagesOnly } from './markdown';

const PAGE_SIZE = 20;
const PINNED_LIMIT = 5;

const authorSelect = {
  select: {
    id: true,
    profile: { select: { fullName: true, avatarUrl: true, role: true } },
  },
} satisfies Prisma.UserDefaultArgs;

type AuthorRow = Prisma.UserGetPayload<typeof authorSelect>;

function authorView(u: AuthorRow) {
  return {
    id: u.id,
    fullName: u.profile?.fullName ?? '',
    avatarUrl: u.profile?.avatarUrl ?? null,
    role: u.profile?.role ?? Role.student,
  };
}

function isStaff(auth: AuthUser) {
  return auth.role === Role.mentor || ADMIN_ROLES.includes(auth.role);
}

function isUniqueViolation(err: unknown) {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002'
  );
}

/**
 * Community Q&A: anyone logged in can read; posting, answering and voting
 * need a live trial/subscription (mentors and admins always can).
 */
@Injectable()
export class CommunityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptions: SubscriptionsService,
    private readonly r2: R2Service,
    private readonly points: PointsService,
    private readonly notifications: NotificationsService,
  ) {}

  async canParticipate(auth: AuthUser) {
    return isStaff(auth) || (await this.subscriptions.hasAnyAccess(auth.id));
  }

  private async assertParticipant(auth: AuthUser) {
    if (!(await this.canParticipate(auth))) {
      throw new AppException(HttpStatus.FORBIDDEN, 'COMMUNITY_ACCESS_REQUIRED');
    }
  }

  private assertOwnImages(
    auth: AuthUser,
    ...texts: (string | null | undefined)[]
  ) {
    if (!ownImagesOnly(auth.id, ...texts)) {
      throw new AppException(HttpStatus.BAD_REQUEST, 'INVALID_IMAGE_REF');
    }
  }

  /** Who the user is in the community: can they post, and unread moderator warnings. */
  async me(auth: AuthUser) {
    const [canParticipate, warnings] = await Promise.all([
      this.canParticipate(auth),
      this.prisma.userWarning.findMany({
        where: { userId: auth.id, acknowledgedAt: null },
        orderBy: { createdAt: 'desc' },
        select: { id: true, reason: true, createdAt: true },
      }),
    ]);
    return { canParticipate, isStaff: isStaff(auth), warnings };
  }

  async acknowledgeWarnings(auth: AuthUser) {
    await this.prisma.userWarning.updateMany({
      where: { userId: auth.id, acknowledgedAt: null },
      data: { acknowledgedAt: new Date() },
    });
  }

  async imageUploadUrl(auth: AuthUser, input: CommunityImageInput) {
    await this.assertParticipant(auth);
    const key = newUploadKey('community-image', input.contentType, auth.id);
    return {
      key,
      uploadUrl: await this.r2.getUploadUrl(key, input.contentType, input.size),
      method: 'PUT',
      headers: { 'Content-Type': input.contentType },
      expiresInSeconds: PRESIGN_TTL_SECONDS,
    };
  }

  // ---------------------------------------------------------------- feed

  async feed(auth: AuthUser, q: FeedInput) {
    const where: Prisma.PostWhereInput = {
      deletedAt: null,
      hiddenAt: null,
      kind: PostKind.question,
      ...(q.track && { track: { slug: q.track } }),
      ...(q.tag && { tags: { has: q.tag } }),
      ...(q.search && { title: { contains: q.search, mode: 'insensitive' } }),
      ...(q.sort === 'unanswered' && { answerCount: 0 }),
    };
    const orderBy: Prisma.PostOrderByWithRelationInput[] =
      q.sort === 'top'
        ? [{ score: 'desc' }, { createdAt: 'desc' }]
        : [{ createdAt: 'desc' }];
    const include = {
      author: authorSelect,
      track: { select: { id: true, slug: true, title: true } },
    } satisfies Prisma.PostInclude;

    const [total, posts, pinned] = await Promise.all([
      this.prisma.post.count({ where }),
      this.prisma.post.findMany({
        where,
        orderBy,
        skip: (q.page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        include,
      }),
      q.page === 1
        ? this.prisma.post.findMany({
            where: {
              deletedAt: null,
              hiddenAt: null,
              AND: [
                { OR: [{ kind: PostKind.announcement }, { isPinned: true }] },
                // Track filter: that track's pins plus site-wide ones.
                q.track
                  ? { OR: [{ track: { slug: q.track } }, { trackId: null }] }
                  : {},
              ],
            },
            orderBy: { createdAt: 'desc' },
            take: PINNED_LIMIT,
            include,
          })
        : Promise.resolve([]),
    ]);

    const ids = [...posts, ...pinned].map((p) => p.id);
    const myVotes = await this.prisma.vote.findMany({
      where: { userId: auth.id, postId: { in: ids } },
      select: { postId: true, value: true },
    });
    const voteOf = new Map(myVotes.map((v) => [v.postId, v.value]));
    const card = (p: (typeof posts)[number]) => ({
      id: p.id,
      kind: p.kind,
      title: p.title,
      excerpt: excerpt(p.body),
      tags: p.tags,
      track: p.track,
      score: p.score,
      answerCount: p.answerCount,
      accepted: p.acceptedAnswerId !== null,
      isPinned: p.isPinned || p.kind === PostKind.announcement,
      myVote: voteOf.get(p.id) ?? 0,
      author: authorView(p.author),
      createdAt: p.createdAt,
      lastActivityAt: p.lastActivityAt,
    });
    return {
      total,
      page: q.page,
      pageSize: PAGE_SIZE,
      pinned: pinned.map(card),
      items: posts.map(card),
    };
  }

  /** Popular tags, for the feed's tag filter. */
  async tags() {
    const rows = await this.prisma.$queryRaw<{ tag: string; count: bigint }[]>`
      SELECT unnest(tags) AS tag, COUNT(*) AS count FROM posts
      WHERE deleted_at IS NULL AND hidden_at IS NULL
      GROUP BY tag ORDER BY count DESC, tag ASC LIMIT 30`;
    return rows.map((r) => ({ tag: r.tag, count: Number(r.count) }));
  }

  // ---------------------------------------------------------------- post page

  async post(auth: AuthUser, id: string) {
    const admin = ADMIN_ROLES.includes(auth.role);
    const post = await this.prisma.post.findFirst({
      where: { id, deletedAt: null },
      include: {
        author: authorSelect,
        track: { select: { id: true, slug: true, title: true } },
        answers: {
          where: { deletedAt: null },
          include: { author: authorSelect },
        },
      },
    });
    // Hidden posts stay visible to their author (with a notice) and to admins.
    if (!post || (post.hiddenAt && !admin && post.authorId !== auth.id)) {
      throw new AppException(HttpStatus.NOT_FOUND, 'POST_NOT_FOUND');
    }
    const answers = post.answers
      .filter((a) => !a.hiddenAt || admin || a.authorId === auth.id)
      .sort(
        (a, b) =>
          Number(b.id === post.acceptedAnswerId) -
            Number(a.id === post.acceptedAnswerId) ||
          b.score - a.score ||
          a.createdAt.getTime() - b.createdAt.getTime(),
      );

    const [votes, reported, assetUrls] = await Promise.all([
      this.prisma.vote.findMany({
        where: {
          userId: auth.id,
          OR: [
            { postId: post.id },
            { answerId: { in: answers.map((a) => a.id) } },
          ],
        },
      }),
      this.prisma.report.findMany({
        where: {
          reporterId: auth.id,
          OR: [
            { postId: post.id },
            { answerId: { in: answers.map((a) => a.id) } },
          ],
        },
        select: { postId: true, answerId: true },
      }),
      this.r2.getDownloadUrls(
        imageKeys(post.body, ...answers.map((a) => a.body)),
      ),
    ]);
    const voteOf = new Map(votes.map((v) => [v.postId ?? v.answerId, v.value]));
    const reportedIds = new Set(reported.map((r) => r.postId ?? r.answerId));
    const canAccept =
      post.kind === PostKind.question &&
      (post.authorId === auth.id || isStaff(auth));

    return {
      id: post.id,
      kind: post.kind,
      title: post.title,
      body: post.body,
      codeSnippet: post.codeSnippet,
      codeLanguage: post.codeLanguage,
      tags: post.tags,
      track: post.track,
      score: post.score,
      answerCount: post.answerCount,
      acceptedAnswerId: post.acceptedAnswerId,
      isPinned: post.isPinned || post.kind === PostKind.announcement,
      hidden: post.hiddenAt !== null,
      author: authorView(post.author),
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
      myVote: voteOf.get(post.id) ?? 0,
      reportedByMe: reportedIds.has(post.id),
      isMine: post.authorId === auth.id,
      canAccept,
      canParticipate: await this.canParticipate(auth),
      assetUrls,
      answers: answers.map((a) => ({
        id: a.id,
        body: a.body,
        codeSnippet: a.codeSnippet,
        codeLanguage: a.codeLanguage,
        score: a.score,
        isStaff: a.isStaff,
        accepted: a.id === post.acceptedAnswerId,
        hidden: a.hiddenAt !== null,
        author: authorView(a.author),
        createdAt: a.createdAt,
        updatedAt: a.updatedAt,
        myVote: voteOf.get(a.id) ?? 0,
        reportedByMe: reportedIds.has(a.id),
        isMine: a.authorId === auth.id,
      })),
    };
  }

  // ---------------------------------------------------------------- writing

  async createPost(auth: AuthUser, input: CreatePostInput) {
    await this.assertParticipant(auth);
    if (input.kind === PostKind.announcement && !isStaff(auth)) {
      throw new AppException(HttpStatus.FORBIDDEN, 'STAFF_ONLY_ANNOUNCEMENT');
    }
    this.assertOwnImages(auth, input.body);
    if (input.trackId) await this.assertTrack(input.trackId);
    const post = await this.prisma.post.create({
      data: {
        authorId: auth.id,
        kind: input.kind,
        title: input.title,
        body: input.body,
        codeSnippet: input.codeSnippet || null,
        codeLanguage: input.codeSnippet
          ? (input.codeLanguage ?? 'plaintext')
          : null,
        tags: input.tags,
        trackId: input.trackId ?? null,
        isPinned: input.kind === PostKind.announcement,
      },
    });
    return this.post(auth, post.id);
  }

  async updatePost(auth: AuthUser, id: string, input: UpdatePostInput) {
    const post = await this.findPost(id);
    const { isPinned, ...rest } = input;
    if (
      post.authorId !== auth.id &&
      !(isPinned !== undefined && isStaff(auth))
    ) {
      throw new AppException(HttpStatus.FORBIDDEN, 'NOT_YOUR_CONTENT');
    }
    if (isPinned !== undefined && !isStaff(auth)) {
      throw new AppException(HttpStatus.FORBIDDEN, 'STAFF_ONLY_ANNOUNCEMENT');
    }
    this.assertOwnImages(auth, rest.body);
    if (rest.trackId) await this.assertTrack(rest.trackId);
    await this.prisma.post.update({
      where: { id },
      data: {
        ...(post.authorId === auth.id ? rest : {}),
        ...(isPinned !== undefined && { isPinned }),
        ...(rest.codeSnippet !== undefined && {
          codeSnippet: rest.codeSnippet || null,
          codeLanguage: rest.codeSnippet
            ? (rest.codeLanguage ?? 'plaintext')
            : null,
        }),
      },
    });
    return this.post(auth, id);
  }

  async deletePost(auth: AuthUser, id: string) {
    const post = await this.findPost(id);
    if (post.authorId !== auth.id) {
      throw new AppException(HttpStatus.FORBIDDEN, 'NOT_YOUR_CONTENT');
    }
    await this.prisma.post.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async answer(auth: AuthUser, postId: string, input: AnswerInput) {
    await this.assertParticipant(auth);
    const post = await this.findPost(postId);
    if (post.hiddenAt)
      throw new AppException(HttpStatus.NOT_FOUND, 'POST_NOT_FOUND');
    this.assertOwnImages(auth, input.body);
    await this.prisma.$transaction([
      this.prisma.postAnswer.create({
        data: {
          postId,
          authorId: auth.id,
          body: input.body,
          codeSnippet: input.codeSnippet || null,
          codeLanguage: input.codeSnippet
            ? (input.codeLanguage ?? 'plaintext')
            : null,
          isStaff: isStaff(auth),
        },
      }),
      this.prisma.post.update({
        where: { id: postId },
        data: { answerCount: { increment: 1 }, lastActivityAt: new Date() },
      }),
    ]);
    if (post.authorId !== auth.id) {
      await this.notifications.notify(post.authorId, {
        type: NotificationType.new_answer,
        title: t.notifications.newAnswer(post.title),
        link: `/community/posts/${postId}`,
      });
    }
    return this.post(auth, postId);
  }

  async updateAnswer(auth: AuthUser, id: string, input: UpdateAnswerInput) {
    const answer = await this.findAnswer(id);
    if (answer.authorId !== auth.id) {
      throw new AppException(HttpStatus.FORBIDDEN, 'NOT_YOUR_CONTENT');
    }
    this.assertOwnImages(auth, input.body);
    await this.prisma.postAnswer.update({
      where: { id },
      data: {
        ...input,
        ...(input.codeSnippet !== undefined && {
          codeSnippet: input.codeSnippet || null,
          codeLanguage: input.codeSnippet
            ? (input.codeLanguage ?? 'plaintext')
            : null,
        }),
      },
    });
    return this.post(auth, answer.postId);
  }

  async deleteAnswer(auth: AuthUser, id: string) {
    const answer = await this.findAnswer(id);
    if (answer.authorId !== auth.id) {
      throw new AppException(HttpStatus.FORBIDDEN, 'NOT_YOUR_CONTENT');
    }
    await this.removeAnswer(this.prisma, answer.id, answer.postId);
  }

  /** Soft-deletes an answer and keeps the post's count and accepted answer in sync. */
  async removeAnswer(
    tx: Prisma.TransactionClient,
    answerId: string,
    postId: string,
  ) {
    await tx.postAnswer.update({
      where: { id: answerId },
      data: { deletedAt: new Date() },
    });
    await tx.post.updateMany({
      where: { id: postId, acceptedAnswerId: answerId },
      data: { acceptedAnswerId: null },
    });
    await tx.post.update({
      where: { id: postId },
      data: { answerCount: { decrement: 1 } },
    });
  }

  // ---------------------------------------------------------------- votes, accept, report

  /**
   * One vote per user per item (unique index). Changing the vote adjusts the
   * score by the difference; 0 removes it. Scores are updated in the same
   * transaction under a row lock.
   */
  async vote(auth: AuthUser, input: VoteInput) {
    await this.assertParticipant(auth);
    const isPost = input.targetType === 'post';
    const target = isPost
      ? await this.findPost(input.targetId)
      : await this.findAnswer(input.targetId);
    if (target.hiddenAt)
      throw new AppException(
        HttpStatus.NOT_FOUND,
        isPost ? 'POST_NOT_FOUND' : 'ANSWER_NOT_FOUND',
      );
    if (target.authorId === auth.id) {
      throw new AppException(HttpStatus.FORBIDDEN, 'CANNOT_VOTE_OWN');
    }
    const key = isPost
      ? { postId: input.targetId }
      : { answerId: input.targetId };

    return this.prisma.$transaction(async (tx) => {
      if (isPost) {
        await tx.$queryRaw`SELECT id FROM posts WHERE id = ${input.targetId}::uuid FOR UPDATE`;
      } else {
        await tx.$queryRaw`SELECT id FROM post_answers WHERE id = ${input.targetId}::uuid FOR UPDATE`;
      }
      const existing = await tx.vote.findFirst({
        where: { userId: auth.id, ...key },
      });
      const delta = input.value - (existing?.value ?? 0);
      if (input.value === 0) {
        if (existing) await tx.vote.delete({ where: { id: existing.id } });
      } else if (existing) {
        await tx.vote.update({
          where: { id: existing.id },
          data: { value: input.value },
        });
      } else {
        await tx.vote.create({
          data: { userId: auth.id, ...key, value: input.value },
        });
      }
      const updated = isPost
        ? await tx.post.update({
            where: { id: input.targetId },
            data: { score: { increment: delta } },
          })
        : await tx.postAnswer.update({
            where: { id: input.targetId },
            data: { score: { increment: delta } },
          });
      return { score: updated.score, myVote: input.value };
    });
  }

  /** The asker or a mentor/admin marks one answer as accepted (or clears it with null). */
  async accept(auth: AuthUser, postId: string, input: AcceptInput) {
    const post = await this.findPost(postId);
    if (
      post.kind !== PostKind.question ||
      (post.authorId !== auth.id && !isStaff(auth))
    ) {
      throw new AppException(HttpStatus.FORBIDDEN, 'NOT_ALLOWED_TO_ACCEPT');
    }
    const answer = input.answerId
      ? await this.findAnswer(input.answerId)
      : null;
    if (answer && answer.postId !== postId) {
      throw new AppException(HttpStatus.BAD_REQUEST, 'NOT_AN_ANSWER_OF_POST');
    }
    const previousId = post.acceptedAnswerId;
    await this.prisma.post.update({
      where: { id: postId },
      data: { acceptedAnswerId: input.answerId, lastActivityAt: new Date() },
    });

    // Points follow the accepted answer: the previous one loses them, the new one earns them.
    if (previousId && previousId !== input.answerId) {
      const previous = await this.prisma.postAnswer.findUnique({
        where: { id: previousId },
      });
      if (previous) {
        await this.points.revoke(
          previous.authorId,
          PointReason.accepted_answer,
          previous.id,
        );
      }
    }
    // Accepting your own answer to your own question earns nothing.
    if (
      answer &&
      answer.id !== previousId &&
      answer.authorId !== post.authorId
    ) {
      await this.points.award(
        answer.authorId,
        PointReason.accepted_answer,
        answer.id,
        {
          trackId: post.trackId,
        },
      );
      await this.notifications.notify(answer.authorId, {
        type: NotificationType.answer_accepted,
        title: t.notifications.answerAccepted(post.title),
        link: `/community/posts/${postId}`,
      });
    }
    return this.post(auth, postId);
  }

  async report(auth: AuthUser, input: ReportInput) {
    const isPost = input.targetType === 'post';
    const target = isPost
      ? await this.findPost(input.targetId)
      : await this.findAnswer(input.targetId);
    if (target.authorId === auth.id) {
      throw new AppException(HttpStatus.FORBIDDEN, 'CANNOT_REPORT_OWN');
    }
    try {
      await this.prisma.report.create({
        data: {
          reporterId: auth.id,
          ...(isPost
            ? { postId: input.targetId }
            : { answerId: input.targetId }),
          reason: input.reason,
          details: input.details,
        },
      });
    } catch (err) {
      if (isUniqueViolation(err))
        throw new AppException(HttpStatus.CONFLICT, 'ALREADY_REPORTED');
      throw err;
    }
    return { reported: true };
  }

  // ---------------------------------------------------------------- helpers

  private async findPost(id: string) {
    const post = await this.prisma.post.findFirst({
      where: { id, deletedAt: null },
    });
    if (!post) throw new AppException(HttpStatus.NOT_FOUND, 'POST_NOT_FOUND');
    return post;
  }

  private async findAnswer(id: string) {
    const answer = await this.prisma.postAnswer.findFirst({
      where: { id, deletedAt: null, post: { deletedAt: null } },
    });
    if (!answer)
      throw new AppException(HttpStatus.NOT_FOUND, 'ANSWER_NOT_FOUND');
    return answer;
  }

  private async assertTrack(trackId: string) {
    const exists = await this.prisma.track.count({
      where: { id: trackId, isPublished: true },
    });
    if (!exists)
      throw new AppException(HttpStatus.NOT_FOUND, 'TRACK_NOT_FOUND');
  }
}
