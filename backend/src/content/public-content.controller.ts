import { Controller, Get, Param, Query } from '@nestjs/common';
import { CourseLevel } from '@prisma/client';
import { z } from 'zod';
import { Public } from '../auth/decorators';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { CatalogService } from './catalog.service';
import { SiteContentService } from './site-content.service';

const catalogQuerySchema = z.object({
  track: z.string().max(80).optional(),
  level: z.enum(CourseLevel).optional(),
});

/** Public endpoints used by the landing page and /courses. */
@Public()
@Controller()
export class PublicContentController {
  constructor(
    private readonly catalog: CatalogService,
    private readonly siteContent: SiteContentService,
  ) {}

  @Get('site-content')
  site() {
    return this.siteContent.getPublic();
  }

  @Get('tracks')
  tracks() {
    return this.catalog.tracks();
  }

  @Get('courses')
  courses(
    @Query(new ZodValidationPipe(catalogQuerySchema))
    query: z.infer<typeof catalogQuerySchema>,
  ) {
    return this.catalog.courses(query);
  }

  @Get('courses/:slug')
  course(@Param('slug') slug: string) {
    return this.catalog.course(slug);
  }
}
