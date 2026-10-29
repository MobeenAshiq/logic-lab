import { z } from 'zod';

const text = (min: number, max: number) => z.string().trim().min(min).max(max);
const wallet = z.strictObject({
  accountTitle: text(1, 100),
  number: z
    .string()
    .trim()
    .regex(/^03\d{2}-?\d{7}$/, 'Use 03XX-XXXXXXX.'),
});

/** Every admin setting, with its shape. */
export const SETTING_SCHEMAS = {
  /** Shown on the student billing page. null hides a method. */
  payment_instructions: z.strictObject({
    easypaisa: wallet.nullable(),
    jazzcash: wallet.nullable(),
    bank: z
      .strictObject({
        bankName: text(1, 100),
        accountTitle: text(1, 100),
        iban: z
          .string()
          .trim()
          .transform((v) => v.replace(/\s+/g, '').toUpperCase())
          .pipe(z.string().regex(/^PK\d{2}[A-Z]{4}\d{16}$/, 'Use a PK IBAN.')),
      })
      .nullable(),
    note: text(0, 1000),
  }),
  /** Points per event (Phase 7). Negative values take points away. */
  point_rules: z.strictObject({
    quiz_passed: z.number().int().min(-1000).max(1000),
    assignment_on_time: z.number().int().min(-1000).max(1000),
    challenge_solved: z.number().int().min(-1000).max(1000).default(10),
    accepted_answer: z.number().int().min(-1000).max(1000),
    streak_7_days: z.number().int().min(-1000).max(1000),
    live_class_attended: z.number().int().min(-1000).max(1000),
    plagiarism_confirmed: z.number().int().min(-1000).max(1000),
  }),
  ai_daily_limit: z.strictObject({
    studentMessages: z.number().int().min(0).max(500),
  }),
};

export type SettingKey = keyof typeof SETTING_SCHEMAS;
export type Settings = {
  [K in SettingKey]: z.infer<(typeof SETTING_SCHEMAS)[K]>;
};
export const SETTING_KEYS = Object.keys(SETTING_SCHEMAS) as SettingKey[];

export function isSettingKey(key: string): key is SettingKey {
  return key in SETTING_SCHEMAS;
}

/** Placeholders until an admin sets real accounts. */
export const SETTING_DEFAULTS: Settings = {
  payment_instructions: {
    easypaisa: null,
    jazzcash: null,
    bank: null,
    note: 'Payment details will be added soon.',
  },
  point_rules: {
    quiz_passed: 20,
    assignment_on_time: 15,
    challenge_solved: 10,
    accepted_answer: 10,
    streak_7_days: 25,
    live_class_attended: 5,
    plagiarism_confirmed: -50,
  },
  ai_daily_limit: { studentMessages: 30 },
};
