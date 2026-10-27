import { Controller, Get, Global, Module, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { z } from 'zod';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser, Roles } from '../auth/decorators';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { PointsService } from './points.service';

const leaderboardSchema = z.object({
  season: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional(),
  track: z.string().max(80).optional(),
});

/** Read-only: there is deliberately no endpoint that adds points. */
@Controller()
export class PointsController {
  constructor(private readonly points: PointsService) {}

  @Get('leaderboard')
  leaderboard(
    @CurrentUser() user: AuthUser,
    @Query(new ZodValidationPipe(leaderboardSchema))
    query: z.infer<typeof leaderboardSchema>,
  ) {
    return this.points.leaderboard(user.id, {
      seasonKey: query.season,
      trackSlug: query.track,
    });
  }

  @Get('leaderboard/seasons')
  seasons() {
    return this.points.seasons();
  }

  @Roles(Role.student)
  @Get('points/me')
  mine(@CurrentUser() user: AuthUser) {
    return this.points.mine(user.id);
  }
}

@Global()
@Module({
  controllers: [PointsController],
  providers: [PointsService],
  exports: [PointsService],
})
export class PointsModule {}
