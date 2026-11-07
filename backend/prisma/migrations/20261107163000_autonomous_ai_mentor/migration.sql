-- CreateEnum
CREATE TYPE "DailyContentStatus" AS ENUM ('draft', 'published');

-- CreateEnum
CREATE TYPE "StudentSubmissionStatus" AS ENUM ('submitted', 'graded', 'needs_revision');

-- CreateTable
CREATE TABLE "curriculum_modules" (
    "id" UUID NOT NULL,
    "module_name" TEXT NOT NULL,
    "target_stack" TEXT NOT NULL DEFAULT 'general',
    "week_number" INTEGER NOT NULL DEFAULT 1,
    "day_number" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "curriculum_modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_articles" (
    "id" UUID NOT NULL,
    "module_id" UUID NOT NULL,
    "day_index" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "markdown_content" TEXT NOT NULL,
    "published_date" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "DailyContentStatus" NOT NULL DEFAULT 'draft',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "daily_articles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_quizzes" (
    "id" UUID NOT NULL,
    "article_id" UUID NOT NULL,
    "questions_json" JSONB NOT NULL,
    "auto_grade_key" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "daily_quizzes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_assignments" (
    "id" UUID NOT NULL,
    "article_id" UUID NOT NULL,
    "prompt_instructions" TEXT NOT NULL,
    "starter_code" TEXT NOT NULL DEFAULT '',
    "test_cases" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "daily_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_submissions" (
    "id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "assignment_id" UUID NOT NULL,
    "submitted_code" TEXT NOT NULL,
    "ai_feedback" TEXT NOT NULL DEFAULT '',
    "score" INTEGER NOT NULL DEFAULT 0,
    "status" "StudentSubmissionStatus" NOT NULL DEFAULT 'submitted',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "student_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "curriculum_modules_target_stack_day_number_key" ON "curriculum_modules"("target_stack", "day_number");

-- CreateIndex
CREATE UNIQUE INDEX "daily_articles_module_id_day_index_key" ON "daily_articles"("module_id", "day_index");
CREATE INDEX "daily_articles_status_published_date_idx" ON "daily_articles"("status", "published_date");
CREATE INDEX "daily_articles_day_index_idx" ON "daily_articles"("day_index");

-- CreateIndex
CREATE UNIQUE INDEX "daily_quizzes_article_id_key" ON "daily_quizzes"("article_id");

-- CreateIndex
CREATE UNIQUE INDEX "daily_assignments_article_id_key" ON "daily_assignments"("article_id");

-- CreateIndex
CREATE INDEX "student_submissions_student_id_assignment_id_idx" ON "student_submissions"("student_id", "assignment_id");
CREATE INDEX "student_submissions_assignment_id_created_at_idx" ON "student_submissions"("assignment_id", "created_at");

-- AddForeignKey
ALTER TABLE "daily_articles" ADD CONSTRAINT "daily_articles_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "curriculum_modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_quizzes" ADD CONSTRAINT "daily_quizzes_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "daily_articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_assignments" ADD CONSTRAINT "daily_assignments_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "daily_articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_submissions" ADD CONSTRAINT "student_submissions_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_submissions" ADD CONSTRAINT "student_submissions_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "daily_assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
