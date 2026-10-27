import { HttpStatus, Injectable } from '@nestjs/common';
import { LessonType, PointReason, Prisma, Role } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { ADMIN_ROLES, AuthUser } from '../auth/auth.types';
import { SubscriptionsService } from '../billing/subscriptions.service';
import { AppException } from '../common/app-exception';
import { PointsService } from '../points/points.service';
import { PrismaService } from '../prisma/prisma.service';
import { PRESIGN_TTL_SECONDS, R2Service } from '../storage/r2.service';
import {
  CompleteRecordingInput,
  PublishAsLessonInput,
  RecordingUploadInput,
  ScheduleLiveSessionInput,
  UpdateLiveSessionInput,
} from './live-classes.schemas';

const TEN_MINUTES_MS = 10 * 60 * 1000;

function isAdmin(auth: AuthUser) {
  return ADMIN_ROLES.includes(auth.role);
}

@Injectable()
export class LiveClassesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptions: SubscriptionsService,
    private readonly points: PointsService,
    private readonly r2: R2Service,
  ) {}

  private async assertCanManageCourse(auth: AuthUser, courseId: string) {
    if (isAdmin(auth)) return;
    const assigned = await this.prisma.courseMentor.findUnique({
      where: {
        courseId_mentorId: {
          courseId,
          mentorId: auth.id,
        },
      },
    });
    if (!assigned) {
      throw new AppException(
        HttpStatus.FORBIDDEN,
        'NOT_COURSE_MENTOR',
      );
    }
  }

  private async getSessionOrThrow(id: string) {
    const session = await this.prisma.liveSession.findUnique({
      where: { id },
      include: {
        course: { select: { id: true, title: true, trackId: true, slug: true } },
        mentor: {
          select: {
            id: true,
            email: true,
            profile: { select: { fullName: true, avatarUrl: true } },
          },
        },
      },
    });
    if (!session) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        'LIVE_SESSION_NOT_FOUND',
      );
    }
    return session;
  }

  async schedule(auth: AuthUser, input: ScheduleLiveSessionInput) {
    await this.assertCanManageCourse(auth, input.courseId);

    const roomName = `logiclab-${randomUUID().replace(/-/g, '')}`;
    return this.prisma.liveSession.create({
      data: {
        courseId: input.courseId,
        mentorId: auth.id,
        title: input.title,
        description: input.description,
        startsAt: new Date(input.startsAt),
        durationMinutes: input.durationMinutes,
        roomName,
      },
      include: {
        course: { select: { id: true, title: true } },
      },
    });
  }

  async update(auth: AuthUser, id: string, input: UpdateLiveSessionInput) {
    const session = await this.getSessionOrThrow(id);
    if (!isAdmin(auth) && session.mentorId !== auth.id) {
      throw new AppException(HttpStatus.FORBIDDEN, 'NOT_SESSION_MENTOR');
    }

    return this.prisma.liveSession.update({
      where: { id },
      data: {
        ...(input.title && { title: input.title }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.startsAt && { startsAt: new Date(input.startsAt) }),
        ...(input.durationMinutes && { durationMinutes: input.durationMinutes }),
      },
      include: {
        course: { select: { id: true, title: true } },
      },
    });
  }

  async delete(auth: AuthUser, id: string) {
    const session = await this.getSessionOrThrow(id);
    if (!isAdmin(auth) && session.mentorId !== auth.id) {
      throw new AppException(HttpStatus.FORBIDDEN, 'NOT_SESSION_MENTOR');
    }

    await this.prisma.liveSession.delete({ where: { id } });
    return { ok: true };
  }

  async listForMentor(auth: AuthUser) {
    const isAdm = isAdmin(auth);
    const sessions = await this.prisma.liveSession.findMany({
      where: isAdm ? {} : { mentorId: auth.id },
      orderBy: { startsAt: 'desc' },
      include: {
        course: { select: { id: true, title: true, slug: true } },
        mentor: {
          select: {
            id: true,
            email: true,
            profile: { select: { fullName: true, avatarUrl: true } },
          },
        },
        _count: { select: { attendance: true } },
      },
    });

    return sessions.map((s) => ({
      id: s.id,
      title: s.title,
      description: s.description,
      startsAt: s.startsAt,
      durationMinutes: s.durationMinutes,
      roomName: s.roomName,
      hasRecording: Boolean(s.recordingKey),
      course: s.course,
      mentor: {
        id: s.mentor.id,
        email: s.mentor.email,
        fullName: s.mentor.profile?.fullName ?? '',
        avatarUrl: s.mentor.profile?.avatarUrl ?? null,
      },
      attendanceCount: s._count.attendance,
    }));
  }

  async getForMentor(auth: AuthUser, id: string) {
    const session = await this.getSessionOrThrow(id);
    if (!isAdmin(auth) && session.mentorId !== auth.id) {
      // Check if mentor assigned to course
      await this.assertCanManageCourse(auth, session.courseId);
    }

    const attendanceRecords = await this.prisma.attendance.findMany({
      where: { sessionId: id },
      orderBy: { joinedAt: 'asc' },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            profile: { select: { fullName: true, avatarUrl: true } },
          },
        },
      },
    });

    let recordingUrl: string | null = null;
    if (session.recordingKey) {
      recordingUrl = await this.r2.getDownloadUrl(session.recordingKey);
    }

    return {
      id: session.id,
      title: session.title,
      description: session.description,
      startsAt: session.startsAt,
      durationMinutes: session.durationMinutes,
      roomName: session.roomName,
      recordingKey: session.recordingKey,
      recordingUrl,
      course: session.course,
      mentor: {
        id: session.mentor.id,
        email: session.mentor.email,
        fullName: session.mentor.profile?.fullName ?? '',
        avatarUrl: session.mentor.profile?.avatarUrl ?? null,
      },
      attendance: attendanceRecords.map((a) => {
        let durationMinutes: number | null = null;
        if (a.leftAt) {
          durationMinutes = Math.max(
            1,
            Math.round((a.leftAt.getTime() - a.joinedAt.getTime()) / 60000),
          );
        }
        return {
          id: a.id,
          userId: a.userId,
          fullName: a.user.profile?.fullName ?? '',
          email: a.user.email,
          avatarUrl: a.user.profile?.avatarUrl ?? null,
          joinedAt: a.joinedAt,
          leftAt: a.leftAt,
          durationMinutes,
        };
      }),
    };
  }

  async listForStudent(auth: AuthUser) {
    const now = new Date();
    // Get all live sessions for courses where the student has access
    const sessions = await this.prisma.liveSession.findMany({
      orderBy: { startsAt: 'asc' },
      include: {
        course: { select: { id: true, title: true, slug: true, trackId: true } },
        mentor: {
          select: {
            id: true,
            profile: { select: { fullName: true, avatarUrl: true } },
          },
        },
        attendance: {
          where: { userId: auth.id },
          select: { id: true, joinedAt: true, leftAt: true },
        },
      },
    });

    // Filter by student access
    const accessibleSessions: typeof sessions = [];
    for (const s of sessions) {
      const access = await this.subscriptions.hasAccess(auth.id, s.courseId);
      if (access) {
        accessibleSessions.push(s);
      }
    }

    const items = await Promise.all(
      accessibleSessions.map(async (s) => {
        const startsAtTime = s.startsAt.getTime();
        const nowTime = now.getTime();
        const endTime = startsAtTime + s.durationMinutes * 60 * 1000;
        const canJoin =
          nowTime >= startsAtTime - TEN_MINUTES_MS && nowTime <= endTime + 30 * 60 * 1000;

        let recordingUrl: string | null = null;
        if (s.recordingKey) {
          recordingUrl = await this.r2.getDownloadUrl(s.recordingKey);
        }

        const myAttendance = s.attendance[0] ?? null;

        return {
          id: s.id,
          title: s.title,
          description: s.description,
          startsAt: s.startsAt,
          durationMinutes: s.durationMinutes,
          course: s.course,
          mentor: {
            id: s.mentor.id,
            fullName: s.mentor.profile?.fullName ?? '',
            avatarUrl: s.mentor.profile?.avatarUrl ?? null,
          },
          canJoin,
          hasRecording: Boolean(s.recordingKey),
          recordingUrl,
          attended: Boolean(myAttendance),
          attendance: myAttendance,
        };
      }),
    );

    return items;
  }

  async getRoom(auth: AuthUser, id: string) {
    const session = await this.getSessionOrThrow(id);
    const isStaff = isAdmin(auth) || auth.role === Role.mentor;

    if (!isStaff) {
      // Must have subscription access to course
      const access = await this.subscriptions.hasAccess(auth.id, session.courseId);
      if (!access) {
        throw new AppException(
          HttpStatus.FORBIDDEN,
          'SUBSCRIPTION_REQUIRED',
        );
      }

      // Check time window (within 10 minutes of start)
      const now = Date.now();
      const startsAt = session.startsAt.getTime();
      const endsAt = startsAt + session.durationMinutes * 60 * 1000;

      if (now < startsAt - TEN_MINUTES_MS) {
        throw new AppException(
          HttpStatus.BAD_REQUEST,
          'TOO_EARLY_FOR_LIVE_SESSION',
        );
      }
    }

    // Load full user name
    const user = await this.prisma.user.findUnique({
      where: { id: auth.id },
      select: { email: true, profile: { select: { fullName: true } } },
    });

    return {
      id: session.id,
      title: session.title,
      roomName: session.roomName,
      domain: 'meet.jit.si',
      displayName: user?.profile?.fullName || user?.email || 'Student',
    };
  }

  async recordJoin(auth: AuthUser, id: string) {
    // Validate access & time
    const room = await this.getRoom(auth, id);
    const session = await this.getSessionOrThrow(id);

    const now = new Date();
    const attendance = await this.prisma.attendance.upsert({
      where: {
        sessionId_userId: {
          sessionId: id,
          userId: auth.id,
        },
      },
      create: {
        sessionId: id,
        userId: auth.id,
        joinedAt: now,
      },
      update: {
        leftAt: null,
      },
    });

    // Award points if student
    if (auth.role === Role.student) {
      await this.points.award(
        auth.id,
        PointReason.live_class_attended,
        session.id,
        { trackId: session.course.trackId },
      );
    }

    return { ok: true, joinedAt: attendance.joinedAt };
  }

  async recordLeave(auth: AuthUser, id: string) {
    const existing = await this.prisma.attendance.findUnique({
      where: {
        sessionId_userId: {
          sessionId: id,
          userId: auth.id,
        },
      },
    });

    if (existing) {
      await this.prisma.attendance.update({
        where: { id: existing.id },
        data: { leftAt: new Date() },
      });
    }

    return { ok: true };
  }

  async getRecordingUploadUrl(
    auth: AuthUser,
    id: string,
    input: RecordingUploadInput,
  ) {
    const session = await this.getSessionOrThrow(id);
    if (!isAdmin(auth) && session.mentorId !== auth.id) {
      await this.assertCanManageCourse(auth, session.courseId);
    }

    const ext = input.contentType === 'video/webm' ? 'webm' : 'mp4';
    const key = `live-sessions/${session.id}/${randomUUID()}.${ext}`;
    const uploadUrl = await this.r2.getUploadUrl(
      key,
      input.contentType,
      input.size,
    );

    return { key, uploadUrl };
  }

  async completeRecording(
    auth: AuthUser,
    id: string,
    input: CompleteRecordingInput,
  ) {
    const session = await this.getSessionOrThrow(id);
    if (!isAdmin(auth) && session.mentorId !== auth.id) {
      await this.assertCanManageCourse(auth, session.courseId);
    }

    return this.prisma.liveSession.update({
      where: { id },
      data: { recordingKey: input.key },
    });
  }

  async publishAsLesson(
    auth: AuthUser,
    id: string,
    input: PublishAsLessonInput,
  ) {
    const session = await this.getSessionOrThrow(id);
    if (!isAdmin(auth) && session.mentorId !== auth.id) {
      await this.assertCanManageCourse(auth, session.courseId);
    }

    if (!session.recordingKey) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        'RECORDING_NOT_UPLOADED',
      );
    }

    const mod = await this.prisma.module.findUnique({
      where: { id: input.moduleId },
    });
    if (!mod || mod.courseId !== session.courseId) {
      throw new AppException(HttpStatus.NOT_FOUND, 'MODULE_NOT_FOUND');
    }

    // Get max position in module
    const lastLesson = await this.prisma.lesson.findFirst({
      where: { moduleId: input.moduleId },
      orderBy: { position: 'desc' },
      select: { position: true },
    });

    const position = (lastLesson?.position ?? -1) + 1;
    const lesson = await this.prisma.lesson.create({
      data: {
        moduleId: input.moduleId,
        title: input.title || `Recording: ${session.title}`,
        type: LessonType.video,
        position,
        isPublished: true,
        videoKey: session.recordingKey,
        notes: input.notes || session.description,
        durationSeconds: session.durationMinutes * 60,
      },
    });

    return lesson;
  }
}
