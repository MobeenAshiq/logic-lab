import { HttpStatus, Injectable } from '@nestjs/common';
import { AiFlagStatus, AiSender } from '@prisma/client';
import { AiQuotaService } from '../ai/ai-quota.service';
import { AiRouterService } from '../ai/ai-router.service';
import { coverage, lessonText, tokenSet } from '../ai/ai-text';
import { ADMIN_ROLES, type AuthUser } from '../auth/auth.types';
import { SubscriptionsService } from '../billing/subscriptions.service';
import { AppException } from '../common/app-exception';
import {
  LessonAccessService,
  PAYWALL_URL,
  type ModuleLockInfo,
} from '../learning/lesson-access.service';
import type { AiMessage } from '../lib/ai';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import {
  checkPrompt,
  modelRefusal,
  REFUSAL_PROTOCOL,
  type GuardrailVerdict,
} from './guardrail';
import type { CreateSessionInput, UpdateSessionInput } from './mentor.schemas';

const HISTORY_TURNS = 10;
const LESSONS_IN_CONTEXT = 3;
const LESSON_CHARS = 2500;

const STACK_LABEL: Record<string, string> = {
  nodejs: 'Node.js',
  python: 'Python',
  php: 'PHP',
  nextjs: 'Next.js',
  cpp: 'C++',
  general: 'whichever language suits the question',
};

const sessionSelect = {
  id: true,
  title: true,
  stackType: true,
  courseId: true,
  moduleId: true,
  lastMessageAt: true,
  createdAt: true,
  course: { select: { id: true, slug: true, title: true } },
  module: { select: { id: true, title: true } },
} as const;

const messageSelect = {
  id: true,
  senderType: true,
  content: true,
  flagStatus: true,
  createdAt: true,
} as const;

@Injectable()
export class MentorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly router: AiRouterService,
    private readonly quota: AiQuotaService,
    private readonly lessonAccess: LessonAccessService,
    private readonly subscriptions: SubscriptionsService,
  ) {}

  // --- Sessions ---

  listSessions(auth: AuthUser) {
    return this.prisma.aiSession.findMany({
      where: { userId: auth.id },
      orderBy: { lastMessageAt: 'desc' },
      take: 50,
      select: sessionSelect,
    });
  }

  async getSession(auth: AuthUser, id: string) {
    const session = await this.prisma.aiSession.findFirst({
      where: { id, userId: auth.id },
      select: {
        ...sessionSelect,
        messages: { orderBy: { createdAt: 'asc' }, select: messageSelect },
      },
    });
    if (!session)
      throw new AppException(HttpStatus.NOT_FOUND, 'AI_SESSION_NOT_FOUND');
    return session;
  }

  async createSession(auth: AuthUser, input: CreateSessionInput) {
    await this.checkScope(auth, input.courseId ?? null, input.moduleId ?? null);
    return this.prisma.aiSession.create({
      data: {
        userId: auth.id,
        courseId: input.courseId ?? null,
        moduleId: input.moduleId ?? null,
        stackType: input.stackType,
      },
      select: sessionSelect,
    });
  }

  async updateSession(auth: AuthUser, id: string, input: UpdateSessionInput) {
    const session = await this.owned(auth, id);
    const courseId =
      input.courseId !== undefined ? input.courseId : session.courseId;
    const moduleId =
      input.moduleId !== undefined
        ? input.moduleId
        : courseId === session.courseId
          ? session.moduleId
          : null;
    await this.checkScope(auth, courseId, moduleId);
    return this.prisma.aiSession.update({
      where: { id },
      data: {
        courseId,
        moduleId,
        stackType: input.stackType ?? session.stackType,
        title: input.title ?? session.title,
      },
      select: sessionSelect,
    });
  }

  private async owned(auth: AuthUser, id: string) {
    const session = await this.prisma.aiSession.findFirst({
      where: { id, userId: auth.id },
    });
    if (!session)
      throw new AppException(HttpStatus.NOT_FOUND, 'AI_SESSION_NOT_FOUND');
    return session;
  }

  /** A student may only scope a chat to a course they can study (and a module of it). */
  private async checkScope(
    auth: AuthUser,
    courseId: string | null,
    moduleId: string | null,
  ) {
    if (moduleId && !courseId)
      throw new AppException(HttpStatus.BAD_REQUEST, 'AI_MODULE_NOT_IN_COURSE');
    if (!courseId) return;
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true, slug: true, isPublished: true },
    });
    const isAdmin = ADMIN_ROLES.includes(auth.role);
    if (!course || (!course.isPublished && !isAdmin))
      throw new AppException(HttpStatus.NOT_FOUND, 'COURSE_NOT_FOUND');
    if (moduleId) {
      const mod = await this.prisma.module.findUnique({
        where: { id: moduleId },
        select: { courseId: true },
      });
      if (!mod)
        throw new AppException(HttpStatus.NOT_FOUND, 'MODULE_NOT_FOUND');
      if (mod.courseId !== courseId)
        throw new AppException(
          HttpStatus.BAD_REQUEST,
          'AI_MODULE_NOT_IN_COURSE',
        );
    }
    if (!isAdmin && !(await this.subscriptions.hasAccess(auth.id, courseId))) {
      throw new AppException(HttpStatus.FORBIDDEN, 'SUBSCRIPTION_REQUIRED', {
        paywallUrl: PAYWALL_URL,
        courseSlug: course.slug,
      });
    }
  }

  // --- Chat ---

  async send(auth: AuthUser, sessionId: string, content: string) {
    const config = await this.settings.get('ai_mentor');
    if (!config.enabled)
      throw new AppException(
        HttpStatus.SERVICE_UNAVAILABLE,
        'AI_MENTOR_DISABLED',
      );
    const session = await this.owned(auth, sessionId);

    const blocked = checkPrompt(content, config.blockedPhrases);
    if (blocked) {
      return {
        ...(await this.saveRefusal(
          auth,
          session.id,
          content,
          blocked,
          'local',
          config.refusalMessage,
        )),
        usage: await this.quota.usage(auth),
      };
    }

    const usage = await this.quota.reserve(auth);
    let result;
    try {
      const [history, context] = await Promise.all([
        this.history(session.id),
        this.context(auth, session.courseId, session.moduleId, content),
      ]);
      const system = [
        config.systemPrompt,
        `\nThe student's preferred stack: ${STACK_LABEL[session.stackType] ?? STACK_LABEL.general}. Use it for code examples unless they ask otherwise.`,
        'Format answers in Markdown with fenced code blocks that name their language.',
        context ? `\n<lesson_context>\n${context}\n</lesson_context>` : '',
        REFUSAL_PROTOCOL,
      ].join('\n');
      result = await this.router.complete({
        system,
        messages: [...history, { role: 'user', content }],
        maxOutputTokens: 1600,
      });
    } catch (error) {
      await this.quota.refund(auth);
      throw error;
    }

    const refused = modelRefusal(result.text);
    if (refused) {
      return {
        ...(await this.saveRefusal(
          auth,
          session.id,
          content,
          refused,
          'model',
          config.refusalMessage,
          result,
        )),
        usage,
      };
    }

    const [, assistant] = await this.prisma.$transaction([
      this.prisma.aiChatLog.create({
        data: {
          sessionId: session.id,
          senderType: AiSender.user,
          content,
          tokensUsed: result.tokensIn,
        },
      }),
      this.prisma.aiChatLog.create({
        data: {
          sessionId: session.id,
          senderType: AiSender.assistant,
          content: result.text,
          tokensUsed: result.tokensOut,
          provider: result.provider,
          model: result.model,
        },
        select: messageSelect,
      }),
      this.prisma.aiSession.update({
        where: { id: session.id },
        data: {
          lastMessageAt: new Date(),
          ...(session.title === 'New chat'
            ? { title: titleFrom(content) }
            : {}),
        },
      }),
    ]);
    return { message: assistant, flagged: false, usage };
  }

  private async saveRefusal(
    auth: AuthUser,
    sessionId: string,
    content: string,
    verdict: GuardrailVerdict,
    source: 'local' | 'model',
    refusalMessage: string,
    result?: {
      tokensIn: number;
      tokensOut: number;
      provider: string;
      model: string;
    },
  ) {
    const flagStatus =
      source === 'local' ? AiFlagStatus.blocked : AiFlagStatus.refused;
    const [, assistant] = await this.prisma.$transaction([
      this.prisma.aiChatLog.create({
        data: {
          sessionId,
          senderType: AiSender.user,
          content,
          flagStatus,
          tokensUsed: result?.tokensIn ?? 0,
        },
      }),
      this.prisma.aiChatLog.create({
        data: {
          sessionId,
          senderType: AiSender.assistant,
          content: refusalMessage,
          flagStatus,
          tokensUsed: result?.tokensOut ?? 0,
          provider: result?.provider ?? null,
          model: result?.model ?? null,
        },
        select: messageSelect,
      }),
      this.prisma.securityFlagLog.create({
        data: {
          userId: auth.id,
          sessionId,
          promptText: content,
          category: verdict.category,
          reason: verdict.reason,
          source,
        },
      }),
      this.prisma.aiSession.update({
        where: { id: sessionId },
        data: { lastMessageAt: new Date() },
      }),
    ]);
    return { message: assistant, flagged: true };
  }

  /** Recent turns, server-side (never trusted from the client). Refused exchanges are left out. */
  private async history(sessionId: string): Promise<AiMessage[]> {
    const rows = await this.prisma.aiChatLog.findMany({
      where: { sessionId, flagStatus: AiFlagStatus.none },
      orderBy: { createdAt: 'desc' },
      take: HISTORY_TURNS * 2,
      select: { senderType: true, content: true },
    });
    const turns = rows
      .reverse()
      .map((r) => ({ role: r.senderType, content: r.content.slice(0, 6000) }));
    // Providers expect the conversation to start with a user turn.
    while (turns.length && turns[0].role !== 'user') turns.shift();
    return turns;
  }

  /**
   * Retrieval: picks the lessons in the chat's module (or course) whose text
   * best matches the question. Only published lessons in unlocked modules of a
   * course the student can access are used.
   */
  private async context(
    auth: AuthUser,
    courseId: string | null,
    moduleId: string | null,
    question: string,
  ) {
    if (!courseId) return '';
    const isAdmin = ADMIN_ROLES.includes(auth.role);
    if (!isAdmin && !(await this.subscriptions.hasAccess(auth.id, courseId)))
      return '';
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: {
        title: true,
        modules: {
          where: {
            ...(moduleId ? { id: moduleId } : {}),
            ...(isAdmin ? {} : { isPublished: true }),
          },
          orderBy: { position: 'asc' },
          select: {
            id: true,
            title: true,
            lessons: {
              where: isAdmin ? {} : { isPublished: true },
              orderBy: { position: 'asc' },
              select: { title: true, content: true, notes: true },
            },
          },
        },
      },
    });
    if (!course) return '';
    const locks = isAdmin
      ? new Map<string, ModuleLockInfo>()
      : await this.lessonAccess.moduleLocks(auth.id, courseId);
    const modules = course.modules.filter((m) => !locks.get(m.id)?.locked);
    const lessons = modules.flatMap((m) =>
      m.lessons.map((l) => {
        const text = [l.title, lessonText(l.content), l.notes]
          .filter(Boolean)
          .join('\n');
        return {
          module: m.title,
          title: l.title,
          text,
          score: coverage(question, tokenSet(text)),
        };
      }),
    );
    const picked = lessons
      .filter((l) => l.text.length > l.title.length)
      .sort((a, b) => b.score - a.score)
      .slice(0, LESSONS_IN_CONTEXT);
    const outline = modules
      .map((m) => `- ${m.title}: ${m.lessons.map((l) => l.title).join(', ')}`)
      .join('\n');
    return [
      `Course: ${course.title}`,
      moduleId && modules[0] ? `Current module: ${modules[0].title}` : '',
      `Module outline:\n${outline}`.slice(0, 2000),
      ...picked.map(
        (l) =>
          `### Lesson: ${l.title} (${l.module})\n${l.text.slice(0, LESSON_CHARS)}`,
      ),
    ]
      .filter(Boolean)
      .join('\n\n');
  }
}

function titleFrom(text: string) {
  const line = text.replace(/\s+/g, ' ').trim();
  return line.length > 60 ? `${line.slice(0, 57)}…` : line || 'New chat';
}
