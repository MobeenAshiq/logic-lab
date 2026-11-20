-- AlterTable
ALTER TABLE "daily_assignments" ADD COLUMN "language" TEXT;

-- CreateTable
CREATE TABLE "agent_runs" (
    "id" UUID NOT NULL,
    "agent" TEXT NOT NULL,
    "user_id" UUID,
    "ok" BOOLEAN NOT NULL,
    "error" TEXT,
    "provider" TEXT,
    "model" TEXT,
    "tokens_in" INTEGER NOT NULL DEFAULT 0,
    "tokens_out" INTEGER NOT NULL DEFAULT 0,
    "ms" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "agent_runs_agent_created_at_idx" ON "agent_runs"("agent", "created_at");

-- CreateIndex
CREATE INDEX "agent_runs_user_id_created_at_idx" ON "agent_runs"("user_id", "created_at");
