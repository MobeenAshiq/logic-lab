import { HttpStatus, Injectable } from '@nestjs/common';
import {
  ConversationStatus,
  NotificationType,
  Prisma,
  Role,
} from '@prisma/client';
import { ADMIN_ROLES, AuthUser } from '../auth/auth.types';
import { SubscriptionsService } from '../billing/subscriptions.service';
import { AppException } from '../common/app-exception';
import { t } from '../common/i18n/en';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { PRESIGN_TTL_SECONDS, R2Service } from '../storage/r2.service';
import { ChatImageInput, isUploadKey, newUploadKey } from '../storage/uploads';
import {
  OfficeHoursInput,
  OpenDoubtInput,
  SendMessageInput,
} from './chat.schemas';
import { isWithin, Slot, toHHMM, toMinutes } from './office-hours';

const MESSAGE_PAGE = 200;

const person = {
  select: {
    id: true,
    profile: { select: { fullName: true, avatarUrl: true, role: true } },
  },
} satisfies Prisma.UserDefaultArgs;

const conversationInclude = {
  student: person,
  mentor: person,
  course: { select: { id: true, title: true, slug: true } },
} satisfies Prisma.ConversationInclude;

type ConversationRow = Prisma.ConversationGetPayload<{
  include: typeof conversationInclude;
}>;
type PersonRow = Prisma.UserGetPayload<typeof person>;

const personView = (p: PersonRow | null) =>
  p && {
    id: p.id,
    fullName: p.profile?.fullName ?? '',
    avatarUrl: p.profile?.avatarUrl ?? null,
    role: p.profile?.role ?? Role.student,
  };

function isAdmin(auth: AuthUser) {
  return ADMIN_ROLES.includes(auth.role);
}

/**
 * Doubts: a student opens one from a course; it waits in the queue of that
 * course's mentors until one claims it. Messages go over HTTP and are pushed
 * to both sides over the socket.
 */
@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptions: SubscriptionsService,
    private readonly realtime: RealtimeService,
    private readonly notifications: NotificationsService,
    private readonly r2: R2Service,
  ) {}

  // ---------------------------------------------------------------- helpers

  private async courseMentorIds(courseId: string) {
    const rows = await this.prisma.courseMentor.findMany({
      where: { courseId },
      select: { mentorId: true },
    });
    return rows.map((r) => r.mentorId);
  }

  /** Who may open the conversation, and from which side. */
  private async load(auth: AuthUser, id: string) {
    const c = await this.prisma.conversation.findUnique({
      where: { id },
      include: conversationInclude,
    });
    if (!c)
      throw new AppException(HttpStatus.NOT_FOUND, 'CONVERSATION_NOT_FOUND');
    if (c.studentId === auth.id) return { c, side: 'student' as const };
    if (c.mentorId === auth.id) return { c, side: 'mentor' as const };
    if (isAdmin(auth)) return { c, side: 'staff' as const };
    // Course mentors can see waiting doubts (to decide whether to claim them).
    if (auth.role === Role.mentor && c.status === ConversationStatus.waiting) {
      const mentors = await this.courseMentorIds(c.courseId);
      if (mentors.includes(auth.id)) return { c, side: 'staff' as const };
    }
    throw new AppException(HttpStatus.FORBIDDEN, 'NOT_CONVERSATION_MEMBER');
  }

  private assertOwnAttachment(auth: AuthUser, key: string | null | undefined) {
    if (key && !isUploadKey('chat-image', key, auth.id)) {
      throw new AppException(HttpStatus.BAD_REQUEST, 'INVALID_IMAGE_REF');
    }
  }

  private summary(c: ConversationRow, viewerId: string, unread = 0) {
    return {
      id: c.id,
      subject: c.subject,
      status: c.status,
      course: c.course,
      student: personView(c.student),
      mentor: personView(c.mentor),
      lastMessageAt: c.lastMessageAt,
      createdAt: c.createdAt,
      unread,
      isMine: c.studentId === viewerId || c.mentorId === viewerId,
    };
  }

  private async unreadFor(userId: string, rows: ConversationRow[]) {
    const counts = await Promise.all(
      rows.map((c) => {
        const since =
          c.studentId === userId ? c.studentLastReadAt : c.mentorLastReadAt;
        return this.prisma.message.count({
          where: {
            conversationId: c.id,
            senderId: { not: userId },
            ...(since && { createdAt: { gt: since } }),
          },
        });
      }),
    );
    return counts;
  }

  /** Office hours of the assigned mentor, or of all course mentors while waiting. */
  private async availability(c: { mentorId: string | null; courseId: string }) {
    const mentorIds = c.mentorId
      ? [c.mentorId]
      : await this.courseMentorIds(c.courseId);
    const slots = await this.prisma.officeHourSlot.findMany({
      where: { mentorId: { in: mentorIds } },
      orderBy: [{ weekday: 'asc' }, { startMinute: 'asc' }],
    });
    if (slots.length === 0)
      return { hasOfficeHours: false, withinOfficeHours: true, slots: [] };
    return {
      hasOfficeHours: true,
      withinOfficeHours: isWithin(slots),
      slots: slots.map((s) => ({
        weekday: s.weekday,
        start: toHHMM(s.startMinute),
        end: toHHMM(s.endMinute),
      })),
    };
  }

  // ---------------------------------------------------------------- student

  async uploadUrl(auth: AuthUser, input: ChatImageInput) {
    const key = newUploadKey('chat-image', input.contentType, auth.id);
    return {
      key,
      uploadUrl: await this.r2.getUploadUrl(key, input.contentType, input.size),
      method: 'PUT',
      headers: { 'Content-Type': input.contentType },
      expiresInSeconds: PRESIGN_TTL_SECONDS,
    };
  }

  /** A student asks a doubt about a course they have access to. */
  async open(auth: AuthUser, input: OpenDoubtInput) {
    if (!(await this.subscriptions.hasAccess(auth.id, input.courseId))) {
      throw new AppException(HttpStatus.FORBIDDEN, 'SUBSCRIPTION_REQUIRED', {
        paywallUrl: '/student/billing',
      });
    }
    this.assertOwnAttachment(auth, input.attachmentKey);
    const now = new Date();
    const c = await this.prisma.conversation.create({
      data: {
        studentId: auth.id,
        courseId: input.courseId,
        subject: input.subject,
        studentLastReadAt: now,
        lastMessageAt: now,
        messages: {
          create: {
            senderId: auth.id,
            body: input.body,
            attachmentKey: input.attachmentKey ?? null,
          },
        },
      },
      include: conversationInclude,
    });
    const mentors = await this.courseMentorIds(c.courseId);
    this.realtime.toUsers(mentors, 'queue:updated', { conversationId: c.id });
    await this.notifications.notifyMany(
      mentors,
      {
        type: NotificationType.new_doubt,
        title: t.notifications.newDoubt(c.course.title),
        body: c.subject,
        link: `/mentor/doubts/${c.id}`,
      },
      { email: true },
    );
    return this.get(auth, c.id);
  }

  /** My conversations: as the student, or as the assigned mentor. */
  async mine(auth: AuthUser, status: 'active' | 'closed') {
    const rows = await this.prisma.conversation.findMany({
      where: {
        OR: [{ studentId: auth.id }, { mentorId: auth.id }],
        status:
          status === 'closed'
            ? ConversationStatus.closed
            : { not: ConversationStatus.closed },
      },
      orderBy: { lastMessageAt: 'desc' },
      take: 100,
      include: conversationInclude,
    });
    const unread = await this.unreadFor(auth.id, rows);
    return rows.map((c, i) => this.summary(c, auth.id, unread[i]));
  }

  /** Mentor queue: waiting doubts in the courses I teach (admins: all). */
  async queue(auth: AuthUser) {
    const rows = await this.prisma.conversation.findMany({
      where: {
        status: ConversationStatus.waiting,
        ...(isAdmin(auth)
          ? {}
          : { course: { mentors: { some: { mentorId: auth.id } } } }),
      },
      orderBy: { createdAt: 'asc' },
      take: 100,
      include: conversationInclude,
    });
    return rows.map((c) => this.summary(c, auth.id));
  }

  async get(auth: AuthUser, id: string) {
    const { c, side } = await this.load(auth, id);
    const messages = await this.prisma.message.findMany({
      where: { conversationId: id },
      orderBy: { createdAt: 'desc' },
      take: MESSAGE_PAGE,
    });
    messages.reverse();
    const assetUrls = await this.r2.getDownloadUrls(
      messages.flatMap((m) => (m.attachmentKey ? [m.attachmentKey] : [])),
    );
    const canClaim =
      c.status === ConversationStatus.waiting &&
      side === 'staff' &&
      auth.role !== Role.student;
    return {
      ...this.summary(c, auth.id),
      side,
      canClaim,
      canSend:
        c.status !== ConversationStatus.closed &&
        (side === 'student' || side === 'mentor' || canClaim),
      studentLastReadAt: c.studentLastReadAt,
      mentorLastReadAt: c.mentorLastReadAt,
      availability: await this.availability(c),
      assetUrls,
      messages: messages.map((m) => ({
        id: m.id,
        senderId: m.senderId,
        body: m.body,
        attachmentKey: m.attachmentKey,
        createdAt: m.createdAt,
      })),
    };
  }

  // ---------------------------------------------------------------- mentor

  /** First mentor to claim gets it (atomic: the update only matches while still waiting). */
  async claim(auth: AuthUser, id: string) {
    const { c } = await this.load(auth, id);
    if (auth.role === Role.student) {
      throw new AppException(HttpStatus.FORBIDDEN, 'NOT_CONVERSATION_MEMBER');
    }
    const now = new Date();
    const { count } = await this.prisma.conversation.updateMany({
      where: { id, status: ConversationStatus.waiting },
      data: {
        status: ConversationStatus.open,
        mentorId: auth.id,
        claimedAt: now,
        mentorLastReadAt: now,
      },
    });
    if (count === 0)
      throw new AppException(HttpStatus.CONFLICT, 'ALREADY_CLAIMED');
    const mentors = await this.courseMentorIds(c.courseId);
    this.realtime.toUsers(mentors, 'queue:updated', { conversationId: id });
    this.realtime.toUser(c.studentId, 'conversation:updated', {
      conversationId: id,
    });
    const me = await this.prisma.profile.findUnique({
      where: { id: auth.id },
      select: { fullName: true },
    });
    await this.notifications.notify(c.studentId, {
      type: NotificationType.doubt_claimed,
      title: t.notifications.doubtClaimed(me?.fullName ?? ''),
      body: c.subject,
      link: `/student/doubts/${id}`,
    });
    return this.get(auth, id);
  }

  // ---------------------------------------------------------------- both sides

  async send(auth: AuthUser, id: string, input: SendMessageInput) {
    let { c, side } = await this.load(auth, id);
    if (c.status === ConversationStatus.closed) {
      throw new AppException(HttpStatus.CONFLICT, 'CONVERSATION_CLOSED');
    }
    // A course mentor replying to a waiting doubt picks it up.
    if (side === 'staff' && c.status === ConversationStatus.waiting) {
      await this.claim(auth, id);
      ({ c, side } = await this.load(auth, id));
    }
    if (side !== 'student' && side !== 'mentor') {
      throw new AppException(HttpStatus.FORBIDDEN, 'NOT_CONVERSATION_MEMBER');
    }
    this.assertOwnAttachment(auth, input.attachmentKey);

    const now = new Date();
    const recipientId = side === 'student' ? c.mentorId : c.studentId;
    const recipientLastRead =
      side === 'student' ? c.mentorLastReadAt : c.studentLastReadAt;
    // Notify only when the other side had caught up (avoids one alert per message).
    const recipientCaughtUp =
      !recipientLastRead || recipientLastRead >= c.lastMessageAt;

    const [message] = await this.prisma.$transaction([
      this.prisma.message.create({
        data: {
          conversationId: id,
          senderId: auth.id,
          body: input.body,
          attachmentKey: input.attachmentKey ?? null,
        },
      }),
      this.prisma.conversation.update({
        where: { id },
        data: {
          lastMessageAt: now,
          ...(side === 'student'
            ? { studentLastReadAt: now }
            : { mentorLastReadAt: now }),
        },
      }),
    ]);

    const assetUrls = await this.r2.getDownloadUrls(
      message.attachmentKey ? [message.attachmentKey] : [],
    );
    const payload = {
      conversationId: id,
      message: {
        id: message.id,
        senderId: message.senderId,
        body: message.body,
        attachmentKey: message.attachmentKey,
        createdAt: message.createdAt,
      },
      assetUrls,
    };
    this.realtime.toUsers(
      [c.studentId, ...(c.mentorId ? [c.mentorId] : [])],
      'message:new',
      payload,
    );

    if (recipientId && recipientCaughtUp) {
      const sender = side === 'student' ? c.student : c.mentor;
      await this.notifications.notify(
        recipientId,
        {
          type: NotificationType.chat_reply,
          title: t.notifications.chatReply(sender?.profile?.fullName ?? ''),
          body: input.body.slice(0, 200),
          link:
            side === 'student'
              ? `/mentor/doubts/${id}`
              : `/student/doubts/${id}`,
        },
        // Email students when their mentor replies; mentors get the in-app bell.
        { email: side === 'mentor' },
      );
    }
    return payload;
  }

  /** Read receipt: everything up to now is seen by my side. */
  async read(auth: AuthUser, id: string) {
    const { c, side } = await this.load(auth, id);
    if (side !== 'student' && side !== 'mentor') return { readAt: null };
    const now = new Date();
    await this.prisma.conversation.update({
      where: { id },
      data:
        side === 'student'
          ? { studentLastReadAt: now }
          : { mentorLastReadAt: now },
    });
    const other = side === 'student' ? c.mentorId : c.studentId;
    if (other)
      this.realtime.toUser(other, 'message:read', {
        conversationId: id,
        side,
        readAt: now,
      });
    return { readAt: now };
  }

  async close(auth: AuthUser, id: string) {
    const { c, side } = await this.load(auth, id);
    if (side !== 'student' && side !== 'mentor' && !isAdmin(auth)) {
      throw new AppException(HttpStatus.FORBIDDEN, 'NOT_CONVERSATION_MEMBER');
    }
    await this.prisma.conversation.update({
      where: { id },
      data: { status: ConversationStatus.closed, closedAt: new Date() },
    });
    const members = [c.studentId, ...(c.mentorId ? [c.mentorId] : [])];
    this.realtime.toUsers(members, 'conversation:updated', {
      conversationId: id,
    });
    if (c.status === ConversationStatus.waiting) {
      this.realtime.toUsers(
        await this.courseMentorIds(c.courseId),
        'queue:updated',
        {
          conversationId: id,
        },
      );
    }
    return this.get(auth, id);
  }

  // ---------------------------------------------------------------- office hours

  async officeHours(mentorId: string) {
    const slots = await this.prisma.officeHourSlot.findMany({
      where: { mentorId },
      orderBy: [{ weekday: 'asc' }, { startMinute: 'asc' }],
    });
    return {
      slots: slots.map((s) => ({
        weekday: s.weekday,
        start: toHHMM(s.startMinute),
        end: toHHMM(s.endMinute),
      })),
      withinOfficeHours: slots.length ? isWithin(slots) : null,
    };
  }

  async setOfficeHours(auth: AuthUser, input: OfficeHoursInput) {
    const slots: Slot[] = input.slots.map((s) => ({
      weekday: s.weekday,
      startMinute: toMinutes(s.start),
      endMinute: toMinutes(s.end),
    }));
    await this.prisma.$transaction([
      this.prisma.officeHourSlot.deleteMany({ where: { mentorId: auth.id } }),
      this.prisma.officeHourSlot.createMany({
        data: slots.map((s) => ({ ...s, mentorId: auth.id })),
      }),
    ]);
    return this.officeHours(auth.id);
  }
}
