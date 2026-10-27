-- CreateTable
CREATE TABLE "live_sessions" (
    "id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "mentor_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "starts_at" TIMESTAMPTZ NOT NULL,
    "duration_minutes" INTEGER NOT NULL DEFAULT 60,
    "room_name" TEXT NOT NULL,
    "recording_key" TEXT,
    "reminder_sent_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "live_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "joined_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "left_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "attendance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "live_sessions_room_name_key" ON "live_sessions"("room_name");

-- CreateIndex
CREATE INDEX "live_sessions_course_id_starts_at_idx" ON "live_sessions"("course_id", "starts_at");

-- CreateIndex
CREATE INDEX "live_sessions_mentor_id_starts_at_idx" ON "live_sessions"("mentor_id", "starts_at");

-- CreateIndex
CREATE INDEX "attendance_user_id_joined_at_idx" ON "attendance"("user_id", "joined_at");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_session_id_user_id_key" ON "attendance"("session_id", "user_id");

-- AddForeignKey
ALTER TABLE "live_sessions" ADD CONSTRAINT "live_sessions_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "live_sessions" ADD CONSTRAINT "live_sessions_mentor_id_fkey" FOREIGN KEY ("mentor_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "live_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
