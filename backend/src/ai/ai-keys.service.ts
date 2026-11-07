import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditService } from '../audit/audit.service';
import { decrypt, encrypt } from '../common/crypto';
import type { Env } from '../config/env';
import { AI_PROVIDERS, type AiProvider } from '../lib/ai';
import { PrismaService } from '../prisma/prisma.service';

const ENV_KEY: Record<AiProvider, keyof Env> = {
  gemini: 'GEMINI_API_KEY',
  groq: 'GROQ_API_KEY',
  openrouter: 'OPENROUTER_API_KEY',
};

const CACHE_MS = 30_000;

export interface ProviderKeyStatus {
  provider: AiProvider;
  configured: boolean;
  source: 'admin' | 'env' | null;
  last4: string | null;
  updatedAt: Date | null;
}

/**
 * Provider API keys. Admin-saved keys (encrypted at rest) win over env keys.
 * Plain keys are never returned to the client, only the last 4 characters.
 */
@Injectable()
export class AiKeysService {
  private cache: { at: number; keys: Map<AiProvider, string> } | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
    private readonly audit: AuditService,
  ) {}

  private get secret() {
    return this.config.get('ENCRYPTION_KEY', { infer: true });
  }

  private envKey(provider: AiProvider) {
    const value = this.config.get(ENV_KEY[provider], { infer: true });
    return typeof value === 'string' && value ? value : null;
  }

  async keyFor(provider: AiProvider): Promise<string | null> {
    if (!this.cache || Date.now() - this.cache.at > CACHE_MS) {
      const rows = await this.prisma.aiProviderKey.findMany();
      const keys = new Map<AiProvider, string>();
      for (const row of rows) {
        try {
          keys.set(
            row.provider as AiProvider,
            decrypt(row.encryptedKey, this.secret),
          );
        } catch {
          // Stored with a different ENCRYPTION_KEY: ignore and fall back to env.
        }
      }
      this.cache = { at: Date.now(), keys };
    }
    return this.cache.keys.get(provider) ?? this.envKey(provider);
  }

  async status(): Promise<ProviderKeyStatus[]> {
    const rows = await this.prisma.aiProviderKey.findMany();
    return AI_PROVIDERS.map((provider) => {
      const row = rows.find((r) => r.provider === provider);
      if (row)
        return {
          provider,
          configured: true,
          source: 'admin',
          last4: row.last4,
          updatedAt: row.updatedAt,
        };
      const env = this.envKey(provider);
      return {
        provider,
        configured: !!env,
        source: env ? 'env' : null,
        last4: env ? env.slice(-4) : null,
        updatedAt: null,
      };
    });
  }

  async set(
    provider: AiProvider,
    apiKey: string | null,
    actorId: string,
    ip: string | null,
  ) {
    if (apiKey) {
      const data = {
        encryptedKey: encrypt(apiKey, this.secret),
        last4: apiKey.slice(-4),
        updatedBy: actorId,
      };
      await this.prisma.aiProviderKey.upsert({
        where: { provider },
        create: { provider, ...data },
        update: data,
      });
    } else {
      await this.prisma.aiProviderKey.deleteMany({ where: { provider } });
    }
    await this.audit.log({
      actorId,
      action: apiKey ? 'ai.key_saved' : 'ai.key_removed',
      targetType: 'ai_provider',
      targetId: provider,
      ip,
    });
    this.cache = null;
    return this.status();
  }
}
