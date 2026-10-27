import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma, PrismaClient, Role } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  /**
   * Runs `fn` in a transaction where the database knows the caller is an admin.
   * Required by the `profiles_protect_privileged_columns` trigger to change role/status.
   * Only call this from code that already passed requireRole(['admin', 'super_admin']).
   */
  asAdmin<T>(
    actorRole: Role,
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT set_config('app.actor_role', ${actorRole}, true)`;
      return fn(tx);
    });
  }
}
