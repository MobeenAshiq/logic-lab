-- CreateEnum
CREATE TYPE "PostKind" AS ENUM ('question', 'announcement');

-- CreateEnum
CREATE TYPE "ReportReason" AS ENUM ('spam', 'abuse', 'cheating', 'off_topic', 'other');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('open', 'resolved', 'dismissed');

-- CreateEnum
CREATE TYPE "ModerationAction" AS ENUM ('hide', 'delete', 'warn', 'dismiss', 'restore');

-- CreateTable
CREATE TABLE "posts" (
    "id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "kind" "PostKind" NOT NULL DEFAULT 'question',
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "code_snippet" TEXT,
    "code_language" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "track_id" UUID,
    "accepted_answer_id" UUID,
    "score" INTEGER NOT NULL DEFAULT 0,
    "answer_count" INTEGER NOT NULL DEFAULT 0,
    "is_pinned" BOOLEAN NOT NULL DEFAULT false,
    "hidden_at" TIMESTAMPTZ,
    "deleted_at" TIMESTAMPTZ,
    "last_activity_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post_answers" (
    "id" UUID NOT NULL,
    "post_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "code_snippet" TEXT,
    "code_language" TEXT,
    "score" INTEGER NOT NULL DEFAULT 0,
    "is_staff" BOOLEAN NOT NULL DEFAULT false,
    "hidden_at" TIMESTAMPTZ,
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "post_answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "votes" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "post_id" UUID,
    "answer_id" UUID,
    "value" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "votes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" UUID NOT NULL,
    "reporter_id" UUID NOT NULL,
    "post_id" UUID,
    "answer_id" UUID,
    "reason" "ReportReason" NOT NULL,
    "details" TEXT NOT NULL DEFAULT '',
    "status" "ReportStatus" NOT NULL DEFAULT 'open',
    "action" "ModerationAction",
    "note" TEXT NOT NULL DEFAULT '',
    "resolved_by" UUID,
    "resolved_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_warnings" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "issued_by" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "report_id" UUID,
    "acknowledged_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "user_warnings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "posts_accepted_answer_id_key" ON "posts"("accepted_answer_id");

-- CreateIndex
CREATE INDEX "posts_deleted_at_hidden_at_created_at_idx" ON "posts"("deleted_at", "hidden_at", "created_at");

-- CreateIndex
CREATE INDEX "posts_track_id_idx" ON "posts"("track_id");

-- CreateIndex
CREATE INDEX "post_answers_post_id_created_at_idx" ON "post_answers"("post_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "votes_user_id_post_id_key" ON "votes"("user_id", "post_id");

-- CreateIndex
CREATE UNIQUE INDEX "votes_user_id_answer_id_key" ON "votes"("user_id", "answer_id");

-- CreateIndex
CREATE INDEX "reports_status_created_at_idx" ON "reports"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "reports_reporter_id_post_id_key" ON "reports"("reporter_id", "post_id");

-- CreateIndex
CREATE UNIQUE INDEX "reports_reporter_id_answer_id_key" ON "reports"("reporter_id", "answer_id");

-- CreateIndex
CREATE INDEX "user_warnings_user_id_acknowledged_at_idx" ON "user_warnings"("user_id", "acknowledged_at");

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_track_id_fkey" FOREIGN KEY ("track_id") REFERENCES "tracks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_accepted_answer_id_fkey" FOREIGN KEY ("accepted_answer_id") REFERENCES "post_answers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_answers" ADD CONSTRAINT "post_answers_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_answers" ADD CONSTRAINT "post_answers_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "votes" ADD CONSTRAINT "votes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "votes" ADD CONSTRAINT "votes_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "votes" ADD CONSTRAINT "votes_answer_id_fkey" FOREIGN KEY ("answer_id") REFERENCES "post_answers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_answer_id_fkey" FOREIGN KEY ("answer_id") REFERENCES "post_answers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_warnings" ADD CONSTRAINT "user_warnings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- A vote / report targets exactly one item; votes are +1 or -1.
ALTER TABLE "votes" ADD CONSTRAINT "votes_one_target" CHECK (num_nonnulls("post_id", "answer_id") = 1);
ALTER TABLE "votes" ADD CONSTRAINT "votes_value" CHECK ("value" IN (-1, 1));
ALTER TABLE "reports" ADD CONSTRAINT "reports_one_target" CHECK (num_nonnulls("post_id", "answer_id") = 1);
