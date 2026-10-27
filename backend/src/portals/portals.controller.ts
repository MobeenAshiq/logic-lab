import { Controller, Get } from '@nestjs/common';
import { Role } from '@prisma/client';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser, Roles } from '../auth/decorators';

/**
 * Entry points of the three portals. The frontend calls these before rendering
 * /student, /mentor, /admin: 401 -> go to /login, 403 MFA_* -> 2FA screen,
 * 403 FORBIDDEN_ROLE -> go to the user's own portal.
 * Later phases add real dashboard data here.
 */
@Controller()
export class PortalsController {
  @Roles(Role.student)
  @Get('student/dashboard')
  student(@CurrentUser() user: AuthUser) {
    return { portal: 'student', userId: user.id };
  }

  @Roles(Role.mentor)
  @Get('mentor/dashboard')
  mentor(@CurrentUser() user: AuthUser) {
    return { portal: 'mentor', userId: user.id };
  }

  @Roles(Role.admin, Role.super_admin)
  @Get('admin/dashboard')
  admin(@CurrentUser() user: AuthUser) {
    return { portal: 'admin', userId: user.id };
  }
}
