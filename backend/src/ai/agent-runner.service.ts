import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import type { ZodType } from 'zod';
import { AppException } from '../common/app-exception';
import { PrismaService } from '../prisma/prisma.service';
import { AiRouterService } from './ai-router.service';

/** Agent names, so the agent_runs log and admin views stay consistent. */
export type AgentName =
  'course' | 'lecture' | 'teacher' | 'examiner' | 'coding' | 'mentor';

export interface AgentCall<T> {
  agent: AgentName;
  userId?: string;
  system: string;
  prompt: string;
  /** Shape the reply must have; anything else counts as a failed run. */
  schema: ZodType<T>;
  maxOutputTokens?: number;
  temperature?: number;
}

/**
 * Pulls the JSON object out of a model reply: models often wrap it in ```json
 * fences or add a sentence before it.
 */
export function extractJson(text: string): unknown {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error('no JSON object in reply');
  return JSON.parse(text.slice(start, end + 1));
}

/**
 * Runs one agent step: one AI call, a JSON reply checked against `schema`,
 * and a row in agent_runs either way. Throws AI_INVALID_RESPONSE or
 * AI_TEMPORARILY_UNAVAILABLE so callers never act on unchecked AI output.
 */
@Injectable()
export class AgentRunnerService {
  private readonly logger = new Logger(AgentRunnerService.name);

  constructor(
    private readonly router: AiRouterService,
    private readonly prisma: PrismaService,
  ) {}

  async run<T>(call: AgentCall<T>): Promise<T> {
    const started = Date.now();
    let reply: Awaited<ReturnType<AiRouterService['complete']>> | undefined;
    try {
      reply = await this.router.complete({
        system: call.system,
        messages: [{ role: 'user', content: call.prompt }],
        maxOutputTokens: call.maxOutputTokens ?? 1200,
        temperature: call.temperature ?? 0.3,
      });
    } catch (err) {
      await this.log(call, started, false, `provider: ${String(err)}`);
      throw new AppException(
        HttpStatus.SERVICE_UNAVAILABLE,
        'AI_TEMPORARILY_UNAVAILABLE',
      );
    }

    try {
      const value = call.schema.parse(extractJson(reply.text));
      await this.log(call, started, true, null, reply);
      return value;
    } catch (err) {
      await this.log(
        call,
        started,
        false,
        `invalid reply: ${String(err)}`,
        reply,
      );
      throw new AppException(HttpStatus.BAD_GATEWAY, 'AI_INVALID_RESPONSE');
    }
  }

  private async log(
    call: AgentCall<unknown>,
    started: number,
    ok: boolean,
    error: string | null,
    reply?: Awaited<ReturnType<AiRouterService['complete']>>,
  ) {
    try {
      await this.prisma.agentRun.create({
        data: {
          agent: call.agent,
          userId: call.userId ?? null,
          ok,
          error: error?.slice(0, 1000) ?? null,
          provider: reply?.provider ?? null,
          model: reply?.model ?? null,
          tokensIn: reply?.tokensIn ?? 0,
          tokensOut: reply?.tokensOut ?? 0,
          ms: Date.now() - started,
        },
      });
    } catch (err) {
      // The log is for debugging; never fail the student's request because of it.
      this.logger.warn(`agent_runs insert failed: ${String(err)}`);
    }
  }
}
