import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { AppException } from '../common/app-exception';
import { PrismaService } from '../prisma/prisma.service';
import {
  isSettingKey,
  SETTING_DEFAULTS,
  SETTING_SCHEMAS,
  SettingKey,
  Settings,
} from './settings';

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** The stored value, or the default if it was never saved or no longer validates. */
  async get<K extends SettingKey>(key: K): Promise<Settings[K]> {
    const row = await this.prisma.setting.findUnique({ where: { key } });
    const parsed = SETTING_SCHEMAS[key].safeParse(row?.data);
    return parsed.success
      ? (parsed.data as Settings[K])
      : SETTING_DEFAULTS[key];
  }

  /** Settings can control money (e.g. where students pay), so every change is audited. */
  async update(key: string, data: unknown, actorId: string, ip: string | null) {
    if (!isSettingKey(key)) {
      throw new AppException(HttpStatus.NOT_FOUND, 'UNKNOWN_SETTING');
    }
    const parsed = SETTING_SCHEMAS[key].safeParse(data);
    if (!parsed.success) {
      throw new AppException(HttpStatus.BAD_REQUEST, 'VALIDATION_FAILED', {
        errors: parsed.error.issues.map((i) => ({
          field: i.path.join('.'),
          message: i.message,
        })),
      });
    }
    const value = parsed.data as Prisma.InputJsonObject;
    await this.prisma.$transaction(async (tx) => {
      await tx.setting.upsert({
        where: { key },
        create: { key, data: value, updatedBy: actorId },
        update: { data: value, updatedBy: actorId },
      });
      await this.audit.log(
        {
          actorId,
          action: 'setting.updated',
          targetType: 'setting',
          targetId: key,
          metadata: { data: value },
          ip,
        },
        tx,
      );
    });
    return parsed.data;
  }
}
