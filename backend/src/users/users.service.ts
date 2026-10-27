import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma, Role, UserStatus } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { ADMIN_ROLES, AuthUser } from '../auth/auth.types';
import { toPublicUser } from '../auth/auth.service';
import { requireRole } from '../auth/require-role';
import { REVOKE_REASON, SessionsService } from '../auth/sessions.service';
import { AppException } from '../common/app-exception';
import { PrismaService } from '../prisma/prisma.service';
import {
  ChangeRoleInput,
  ChangeStatusInput,
  ListUsersInput,
  UpdateMeInput,
} from './users.schemas';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: SessionsService,
    private readonly audit: AuditService,
  ) {}

  /** Users can only edit their own name and avatar. */
  async updateMe(auth: AuthUser, input: UpdateMeInput) {
    await this.prisma.profile.update({
      where: { id: auth.id },
      data: { fullName: input.fullName, avatarUrl: input.avatarUrl },
    });
    return this.getPublic(auth.id);
  }

  async list(auth: AuthUser, q: ListUsersInput) {
    requireRole(auth, ADMIN_ROLES);
    const where: Prisma.UserWhereInput = {
      ...(q.search && {
        OR: [
          { email: { contains: q.search, mode: 'insensitive' } },
          {
            profile: {
              fullName: { contains: q.search, mode: 'insensitive' },
            },
          },
        ],
      }),
      profile: { role: q.role, status: q.status },
    };
    const [total, users] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        include: { profile: true },
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
    ]);
    return { total, page: q.page, items: users.map(toPublicUser) };
  }

  async changeRole(
    auth: AuthUser,
    targetId: string,
    input: ChangeRoleInput,
    ip: string | null,
  ) {
    requireRole(auth, ADMIN_ROLES);
    const target = await this.loadTarget(auth, targetId);
    // Granting or removing admin powers is reserved for super admins.
    const touchesAdmin =
      ADMIN_ROLES.includes(input.role) || ADMIN_ROLES.includes(target.role);
    if (touchesAdmin && auth.role !== Role.super_admin) {
      throw new AppException(HttpStatus.FORBIDDEN, 'SUPER_ADMIN_ONLY');
    }
    if (target.role === input.role) return this.getPublic(targetId);

    await this.prisma.asAdmin(auth.role, async (tx) => {
      await tx.profile.update({
        where: { id: targetId },
        data: { role: input.role },
      });
      // A user who is no longer a mentor loses their course assignments.
      if (target.role === Role.mentor) {
        await tx.courseMentor.deleteMany({ where: { mentorId: targetId } });
      }
      // A new role means new permissions (and maybe 2FA): force a fresh login.
      await this.sessions.revokeAllForUser(
        targetId,
        REVOKE_REASON.roleChanged,
        tx,
      );
      await this.audit.log(
        {
          actorId: auth.id,
          action: 'user.role_changed',
          targetType: 'user',
          targetId,
          metadata: {
            from: target.role,
            to: input.role,
            reason: input.reason,
          },
          ip,
        },
        tx,
      );
    });
    return this.getPublic(targetId);
  }

  async changeStatus(
    auth: AuthUser,
    targetId: string,
    input: ChangeStatusInput,
    ip: string | null,
  ) {
    requireRole(auth, ADMIN_ROLES);
    const target = await this.loadTarget(auth, targetId);
    if (ADMIN_ROLES.includes(target.role) && auth.role !== Role.super_admin) {
      throw new AppException(HttpStatus.FORBIDDEN, 'SUPER_ADMIN_ONLY');
    }
    if (target.status === input.status) return this.getPublic(targetId);

    const banned = input.status === UserStatus.banned;
    await this.prisma.asAdmin(auth.role, async (tx) => {
      await tx.profile.update({
        where: { id: targetId },
        data: {
          status: input.status,
          bannedReason: banned ? input.reason : null,
        },
      });
      if (banned) {
        await this.sessions.revokeAllForUser(
          targetId,
          REVOKE_REASON.banned,
          tx,
        );
      }
      await this.audit.log(
        {
          actorId: auth.id,
          action: banned ? 'user.banned' : 'user.unbanned',
          targetType: 'user',
          targetId,
          metadata: { reason: input.reason },
          ip,
        },
        tx,
      );
    });
    return this.getPublic(targetId);
  }

  private async loadTarget(auth: AuthUser, targetId: string) {
    if (targetId === auth.id) {
      throw new AppException(HttpStatus.FORBIDDEN, 'CANNOT_CHANGE_SELF');
    }
    const profile = await this.prisma.profile.findUnique({
      where: { id: targetId },
    });
    if (!profile)
      throw new AppException(HttpStatus.NOT_FOUND, 'USER_NOT_FOUND');
    return profile;
  }

  private async getPublic(id: string) {
    return toPublicUser(
      await this.prisma.user.findUniqueOrThrow({
        where: { id },
        include: { profile: true },
      }),
    );
  }
}
