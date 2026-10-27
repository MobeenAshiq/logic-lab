import { z } from 'zod';

const optional = z
  .string()
  .optional()
  .transform((v) => (v ? v : undefined));

export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().default(4000),
  TRUST_PROXY: z.coerce.number().int().min(0).max(5).default(0),
  FRONTEND_URL: z.url(),
  API_URL: z.url(),
  DATABASE_URL: z.string().min(1),

  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  REFRESH_TTL_DAYS: z.coerce.number().int().positive().default(30),
  COOKIE_SECURE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  ENCRYPTION_KEY: z.string().min(32),

  GOOGLE_CLIENT_ID: optional,
  GOOGLE_CLIENT_SECRET: optional,

  RESEND_API_KEY: optional,
  EMAIL_FROM: z.string().default('LogicLab <onboarding@resend.dev>'),

  UPSTASH_REDIS_REST_URL: optional,
  UPSTASH_REDIS_REST_TOKEN: optional,

  R2_ACCOUNT_ID: optional,
  R2_ACCESS_KEY_ID: optional,
  R2_SECRET_ACCESS_KEY: optional,
  R2_BUCKET: optional,
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(raw: Record<string, unknown>): Env {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    const details = result.error.issues
      .map((i) => `  ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment variables:\n${details}`);
  }
  return result.data;
}
