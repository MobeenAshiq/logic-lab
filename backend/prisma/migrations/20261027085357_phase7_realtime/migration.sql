-- CreateEnum
CREATE TYPE "ConversationStatus" AS ENUM ('waiting', 'open', 'closed');

-- CreateEnum
CREATE TYPE "PointReason" AS ENUM ('quiz_passed', 'assignment_on_time', 'accepted_answer', 'streak_7_days', 'live_class_attended', 'plagiarism_confirmed');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('new_doubt', 'doubt_claimed', 'chat_reply', 'grade_returned', 'quiz_graded', 'payment_approved', 'payment_rejected', 'new_answer', 'answer_accepted', 'points', 'moderation_warning', 'live_class_soon');

-- CreateTable
CREATE TABLE "conversations" (
    "id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "mentor_id" UUID,
    "course_id" UUID NOT NULL,
    "subject" TEXT NOT NULL,
    "status" "ConversationStatus" NOT NULL DEFAULT 'waiting',
    "last_message_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "student_last_read_at" TIMESTAMPTZ,
    "mentor_last_read_at" TIMESTAMPTZ,
    "claimed_at" TIMESTAMPTZ,
    "closed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "sender_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "attachment_key" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "office_hour_slots" (
    "id" UUID NOT NULL,
    "mentor_id" UUID NOT NULL,
    "weekday" INTEGER NOT NULL,
    "start_minute" INTEGER NOT NULL,
    "end_minute" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "office_hour_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seasons" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "starts_at" TIMESTAMPTZ NOT NULL,
    "ends_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "seasons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "point_events" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "reason" "PointReason" NOT NULL,
    "points" INTEGER NOT NULL,
    "source_id" TEXT NOT NULL,
    "season_id" UUID NOT NULL,
    "track_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "point_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "link" TEXT,
    "read_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "email" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "conversations_status_course_id_created_at_idx" ON "conversations"("status", "course_id", "created_at");

-- CreateIndex
CREATE INDEX "conversations_student_id_last_message_at_idx" ON "conversations"("student_id", "last_message_at");

-- CreateIndex
CREATE INDEX "conversations_mentor_id_last_message_at_idx" ON "conversations"("mentor_id", "last_message_at");

-- CreateIndex
CREATE INDEX "messages_conversation_id_created_at_idx" ON "messages"("conversation_id", "created_at");

-- CreateIndex
CREATE INDEX "office_hour_slots_mentor_id_weekday_idx" ON "office_hour_slots"("mentor_id", "weekday");

-- CreateIndex
CREATE UNIQUE INDEX "seasons_key_key" ON "seasons"("key");

-- CreateIndex
CREATE INDEX "point_events_season_id_track_id_idx" ON "point_events"("season_id", "track_id");

-- CreateIndex
CREATE UNIQUE INDEX "point_events_user_id_reason_source_id_key" ON "point_events"("user_id", "reason", "source_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_read_at_created_at_idx" ON "notifications"("user_id", "read_at", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_user_id_key" ON "notification_preferences"("user_id");

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_mentor_id_fkey" FOREIGN KEY ("mentor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "office_hour_slots" ADD CONSTRAINT "office_hour_slots_mentor_id_fkey" FOREIGN KEY ("mentor_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "point_events" ADD CONSTRAINT "point_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "point_events" ADD CONSTRAINT "point_events_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Office hours are valid minute ranges within one day.
ALTER TABLE "office_hour_slots" ADD CONSTRAINT "office_hours_valid"
  CHECK ("weekday" BETWEEN 0 AND 6 AND "start_minute" >= 0 AND "end_minute" <= 1440 AND "start_minute" < "end_minute");
