import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AppException } from '../common/app-exception';
import {
  callProvider,
  ProviderError,
  type AiMessage,
  type AiProvider,
  type ProviderResult,
} from '../lib/ai';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { AiKeysService } from './ai-keys.service';
import { utcDay } from './ai-quota.service';

export interface CompleteInput {
  system: string;
  messages: AiMessage[];
  maxOutputTokens?: number;
  temperature?: number;
  /** Try only these providers (e.g. the admin "test key" button). */
  only?: AiProvider[];
}

/**
 * Sends a prompt to the first provider that works, in the admin-configured
 * order (default Gemini → Groq → OpenRouter). Moves on when a provider has no
 * key, has hit our daily cap, rate-limits us (429), errors (5xx) or times out.
 * Every attempt is counted per provider per day for the admin usage tracker.
 */
@Injectable()
export class AiRouterService {
  private readonly logger = new Logger(AiRouterService.name);
  /**
   * provider:model:key-suffix -> skip until (ms). Stops every message paying for a
   * call that is bound to fail; a new key or model gets a fresh entry.
   */
  private readonly cooldown = new Map<string, number>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly keys: AiKeysService,
  ) {}

  async complete(input: CompleteInput): Promise<ProviderResult> {
    const config = await this.settings.get('ai_mentor');
    const order = input.only ?? config.providerOrder;
    const day = utcDay();
    const usage = await this.prisma.aiProviderUsage.findMany({
      where: { day },
    });
    const attempts: string[] = [];

    for (const provider of order) {
      const apiKey = await this.keys.keyFor(provider);
      if (!apiKey) {
        attempts.push(`${provider}: no key`);
        continue;
      }
      const cap = config.dailyCaps[provider];
      const used = usage.find((u) => u.provider === provider)?.requests ?? 0;
      if (cap > 0 && used >= cap && !input.only) {
        attempts.push(`${provider}: daily cap ${cap} reached`);
        continue;
      }
      const breaker = `${provider}:${config.models[provider]}:${apiKey.slice(-6)}`;
      if ((this.cooldown.get(breaker) ?? 0) > Date.now() && !input.only) {
        attempts.push(`${provider}: cooling down after a recent failure`);
        continue;
      }
      try {
        const result = await callProvider({
          provider,
          apiKey,
          model: config.models[provider],
          system: input.system,
          messages: input.messages,
          maxOutputTokens: input.maxOutputTokens,
          temperature: input.temperature,
        });
        await this.record(provider, day, {
          tokensIn: result.tokensIn,
          tokensOut: result.tokensOut,
        });
        this.cooldown.delete(breaker);
        return result;
      } catch (error) {
        const failure = error instanceof ProviderError ? error : null;
        await this.record(provider, day, {
          failed: true,
          rateLimited: failure?.rateLimited ?? false,
        });
        attempts.push(`${provider}: ${failure?.message ?? String(error)}`);
        // Always fall back. A rejected key/unknown model (4xx) won't fix itself soon;
        // a 429 usually clears within a minute.
        const status = failure?.status ?? 0;
        const pause = failure?.rateLimited
          ? 30_000
          : status >= 400 && status < 500
            ? 10 * 60_000
            : 0;
        if (pause) this.cooldown.set(breaker, Date.now() + pause);
      }
    }

    this.logger.warn(`All AI providers failed: ${attempts.join('; ')}`);
    throw new AppException(
      HttpStatus.SERVICE_UNAVAILABLE,
      'AI_TEMPORARILY_UNAVAILABLE',
    );
  }

  /** Admin "test" button: one tiny call to one provider, returning the real error. */
  async test(provider: AiProvider) {
    const config = await this.settings.get('ai_mentor');
    const apiKey = await this.keys.keyFor(provider);
    const model = config.models[provider];
    if (!apiKey)
      return {
        ok: false as const,
        provider,
        model,
        error: 'No API key configured.',
      };
    const started = Date.now();
    try {
      const result = await callProvider({
        provider,
        apiKey,
        model,
        system: 'You are a health check. Reply with the single word OK.',
        messages: [{ role: 'user', content: 'ping' }],
        maxOutputTokens: 256,
        timeoutMs: 15_000,
      });
      await this.record(provider, utcDay(), {
        tokensIn: result.tokensIn,
        tokensOut: result.tokensOut,
      });
      return {
        ok: true as const,
        provider,
        model,
        latencyMs: Date.now() - started,
      };
    } catch (error) {
      const failure = error instanceof ProviderError ? error : null;
      await this.record(provider, utcDay(), {
        failed: true,
        rateLimited: failure?.rateLimited ?? false,
      });
      const hint =
        failure?.status === 401 || failure?.status === 403
          ? ' The key was rejected, or it cannot use this model.'
          : failure?.status === 404 || failure?.status === 400
            ? ' Check the model name.'
            : failure?.rateLimited
              ? ' Rate limited: the free quota may be used up.'
              : '';
      return {
        ok: false as const,
        provider,
        model,
        error: `${failure?.message ?? String(error)}${hint}`,
      };
    }
  }

  private async record(
    provider: AiProvider,
    day: Date,
    stats: {
      tokensIn?: number;
      tokensOut?: number;
      failed?: boolean;
      rateLimited?: boolean;
    },
  ) {
    const failures = stats.failed ? 1 : 0;
    const rateLimited = stats.rateLimited ? 1 : 0;
    const tokensIn = stats.tokensIn ?? 0;
    const tokensOut = stats.tokensOut ?? 0;
    try {
      await this.prisma.$executeRaw`
        INSERT INTO ai_provider_usage (id, provider, day, requests, failures, rate_limited, tokens_in, tokens_out, created_at, updated_at)
        VALUES (${randomUUID()}::uuid, ${provider}, ${day}::date, 1, ${failures}, ${rateLimited}, ${tokensIn}, ${tokensOut}, now(), now())
        ON CONFLICT (provider, day) DO UPDATE SET
          requests = ai_provider_usage.requests + 1,
          failures = ai_provider_usage.failures + ${failures},
          rate_limited = ai_provider_usage.rate_limited + ${rateLimited},
          tokens_in = ai_provider_usage.tokens_in + ${tokensIn},
          tokens_out = ai_provider_usage.tokens_out + ${tokensOut},
          updated_at = now()
      `;
    } catch (error) {
      this.logger.warn(`Could not record AI usage: ${String(error)}`);
    }
  }
}
