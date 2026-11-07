-- CreateEnum
CREATE TYPE "AiSender" AS ENUM ('user', 'assistant');

-- CreateEnum
CREATE TYPE "AiFlagStatus" AS ENUM ('none', 'blocked', 'refused');

-- CreateTable
CREATE TABLE "ai_sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "course_id" UUID,
    "module_id" UUID,
    "stack_type" TEXT NOT NULL DEFAULT 'general',
    "title" TEXT NOT NULL DEFAULT 'New chat',
    "last_message_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "ai_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_chat_logs" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "sender_type" "AiSender" NOT NULL,
    "content" TEXT NOT NULL,
    "tokens_used" INTEGER NOT NULL DEFAULT 0,
    "provider" TEXT,
    "model" TEXT,
    "flag_status" "AiFlagStatus" NOT NULL DEFAULT 'none',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_chat_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "security_flag_logs" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "session_id" UUID,
    "prompt_text" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "reviewed_at" TIMESTAMPTZ,
    "reviewed_by" UUID,
    "timestamp" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "security_flag_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_provider_keys" (
    "id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "encrypted_key" TEXT NOT NULL,
    "last4" TEXT NOT NULL,
    "updated_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "ai_provider_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_provider_usage" (
    "id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "requests" INTEGER NOT NULL DEFAULT 0,
    "failures" INTEGER NOT NULL DEFAULT 0,
    "rate_limited" INTEGER NOT NULL DEFAULT 0,
    "tokens_in" INTEGER NOT NULL DEFAULT 0,
    "tokens_out" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "ai_provider_usage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_sessions_user_id_last_message_at_idx" ON "ai_sessions"("user_id", "last_message_at");

-- CreateIndex
CREATE INDEX "ai_sessions_last_message_at_idx" ON "ai_sessions"("last_message_at");

-- CreateIndex
CREATE INDEX "ai_chat_logs_session_id_created_at_idx" ON "ai_chat_logs"("session_id", "created_at");

-- CreateIndex
CREATE INDEX "ai_chat_logs_flag_status_created_at_idx" ON "ai_chat_logs"("flag_status", "created_at");

-- CreateIndex
CREATE INDEX "security_flag_logs_timestamp_idx" ON "security_flag_logs"("timestamp");

-- CreateIndex
CREATE INDEX "security_flag_logs_reviewed_at_idx" ON "security_flag_logs"("reviewed_at");

-- CreateIndex
CREATE INDEX "security_flag_logs_user_id_idx" ON "security_flag_logs"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "ai_provider_keys_provider_key" ON "ai_provider_keys"("provider");

-- CreateIndex
CREATE INDEX "ai_provider_usage_day_idx" ON "ai_provider_usage"("day");

-- CreateIndex
CREATE UNIQUE INDEX "ai_provider_usage_provider_day_key" ON "ai_provider_usage"("provider", "day");

-- AddForeignKey
ALTER TABLE "ai_sessions" ADD CONSTRAINT "ai_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_sessions" ADD CONSTRAINT "ai_sessions_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_sessions" ADD CONSTRAINT "ai_sessions_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "modules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_chat_logs" ADD CONSTRAINT "ai_chat_logs_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "ai_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "security_flag_logs" ADD CONSTRAINT "security_flag_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "security_flag_logs" ADD CONSTRAINT "security_flag_logs_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "ai_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
