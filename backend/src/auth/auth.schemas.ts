import { z } from 'zod';

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .pipe(z.email('Enter a valid email address.'));

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters.')
  .max(72, 'Password must be at most 72 characters.')
  .regex(/[A-Za-z]/, 'Password must contain a letter.')
  .regex(/[0-9]/, 'Password must contain a number.');

const otpSchema = z.string().regex(/^\d{6}$/, 'Enter the 6-digit code.');

export const signupSchema = z.strictObject({
  email: emailSchema,
  password: passwordSchema,
  fullName: z.string().trim().min(2).max(100),
});

export const loginSchema = z.strictObject({
  email: emailSchema,
  password: z.string().min(1).max(72),
});

export const verifyEmailSchema = z.strictObject({
  email: emailSchema,
  code: otpSchema,
});

export const emailOnlySchema = z.strictObject({ email: emailSchema });

export const resetPasswordSchema = z.strictObject({
  token: z.string().min(10).max(200),
  password: passwordSchema,
});

export const mfaCodeSchema = z.strictObject({ code: otpSchema });

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
