import { Global, Module } from '@nestjs/common';
import { AgentRunnerService } from './agent-runner.service';
import { AiKeysService } from './ai-keys.service';
import { AiQuotaService } from './ai-quota.service';
import { AiRouterService } from './ai-router.service';

/** Provider routing, keys and per-user quotas, shared by every AI feature. */
@Global()
@Module({
  providers: [AiKeysService, AiQuotaService, AiRouterService, AgentRunnerService],
  exports: [AiKeysService, AiQuotaService, AiRouterService, AgentRunnerService],
})
export class AiCoreModule {}
