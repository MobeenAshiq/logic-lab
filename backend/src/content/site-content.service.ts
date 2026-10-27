import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AppException } from '../common/app-exception';
import { PrismaService } from '../prisma/prisma.service';
import {
  isSiteContentKey,
  SITE_CONTENT_DEFAULTS,
  SITE_CONTENT_KEYS,
  SITE_CONTENT_SCHEMAS,
  SiteContent,
} from './site-content';

@Injectable()
export class SiteContentService {
  constructor(private readonly prisma: PrismaService) {}

  /** All blocks; a block that was never saved (or no longer validates) falls back to its default. */
  async getAll(): Promise<SiteContent> {
    const rows = await this.prisma.siteContent.findMany();
    const stored = new Map(rows.map((r) => [r.key, r.data]));
    const result = { ...SITE_CONTENT_DEFAULTS };
    for (const key of SITE_CONTENT_KEYS) {
      const parsed = SITE_CONTENT_SCHEMAS[key].safeParse(stored.get(key));
      if (parsed.success) Object.assign(result, { [key]: parsed.data });
    }
    return result;
  }

  /** What the landing page shows: only active banners inside their date window. */
  async getPublic(): Promise<SiteContent> {
    const all = await this.getAll();
    const now = Date.now();
    return {
      ...all,
      banners: {
        items: all.banners.items.filter(
          (b) =>
            b.active &&
            (!b.startsAt || Date.parse(b.startsAt) <= now) &&
            (!b.endsAt || Date.parse(b.endsAt) > now),
        ),
      },
    };
  }

  async update(key: string, data: unknown, actorId: string) {
    if (!isSiteContentKey(key)) {
      throw new AppException(HttpStatus.NOT_FOUND, 'UNKNOWN_SITE_CONTENT');
    }
    const parsed = SITE_CONTENT_SCHEMAS[key].safeParse(data);
    if (!parsed.success) {
      throw new AppException(HttpStatus.BAD_REQUEST, 'VALIDATION_FAILED', {
        errors: parsed.error.issues.map((i) => ({
          field: i.path.join('.'),
          message: i.message,
        })),
      });
    }
    const value = parsed.data as Prisma.InputJsonObject;
    await this.prisma.siteContent.upsert({
      where: { key },
      create: { key, data: value, updatedBy: actorId },
      update: { data: value, updatedBy: actorId },
    });
    return { key, data: parsed.data };
  }
}
