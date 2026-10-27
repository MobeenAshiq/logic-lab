import { HttpStatus } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AppException } from '../common/app-exception';
import { AuthUser } from './auth.types';

/**
 * Server-side role check for services. The role comes from the database via the
 * auth guard, never from the request body or token claims.
 */
export function requireRole(
  user: AuthUser | undefined,
  roles: readonly Role[],
): AuthUser {
  if (!user) throw new AppException(HttpStatus.UNAUTHORIZED, 'UNAUTHENTICATED');
  if (!roles.includes(user.role)) {
    throw new AppException(HttpStatus.FORBIDDEN, 'FORBIDDEN_ROLE');
  }
  return user;
}
