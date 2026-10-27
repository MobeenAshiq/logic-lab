import { Module } from '@nestjs/common';
import { AdminContentController } from './admin-content.controller';
import { CatalogService } from './catalog.service';
import { CmsService } from './cms.service';
import { CurriculumService } from './curriculum.service';
import { PublicContentController } from './public-content.controller';
import { SiteContentService } from './site-content.service';

@Module({
  controllers: [AdminContentController, PublicContentController],
  providers: [
    CmsService,
    CurriculumService,
    CatalogService,
    SiteContentService,
  ],
})
export class ContentModule {}
