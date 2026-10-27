import { Role, UserStatus } from '@prisma/client';
import { z } from 'zod';

/** strictObject: sending `role` or `status` here is rejected outright. */
export const updateMeSchema = z.strictObject({
  fullName: z.string().trim().min(2).max(100).optional(),
  avatarUrl: z.url().max(500).nullable().optional(),
});

/** Every role or status change needs a reason; it is stored in the audit log. */
const reason = z.string().trim().min(3, 'Give a reason.').max(500);

export const changeRoleSchema = z.strictObject({
  role: z.enum(Role),
  reason,
});

export const changeStatusSchema = z.strictObject({
  status: z.enum(UserStatus),
  reason,
});

export const listUsersSchema = z.object({
  search: z.string().trim().max(100).optional(),
  role: z.enum(Role).optional(),
  status: z.enum(UserStatus).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const listAuditSchema = z.object({
  targetId: z.string().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

export type UpdateMeInput = z.infer<typeof updateMeSchema>;
export type ChangeRoleInput = z.infer<typeof changeRoleSchema>;
export type ChangeStatusInput = z.infer<typeof changeStatusSchema>;
export type ListUsersInput = z.infer<typeof listUsersSchema>;
export type ListAuditInput = z.infer<typeof listAuditSchema>;
