-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('trial', 'pending', 'active', 'expired');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('easypaisa', 'jazzcash', 'bank');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('pending', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('percent', 'fixed');

-- CreateTable
CREATE TABLE "plans" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "price_pkr" INTEGER NOT NULL,
    "duration_days" INTEGER NOT NULL,
    "all_tracks" BOOLEAN NOT NULL DEFAULT false,
    "track_ids" UUID[] DEFAULT ARRAY[]::UUID[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "plan_id" UUID,
    "status" "SubscriptionStatus" NOT NULL,
    "all_tracks" BOOLEAN NOT NULL DEFAULT false,
    "track_ids" UUID[] DEFAULT ARRAY[]::UUID[],
    "starts_at" TIMESTAMPTZ,
    "ends_at" TIMESTAMPTZ,
    "reminder_3d_sent_at" TIMESTAMPTZ,
    "reminder_1d_sent_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trial_claims" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "email_key" TEXT NOT NULL,
    "google_id" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "trial_claims_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coupons" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "discount_type" "DiscountType" NOT NULL,
    "discount_value" INTEGER NOT NULL,
    "max_redemptions" INTEGER,
    "redeemed_count" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMPTZ,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "plan_ids" UUID[] DEFAULT ARRAY[]::UUID[],
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "coupons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "subscription_id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "coupon_id" UUID,
    "method" "PaymentMethod" NOT NULL,
    "transaction_id" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "expected_amount" INTEGER NOT NULL,
    "paid_at" DATE NOT NULL,
    "slip_key" TEXT NOT NULL,
    "ocr_text" TEXT,
    "status" "PaymentStatus" NOT NULL DEFAULT 'pending',
    "reviewed_by" UUID,
    "reviewed_at" TIMESTAMPTZ,
    "reject_reason" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" UUID NOT NULL,
    "invoice_no" TEXT NOT NULL,
    "payment_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "amount" INTEGER NOT NULL,
    "pdf_key" TEXT,
    "emailed_at" TIMESTAMPTZ,
    "issued_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_counters" (
    "id" UUID NOT NULL,
    "year" INTEGER NOT NULL,
    "last_no" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "invoice_counters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "updated_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "subscriptions_user_id_status_idx" ON "subscriptions"("user_id", "status");

-- CreateIndex
CREATE INDEX "subscriptions_status_ends_at_idx" ON "subscriptions"("status", "ends_at");

-- CreateIndex
CREATE UNIQUE INDEX "trial_claims_email_key_key" ON "trial_claims"("email_key");

-- CreateIndex
CREATE UNIQUE INDEX "trial_claims_google_id_key" ON "trial_claims"("google_id");

-- CreateIndex
CREATE UNIQUE INDEX "coupons_code_key" ON "coupons"("code");

-- CreateIndex
CREATE UNIQUE INDEX "payments_transaction_id_key" ON "payments"("transaction_id");

-- CreateIndex
CREATE INDEX "payments_status_created_at_idx" ON "payments"("status", "created_at");

-- CreateIndex
CREATE INDEX "payments_user_id_idx" ON "payments"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_invoice_no_key" ON "invoices"("invoice_no");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_payment_id_key" ON "invoices"("payment_id");

-- CreateIndex
CREATE INDEX "invoices_user_id_idx" ON "invoices"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_counters_year_key" ON "invoice_counters"("year");

-- CreateIndex
CREATE UNIQUE INDEX "settings_key_key" ON "settings"("key");

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
