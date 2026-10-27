import { Role } from '@prisma/client';
import { Request } from 'express';

export const PRIVILEGED_ROLES: readonly Role[] = [
  Role.mentor,
  Role.admin,
  Role.super_admin,
];
export const ADMIN_ROLES: readonly Role[] = [Role.admin, Role.super_admin];

/** 'none' = no 2FA needed / already passed; 'setup' = must enrol; 'verify' = must enter code. */
export type MfaState = 'none' | 'setup' | 'verify';

/** The logged-in user, always loaded from the database (never from client input). */
export interface AuthUser {
  id: string;
  email: string;
  role: Role;
  sessionId: string;
  mfa: MfaState;
}

export interface AuthedRequest extends Request {
  auth?: AuthUser;
}

export interface AccessTokenPayload {
  sub: string;
  sid: string;
}

export interface GoogleIdentity {
  googleId: string;
  email: string;
  emailVerified: boolean;
  fullName: string;
  avatarUrl: string | null;
}
