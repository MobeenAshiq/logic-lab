import {
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthedRequest, AuthUser } from './auth.types';

export const IS_PUBLIC_KEY = 'isPublic';
export const ROLES_KEY = 'roles';
export const ALLOW_PENDING_MFA_KEY = 'allowPendingMfa';

/** Skips authentication. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** Only these roles may call the route (checked against the DB role). */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

/** Lets mentors/admins reach the route before finishing 2FA (setup, verify, logout, /me). */
export const AllowPendingMfa = () => SetMetadata(ALLOW_PENDING_MFA_KEY, true);

export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AuthUser => {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    if (!req.auth) throw new Error('CurrentUser used on a public route');
    return req.auth;
  },
);
