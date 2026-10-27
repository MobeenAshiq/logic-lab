import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditEntry {
  actorId: string | null;
  action: string;
  targetType: string;
  targetId?: string | null;
  metadata?: Prisma.InputJsonObject;
  ip?: string | null;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  /** Pass `tx` to write the log in the same transaction as the change it records. */
  log(entry: AuditEntry, tx: Prisma.TransactionClient = this.prisma) {
    return tx.auditLog.create({
      data: {
        actorId: entry.actorId,
        action: entry.action,
        targetType: entry.targetType,
        targetId: entry.targetId ?? null,
        metadata: entry.metadata ?? {},
        ip: entry.ip ?? null,
      },
    });
  }

  list(params: { targetId?: string; take: number; skip: number }) {
    return this.prisma.auditLog.findMany({
      where: params.targetId ? { targetId: params.targetId } : undefined,
      orderBy: { createdAt: 'desc' },
      take: params.take,
      skip: params.skip,
    });
  }
}
