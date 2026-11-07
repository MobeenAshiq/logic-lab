export type AiMessage = { role: 'user' | 'assistant'; content: string };

export const AI_PROVIDERS = ['gemini', 'groq', 'openrouter'] as const;
export type AiProvider = (typeof AI_PROVIDERS)[number];

/** Defaults as of Nov 2026; admins can change them in Admin > AI Mentor > Providers. */
export const DEFAULT_MODELS: Record<AiProvider, string> = {
  // Google alias that always points at the current Flash-Lite (highest free daily quota).
  gemini: 'gemini-flash-lite-latest',
  groq: 'openai/gpt-oss-120b',
  openrouter: 'google/gemma-4-31b-it:free',
};

export interface ProviderCall {
  provider: AiProvider;
  apiKey: string;
  model: string;
  system: string;
  messages: AiMessage[];
  maxOutputTokens?: number;
  temperature?: number;
  timeoutMs?: number;
}

export interface ProviderResult {
  text: string;
  provider: AiProvider;
  model: string;
  tokensIn: number;
  tokensOut: number;
}

/** A failed provider call. `retryable` = another provider may succeed (429, 5xx, timeout). */
export class ProviderError extends Error {
  constructor(
    readonly provider: AiProvider,
    readonly status: number | null,
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
  }

  get rateLimited() {
    return this.status === 429;
  }
}

/** Rough token estimate (≈4 chars/token) when a provider omits usage. */
export function estimateTokens(text: string) {
  return Math.ceil(text.length / 4);
}

async function post(
  provider: AiProvider,
  url: string,
  headers: Record<string, string>,
  body: unknown,
  timeoutMs: number,
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!response.ok) {
      const retryable =
        response.status === 429 ||
        response.status >= 500 ||
        response.status === 408;
      throw new ProviderError(
        provider,
        response.status,
        `${provider} request failed (${response.status})${await errorDetail(response)}.`,
        retryable,
      );
    }
    return (await response.json()) as unknown;
  } catch (error) {
    if (error instanceof ProviderError) throw error;
    const aborted = error instanceof Error && error.name === 'AbortError';
    throw new ProviderError(
      provider,
      null,
      aborted ? `${provider} timed out.` : `${provider} network error.`,
      true,
    );
  } finally {
    clearTimeout(timeout);
  }
}

/** The provider's own error message (never contains our key), for logs and the admin test button. */
async function errorDetail(response: Response) {
  try {
    const body = (await response.json()) as {
      error?: { message?: unknown } | string;
    };
    const message =
      typeof body.error === 'string' ? body.error : body.error?.message;
    return typeof message === 'string' && message
      ? `: ${message.replace(/\s+/g, ' ').slice(0, 300).replace(/\.$/, '')}`
      : '';
  } catch {
    return '';
  }
}

type OpenAiLike = {
  choices?: { message?: { content?: string } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
};

/** One request to one provider. Server-only: keys never leave the backend. */
export async function callProvider(
  call: ProviderCall,
): Promise<ProviderResult> {
  const { provider, apiKey, model, system, messages } = call;
  const temperature = call.temperature ?? 0.3;
  const maxTokens = call.maxOutputTokens ?? 1200;
  const timeoutMs = call.timeoutMs ?? 25_000;
  const promptChars =
    system.length + messages.reduce((n, m) => n + m.content.length, 0);

  if (provider === 'gemini') {
    const data = (await post(
      provider,
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      { 'x-goog-api-key': apiKey },
      {
        systemInstruction: { parts: [{ text: system }] },
        contents: messages.map((m) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        })),
        generationConfig: { temperature, maxOutputTokens: maxTokens },
      },
      timeoutMs,
    )) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
      usageMetadata?: {
        promptTokenCount?: number;
        candidatesTokenCount?: number;
      };
    };
    const text = data.candidates?.[0]?.content?.parts
      ?.map((p) => p.text ?? '')
      .join('')
      .trim();
    if (!text)
      throw new ProviderError(
        provider,
        null,
        'gemini returned an empty response.',
        true,
      );
    return {
      text,
      provider,
      model,
      tokensIn:
        data.usageMetadata?.promptTokenCount ?? Math.ceil(promptChars / 4),
      tokensOut:
        data.usageMetadata?.candidatesTokenCount ?? estimateTokens(text),
    };
  }

  const url =
    provider === 'groq'
      ? 'https://api.groq.com/openai/v1/chat/completions'
      : 'https://openrouter.ai/api/v1/chat/completions';
  const extra: Record<string, string> =
    provider === 'openrouter' ? { 'X-Title': 'LogicLab AI Mentor' } : {};
  const data = (await post(
    provider,
    url,
    { Authorization: `Bearer ${apiKey}`, ...extra },
    {
      model,
      messages: [
        { role: 'system', content: system },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ],
      temperature,
      max_tokens: maxTokens,
    },
    timeoutMs,
  )) as OpenAiLike;
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text)
    throw new ProviderError(
      provider,
      null,
      `${provider} returned an empty response.`,
      true,
    );
  return {
    text,
    provider,
    model,
    tokensIn: data.usage?.prompt_tokens ?? Math.ceil(promptChars / 4),
    tokensOut: data.usage?.completion_tokens ?? estimateTokens(text),
  };
}
