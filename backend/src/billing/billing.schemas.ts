import { DiscountType, PaymentMethod, PaymentStatus } from '@prisma/client';
import { z } from 'zod';

const planFields = {
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(1000).optional(),
  pricePkr: z.number().int().min(0).max(1_000_000),
  durationDays: z.number().int().min(1).max(730),
  allTracks: z.boolean().optional(),
  trackIds: z.array(z.uuid()).max(50).optional(),
  isActive: z.boolean().optional(),
};

export const createPlanSchema = z
  .strictObject(planFields)
  .refine((p) => p.allTracks || (p.trackIds?.length ?? 0) > 0, {
    path: ['trackIds'],
    message: 'Choose at least one track, or all tracks.',
  });
export const updatePlanSchema = z.strictObject(planFields).partial();

const couponFields = {
  discountType: z.enum(DiscountType),
  discountValue: z.number().int().min(1).max(1_000_000),
  maxRedemptions: z.number().int().min(1).nullable().optional(),
  expiresAt: z.iso.datetime().nullable().optional(),
  isActive: z.boolean().optional(),
  planIds: z.array(z.uuid()).max(50).optional(),
};

const percentMax = (c: {
  discountType?: DiscountType;
  discountValue?: number;
}) => c.discountType !== DiscountType.percent || (c.discountValue ?? 0) <= 100;

export const createCouponSchema = z
  .strictObject({
    code: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9_-]{3,30}$/, 'Use 3-30 letters, numbers, - or _.'),
    ...couponFields,
  })
  .refine(percentMax, {
    path: ['discountValue'],
    message: 'A percent discount cannot exceed 100.',
  });
export const updateCouponSchema = z
  .strictObject(couponFields)
  .partial()
  .refine(percentMax, {
    path: ['discountValue'],
    message: 'A percent discount cannot exceed 100.',
  });

export const startTrialSchema = z.strictObject({ trackId: z.uuid() });

export const quoteSchema = z.strictObject({
  planId: z.uuid(),
  couponCode: z.string().trim().max(30).optional(),
});

export const submitPaymentSchema = z.strictObject({
  planId: z.uuid(),
  couponCode: z.string().trim().max(30).optional(),
  method: z.enum(PaymentMethod),
  transactionId: z
    .string()
    .trim()
    .min(4)
    .max(40)
    .regex(/^[A-Za-z0-9 -]+$/, 'Use only letters, numbers and dashes.'),
  amount: z.number().int().min(1).max(1_000_000),
  /** Date on the slip, YYYY-MM-DD. */
  paidAt: z.iso.date(),
  slipKey: z.string().max(200),
  ocrText: z.string().max(20_000).nullable().optional(),
});

export const rejectPaymentSchema = z.strictObject({
  reason: z.string().trim().min(3).max(500),
});

export const listPaymentsSchema = z.object({
  status: z.enum(PaymentStatus).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreatePlanInput = z.infer<typeof createPlanSchema>;
export type UpdatePlanInput = z.infer<typeof updatePlanSchema>;
export type CreateCouponInput = z.infer<typeof createCouponSchema>;
export type UpdateCouponInput = z.infer<typeof updateCouponSchema>;
export type StartTrialInput = z.infer<typeof startTrialSchema>;
export type QuoteInput = z.infer<typeof quoteSchema>;
export type SubmitPaymentInput = z.infer<typeof submitPaymentSchema>;
export type RejectPaymentInput = z.infer<typeof rejectPaymentSchema>;
export type ListPaymentsInput = z.infer<typeof listPaymentsSchema>;
