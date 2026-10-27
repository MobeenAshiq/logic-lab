import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../auth/auth.types';
import { AppException } from '../common/app-exception';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateCouponInput,
  CreatePlanInput,
  UpdateCouponInput,
  UpdatePlanInput,
} from './billing.schemas';
import { applyCoupon, couponUsable, normalizeCouponCode } from './pricing';

/** Plans, coupons and price quotes. Every admin change here is audited (it changes money). */
@Injectable()
export class PlansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Active plans for the pricing and billing pages. */
  async listActive() {
    const [plans, tracks] = await Promise.all([
      this.prisma.plan.findMany({
        where: { isActive: true },
        orderBy: [{ position: 'asc' }, { pricePkr: 'asc' }],
      }),
      this.prisma.track.findMany({
        where: { isPublished: true },
        select: { id: true, slug: true, title: true },
      }),
    ]);
    return plans.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      pricePkr: p.pricePkr,
      durationDays: p.durationDays,
      allTracks: p.allTracks,
      tracks: p.allTracks
        ? tracks
        : tracks.filter((t) => p.trackIds.includes(t.id)),
    }));
  }

  listAll() {
    return this.prisma.plan.findMany({
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async createPlan(auth: AuthUser, input: CreatePlanInput, ip: string | null) {
    await this.assertTracksExist(input.trackIds ?? []);
    return this.prisma.$transaction(async (tx) => {
      const plan = await tx.plan.create({ data: input });
      await this.audit.log(
        {
          actorId: auth.id,
          action: 'plan.created',
          targetType: 'plan',
          targetId: plan.id,
          metadata: {
            pricePkr: plan.pricePkr,
            durationDays: plan.durationDays,
          },
          ip,
        },
        tx,
      );
      return plan;
    });
  }

  async updatePlan(
    auth: AuthUser,
    id: string,
    input: UpdatePlanInput,
    ip: string | null,
  ) {
    const before = await this.prisma.plan.findUnique({ where: { id } });
    if (!before) throw new AppException(HttpStatus.NOT_FOUND, 'PLAN_NOT_FOUND');
    const allTracks = input.allTracks ?? before.allTracks;
    const trackIds = input.trackIds ?? before.trackIds;
    if (!allTracks && trackIds.length === 0) {
      throw new AppException(HttpStatus.BAD_REQUEST, 'VALIDATION_FAILED', {
        errors: [
          {
            field: 'trackIds',
            message: 'Choose at least one track, or all tracks.',
          },
        ],
      });
    }
    await this.assertTracksExist(input.trackIds ?? []);
    // Existing subscriptions keep their snapshot; this only affects new payments.
    return this.prisma.$transaction(async (tx) => {
      const plan = await tx.plan.update({ where: { id }, data: input });
      await this.audit.log(
        {
          actorId: auth.id,
          action: 'plan.updated',
          targetType: 'plan',
          targetId: id,
          metadata: { changes: input as Prisma.InputJsonObject },
          ip,
        },
        tx,
      );
      return plan;
    });
  }

  listCoupons() {
    return this.prisma.coupon.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async createCoupon(
    auth: AuthUser,
    input: CreateCouponInput,
    ip: string | null,
  ) {
    const code = normalizeCouponCode(input.code);
    if (await this.prisma.coupon.findUnique({ where: { code } })) {
      throw new AppException(HttpStatus.CONFLICT, 'COUPON_CODE_TAKEN');
    }
    return this.prisma.$transaction(async (tx) => {
      const coupon = await tx.coupon.create({ data: { ...input, code } });
      await this.audit.log(
        {
          actorId: auth.id,
          action: 'coupon.created',
          targetType: 'coupon',
          targetId: coupon.id,
          metadata: {
            code,
            discountType: coupon.discountType,
            discountValue: coupon.discountValue,
          },
          ip,
        },
        tx,
      );
      return coupon;
    });
  }

  async updateCoupon(
    auth: AuthUser,
    id: string,
    input: UpdateCouponInput,
    ip: string | null,
  ) {
    const before = await this.prisma.coupon.findUnique({ where: { id } });
    if (!before) throw new AppException(HttpStatus.NOT_FOUND, 'INVALID_COUPON');
    const type = input.discountType ?? before.discountType;
    const value = input.discountValue ?? before.discountValue;
    if (type === 'percent' && value > 100) {
      throw new AppException(HttpStatus.BAD_REQUEST, 'VALIDATION_FAILED', {
        errors: [
          {
            field: 'discountValue',
            message: 'A percent discount cannot exceed 100.',
          },
        ],
      });
    }
    return this.prisma.$transaction(async (tx) => {
      const coupon = await tx.coupon.update({ where: { id }, data: input });
      await this.audit.log(
        {
          actorId: auth.id,
          action: 'coupon.updated',
          targetType: 'coupon',
          targetId: id,
          metadata: { changes: input as Prisma.InputJsonObject },
          ip,
        },
        tx,
      );
      return coupon;
    });
  }

  /** Price for a plan with an optional coupon. Throws if either is not usable. */
  async quote(planId: string, couponCode?: string) {
    const plan = await this.prisma.plan.findFirst({
      where: { id: planId, isActive: true },
    });
    if (!plan) throw new AppException(HttpStatus.NOT_FOUND, 'PLAN_NOT_FOUND');

    let coupon = null;
    if (couponCode) {
      coupon = await this.prisma.coupon.findUnique({
        where: { code: normalizeCouponCode(couponCode) },
      });
      if (!coupon || !couponUsable(coupon, plan.id)) {
        throw new AppException(HttpStatus.BAD_REQUEST, 'INVALID_COUPON');
      }
    }
    const { discount, total } = applyCoupon(plan.pricePkr, coupon);
    return {
      plan,
      coupon,
      pricePkr: plan.pricePkr,
      discount,
      total,
    };
  }

  private async assertTracksExist(ids: string[]) {
    if (ids.length === 0) return;
    const found = await this.prisma.track.count({ where: { id: { in: ids } } });
    if (found !== new Set(ids).size) {
      throw new AppException(HttpStatus.NOT_FOUND, 'TRACK_NOT_FOUND');
    }
  }
}
