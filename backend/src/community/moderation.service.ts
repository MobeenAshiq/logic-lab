import { HttpStatus, Injectable } from '@nestjs/common';
import {
  ModerationAction,
  NotificationType,
  ReportStatus,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../auth/auth.types';
import { AppException } from '../common/app-exception';
import { t } from '../common/i18n/en';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { ResolveInput } from './community.schemas';
import { CommunityService } from './community.service';
import { excerpt } from './markdown';

const person = {
  select: { id: true, email: true, profile: { select: { fullName: true } } },
} as const;

/** Admin queue at /admin/moderation: reported posts and answers, grouped by item. */
@Injectable()
export class ModerationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly community: CommunityService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  async queue(status: 'open' | 'closed') {
    const reports = await this.prisma.report.findMany({
      where: {
        status:
          status === 'open' ? ReportStatus.open : { not: ReportStatus.open },
      },
      orderBy: { createdAt: 'asc' },
      take: 500,
      include: {
        reporter: person,
        post: { include: { author: person } },
        answer: {
          include: {
            author: person,
            post: { select: { id: true, title: true } },
          },
        },
      },
    });

    const groups = new Map<
      string,
      {
        targetType: 'post' | 'answer';
        targetId: string;
        postId: string;
        title: string;
        excerpt: string;
        author: { id: string; email: string; fullName: string };
        hidden: boolean;
        deleted: boolean;
        reports: {
          id: string;
          reason: string;
          details: string;
          status: ReportStatus;
          action: ModerationAction | null;
          note: string;
          createdAt: Date;
          reporter: { id: string; email: string; fullName: string };
        }[];
      }
    >();

    for (const r of reports) {
      const item = r.post ?? r.answer;
      if (!item) continue;
      const key = `${r.post ? 'post' : 'answer'}:${item.id}`;
      if (!groups.has(key)) {
        groups.set(key, {
          targetType: r.post ? 'post' : 'answer',
          targetId: item.id,
          postId: r.post ? r.post.id : r.answer!.post.id,
          title: r.post ? r.post.title : r.answer!.post.title,
          excerpt: excerpt(item.body, 400),
          author: {
            id: item.author.id,
            email: item.author.email,
            fullName: item.author.profile?.fullName ?? '',
          },
          hidden: item.hiddenAt !== null,
          deleted: item.deletedAt !== null,
          reports: [],
        });
      }
      groups.get(key)!.reports.push({
        id: r.id,
        reason: r.reason,
        details: r.details,
        status: r.status,
        action: r.action,
        note: r.note,
        createdAt: r.createdAt,
        reporter: {
          id: r.reporter.id,
          email: r.reporter.email,
          fullName: r.reporter.profile?.fullName ?? '',
        },
      });
    }
    // Most-reported first, then oldest.
    return [...groups.values()].sort(
      (a, b) =>
        b.reports.length - a.reports.length ||
        a.reports[0].createdAt.getTime() - b.reports[0].createdAt.getTime(),
    );
  }

  /**
   * hide / restore / delete the item, warn its author, or dismiss the reports.
   * All open reports on the item are closed with the decision; audited.
   */
  async resolve(auth: AuthUser, input: ResolveInput, ip: string | null) {
    const isPost = input.targetType === 'post';
    const item = isPost
      ? await this.prisma.post.findUnique({ where: { id: input.targetId } })
      : await this.prisma.postAnswer.findUnique({
          where: { id: input.targetId },
        });
    if (!item) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        isPost ? 'POST_NOT_FOUND' : 'ANSWER_NOT_FOUND',
      );
    }
    const target = isPost ? { postId: item.id } : { answerId: item.id };
    const now = new Date();
    let warnedUserId: string | null = null;

    await this.prisma.$transaction(async (tx) => {
      switch (input.action) {
        case ModerationAction.hide:
        case ModerationAction.restore: {
          const hiddenAt = input.action === ModerationAction.hide ? now : null;
          if (isPost)
            await tx.post.update({
              where: { id: item.id },
              data: { hiddenAt },
            });
          else
            await tx.postAnswer.update({
              where: { id: item.id },
              data: { hiddenAt },
            });
          break;
        }
        case ModerationAction.delete:
          if (item.deletedAt) break;
          if (isPost)
            await tx.post.update({
              where: { id: item.id },
              data: { deletedAt: now },
            });
          else if ('postId' in item)
            await this.community.removeAnswer(tx, item.id, item.postId);
          break;
        case ModerationAction.warn:
          await tx.userWarning.create({
            data: {
              userId: item.authorId,
              issuedBy: auth.id,
              reason: input.note,
            },
          });
          break;
        case ModerationAction.dismiss:
          break;
      }
      if (input.action === ModerationAction.warn) {
        warnedUserId = item.authorId;
      }
      if (input.action !== ModerationAction.restore) {
        await tx.report.updateMany({
          where: { ...target, status: ReportStatus.open },
          data: {
            status:
              input.action === ModerationAction.dismiss
                ? ReportStatus.dismissed
                : ReportStatus.resolved,
            action: input.action,
            note: input.note,
            resolvedBy: auth.id,
            resolvedAt: now,
          },
        });
      }
      await this.audit.log(
        {
          actorId: auth.id,
          action: `moderation.${input.action}`,
          targetType: input.targetType,
          targetId: item.id,
          metadata: { authorId: item.authorId, note: input.note },
          ip,
        },
        tx,
      );
    });
    if (warnedUserId) {
      await this.notifications.notify(warnedUserId, {
        type: NotificationType.moderation_warning,
        title: t.notifications.warning,
        body: input.note,
        link: '/community',
      });
    }
    return { done: true };
  }
}
