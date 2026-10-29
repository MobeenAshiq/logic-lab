CREATE TABLE "ai_usage" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "day" DATE NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "ai_usage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ai_usage_user_id_day_key" ON "ai_usage"("user_id", "day");
CREATE INDEX "ai_usage_day_idx" ON "ai_usage"("day");

ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
