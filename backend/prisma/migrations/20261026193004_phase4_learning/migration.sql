-- AlterTable
ALTER TABLE "lessons" ADD COLUMN     "notes" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "video_size" INTEGER;

-- CreateTable
CREATE TABLE "lesson_attachments" (
    "id" UUID NOT NULL,
    "lesson_id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "lesson_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enrollments" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "last_lesson_id" UUID,
    "last_activity_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lesson_progress" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "lesson_id" UUID NOT NULL,
    "watched_seconds" INTEGER NOT NULL DEFAULT 0,
    "position_seconds" INTEGER NOT NULL DEFAULT 0,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completed_at" TIMESTAMPTZ,
    "last_ping_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "lesson_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "study_days" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "day" DATE NOT NULL,
    "seconds" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "study_days_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lesson_questions" (
    "id" UUID NOT NULL,
    "lesson_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "timestamp_seconds" INTEGER,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "lesson_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lesson_answers" (
    "id" UUID NOT NULL,
    "question_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "is_staff" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "lesson_answers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "lesson_attachments_key_key" ON "lesson_attachments"("key");

-- CreateIndex
CREATE INDEX "lesson_attachments_lesson_id_position_idx" ON "lesson_attachments"("lesson_id", "position");

-- CreateIndex
CREATE INDEX "enrollments_user_id_last_activity_at_idx" ON "enrollments"("user_id", "last_activity_at");

-- CreateIndex
CREATE UNIQUE INDEX "enrollments_user_id_course_id_key" ON "enrollments"("user_id", "course_id");

-- CreateIndex
CREATE UNIQUE INDEX "lesson_progress_user_id_lesson_id_key" ON "lesson_progress"("user_id", "lesson_id");

-- CreateIndex
CREATE UNIQUE INDEX "study_days_user_id_day_key" ON "study_days"("user_id", "day");

-- CreateIndex
CREATE INDEX "lesson_questions_lesson_id_created_at_idx" ON "lesson_questions"("lesson_id", "created_at");

-- CreateIndex
CREATE INDEX "lesson_answers_question_id_created_at_idx" ON "lesson_answers"("question_id", "created_at");

-- AddForeignKey
ALTER TABLE "lesson_attachments" ADD CONSTRAINT "lesson_attachments_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_progress" ADD CONSTRAINT "lesson_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_progress" ADD CONSTRAINT "lesson_progress_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "study_days" ADD CONSTRAINT "study_days_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_questions" ADD CONSTRAINT "lesson_questions_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_questions" ADD CONSTRAINT "lesson_questions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_answers" ADD CONSTRAINT "lesson_answers_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "lesson_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_answers" ADD CONSTRAINT "lesson_answers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
