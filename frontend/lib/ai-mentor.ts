export const STACKS = [
  { value: "general", label: "Any language" },
  { value: "nodejs", label: "Node.js" },
  { value: "python", label: "Python" },
  { value: "php", label: "PHP" },
  { value: "nextjs", label: "Next.js" },
  { value: "cpp", label: "C++" },
] as const;
export type StackType = (typeof STACKS)[number]["value"];

export type AiProvider = "gemini" | "groq" | "openrouter";
export const PROVIDER_LABEL: Record<AiProvider, string> = {
  gemini: "Google Gemini",
  groq: "Groq",
  openrouter: "OpenRouter",
};

export type FlagStatus = "none" | "blocked" | "refused";
export type FlagCategory = "prompt_injection" | "harmful" | "off_topic" | "blocked_phrase";
export const CATEGORY_LABEL: Record<FlagCategory, string> = {
  prompt_injection: "Prompt injection",
  harmful: "Harmful request",
  off_topic: "Off-topic",
  blocked_phrase: "Blocked phrase",
};

export interface MentorSession {
  id: string;
  title: string;
  stackType: StackType;
  courseId: string | null;
  moduleId: string | null;
  lastMessageAt: string;
  createdAt: string;
  course: { id: string; slug: string; title: string } | null;
  module: { id: string; title: string } | null;
}

export interface MentorMessage {
  id: string;
  senderType: "user" | "assistant";
  content: string;
  flagStatus: FlagStatus;
  createdAt: string;
}

export type MentorUsage =
  | { unlimited: true }
  | { limit: number; used: number; remaining: number; resetsAt?: string };

export interface SendResult {
  message: MentorMessage;
  flagged: boolean;
  usage: MentorUsage;
}

export interface CodeBlock {
  id: string;
  language: string;
  code: string;
}

/** Fenced code blocks in a Markdown answer, in order. */
export function extractCode(messageId: string, markdown: string): CodeBlock[] {
  const blocks: CodeBlock[] = [];
  const re = /```([\w+#.-]*)[^\n]*\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(markdown))) {
    const code = match[2].replace(/\n$/, "");
    if (code.trim()) blocks.push({ id: `${messageId}-${blocks.length}`, language: match[1] || "text", code });
  }
  return blocks;
}

// --- Admin ---

export interface ProviderKeyStatus {
  provider: AiProvider;
  configured: boolean;
  source: "admin" | "env" | null;
  last4: string | null;
  updatedAt: string | null;
}

export interface ProviderOverview {
  provider: AiProvider;
  model: string;
  key: ProviderKeyStatus;
  order: number | null;
  dailyCap: number;
  status: "ok" | "no_key" | "capped" | "rate_limited";
  today: {
    requests: number;
    failures: number;
    rateLimited: number;
    tokensIn: number;
    tokensOut: number;
    remaining: number | null;
  };
  daily: { day: string; requests: number; failures: number; rateLimited: number; tokens: number }[];
}

export interface AiOverview {
  enabled: boolean;
  resetsAt: string;
  providers: ProviderOverview[];
  mentor: { sessionsToday: number; messagesToday: number; activeUsersToday: number };
  safety: { openFlags: number; flagsToday: number };
}

export interface AdminUser {
  id: string;
  email: string;
  profile: { fullName: string } | null;
}

export interface AdminSessionRow {
  id: string;
  title: string;
  stackType: StackType;
  lastMessageAt: string;
  createdAt: string;
  user: AdminUser;
  course: { title: string } | null;
  module: { title: string } | null;
  _count: { messages: number; flags: number };
}

export interface AdminSessionDetail extends Omit<AdminSessionRow, "_count"> {
  messages: (MentorMessage & { tokensUsed: number; provider: string | null; model: string | null })[];
}

export interface SecurityFlag {
  id: string;
  userId: string;
  sessionId: string | null;
  promptText: string;
  category: FlagCategory;
  reason: string;
  source: "local" | "model";
  reviewedAt: string | null;
  timestamp: string;
  user: AdminUser;
}

export interface Paged<T> {
  total: number;
  page: number;
  pageSize: number;
  items: T[];
}

export interface AiMentorConfig {
  enabled: boolean;
  systemPrompt: string;
  refusalMessage: string;
  providerOrder: AiProvider[];
  models: Record<AiProvider, string>;
  dailyCaps: Record<AiProvider, number>;
  blockedPhrases: string[];
}
