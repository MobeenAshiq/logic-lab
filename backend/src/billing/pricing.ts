import { Coupon, DiscountType } from '@prisma/client';

/** Every course is free for this many days from the first time a student opens it. */
export const FREE_COURSE_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

export function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * DAY_MS);
}

/** Price after coupon, in whole rupees, never below 0. */
export function applyCoupon(
  pricePkr: number,
  coupon: Pick<Coupon, 'discountType' | 'discountValue'> | null,
) {
  if (!coupon) return { discount: 0, total: pricePkr };
  const discount =
    coupon.discountType === DiscountType.percent
      ? Math.round((pricePkr * Math.min(coupon.discountValue, 100)) / 100)
      : Math.min(coupon.discountValue, pricePkr);
  return { discount, total: pricePkr - discount };
}

/** Coupon usable now for this plan? (Redemptions are counted when a payment is approved.) */
export function couponUsable(coupon: Coupon, planId: string, now = new Date()) {
  return (
    coupon.isActive &&
    (!coupon.expiresAt || coupon.expiresAt > now) &&
    (coupon.maxRedemptions === null ||
      coupon.redeemedCount < coupon.maxRedemptions) &&
    (coupon.planIds.length === 0 || coupon.planIds.includes(planId))
  );
}

export function normalizeCouponCode(code: string) {
  return code.trim().toUpperCase();
}

/** One payment per transaction ID: compare without spaces/case differences. */
export function normalizeTransactionId(id: string) {
  return id.replace(/\s+/g, '').toUpperCase();
}

/**
 * Warnings for the admin when the OCR text of the slip does not contain the
 * claimed amount or transaction ID. Informational only: OCR is often noisy.
 */
export function ocrWarnings(p: {
  ocrText: string | null;
  slipKey?: string | null;
  amount: number;
  expectedAmount: number;
  transactionId: string;
}) {
  const warnings: string[] = [];
  if (p.amount !== p.expectedAmount) {
    warnings.push(
      `Amount entered (Rs ${p.amount}) differs from the plan price (Rs ${p.expectedAmount}).`,
    );
  }
  if (!p.slipKey) {
    warnings.push(
      'No slip attached: check the transaction ID in your EasyPaisa, JazzCash or bank account.',
    );
    return warnings;
  }
  if (!p.ocrText) {
    warnings.push('No text could be read from the slip.');
    return warnings;
  }
  const flat = p.ocrText.toUpperCase().replace(/[\s,]/g, '');
  const amounts = [p.amount, p.expectedAmount].flatMap((a) => [
    String(a),
    `${a}.00`,
  ]);
  if (!amounts.some((a) => flat.includes(a))) {
    warnings.push('The amount was not found on the slip.');
  }
  if (!flat.includes(p.transactionId)) {
    warnings.push('The transaction ID was not found on the slip.');
  }
  return warnings;
}
