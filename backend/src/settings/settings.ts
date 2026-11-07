import { z } from 'zod';
import { AI_PROVIDERS, DEFAULT_MODELS } from '../lib/ai';

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
  /** AI Mentor behaviour and provider routing, tunable without a redeploy. */
  ai_mentor: z.strictObject({
    enabled: z.boolean(),
    systemPrompt: text(20, 8000),
    refusalMessage: text(10, 1000),
    /** Tried in order; the next one is used on 429, 5xx, timeouts or a missing key. */
    providerOrder: z
      .array(z.enum(AI_PROVIDERS))
      .min(1)
      .max(AI_PROVIDERS.length)
      .refine((v) => new Set(v).size === v.length, 'Each provider once.'),
    models: z.strictObject({
      gemini: text(1, 120),
      groq: text(1, 120),
      openrouter: text(1, 120),
    }),
    /** Our own per-day request cap per provider (keeps us under the free quota). 0 = no cap. */
    dailyCaps: z.strictObject({
      gemini: z.number().int().min(0).max(1_000_000),
      groq: z.number().int().min(0).max(1_000_000),
      openrouter: z.number().int().min(0).max(1_000_000),
    }),
    /** Extra phrases the local guardrail blocks (case-insensitive). */
    blockedPhrases: z.array(text(2, 200)).max(100),
  }),
  /** Autonomous daily content generator & publisher settings. */
  ai_autonomous_content: z.strictObject({
    enabled: z.boolean(),
    autoPublish: z.boolean(),
    defaultStack: text(1, 50),
    dailyCronHourUtc: z.number().int().min(0).max(23),
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
  ai_daily_limit: { studentMessages: 10 },
  ai_mentor: {
    enabled: true,
    systemPrompt: [
      'You are the LogicLab AI Mentor. You teach programming to students from layman-level to senior engineer standards.',
      'Guidelines:',
      '1. Explain complex topics using real-world analogies first, followed by clear code examples.',
      '2. Structure all web development explanations around clean architecture (Routes, Services, Controllers, Queues, WebSockets).',
      "3. Provide code implementations in Node.js, Python, PHP, Next.js, or C++ based on the student's focus.",
      '4. Strictly decline non-technical or inappropriate questions.',
      '',
      'Allowed topics: programming fundamentals (C++, Node.js, Python, PHP, Next.js), data structures & algorithms, OOP, web architecture (APIs, routes, controllers, queues, WebSockets), AI & computer vision (YOLOv8, RAG, LLMs), software engineering best practices and tech career advice.',
      'Out of scope: politics, entertainment, personal advice, working exploit payloads or malware, illegal scripts, offensive language. Defensive security concepts (e.g. how to prevent SQL injection) are fine.',
    ].join('\n'),
    refusalMessage:
      'I am your LogicLab AI Mentor. I only assist with software development, computer science, and tech career topics. Please ask a technical question related to your module.',
    providerOrder: ['gemini', 'groq', 'openrouter'],
    models: { ...DEFAULT_MODELS },
    dailyCaps: { gemini: 1400, groq: 14000, openrouter: 50 },
    blockedPhrases: [],
  },
  ai_autonomous_content: {
    enabled: true,
    autoPublish: false,
    defaultStack: 'fullstack',
    dailyCronHourUtc: 0,
  },
};
