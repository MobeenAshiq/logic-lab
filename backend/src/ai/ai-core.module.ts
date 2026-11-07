import { Global, Module } from '@nestjs/common';
import { AiKeysService } from './ai-keys.service';
import { AiQuotaService } from './ai-quota.service';
import { AiRouterService } from './ai-router.service';

/** Provider routing, keys and per-user quotas, shared by every AI feature. */
@Global()
@Module({
  providers: [AiKeysService, AiQuotaService, AiRouterService],
  exports: [AiKeysService, AiQuotaService, AiRouterService],
})
export class AiCoreModule {}
