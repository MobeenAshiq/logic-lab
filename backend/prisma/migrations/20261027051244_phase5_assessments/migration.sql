-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('mcq', 'short', 'code');

-- CreateEnum
CREATE TYPE "Difficulty" AS ENUM ('easy', 'medium', 'hard');

-- CreateEnum
CREATE TYPE "AttemptStatus" AS ENUM ('in_progress', 'submitted', 'graded');

-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('draft', 'submitted', 'returned');

-- CreateTable
CREATE TABLE "question_bank" (
    "id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "type" "QuestionType" NOT NULL,
    "difficulty" "Difficulty" NOT NULL DEFAULT 'medium',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "prompt" TEXT NOT NULL,
    "options" JSONB NOT NULL DEFAULT '[]',
    "correct_option_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "allow_multiple" BOOLEAN NOT NULL DEFAULT false,
    "explanation" TEXT NOT NULL DEFAULT '',
    "sample_answer" TEXT NOT NULL DEFAULT '',
    "code_language" TEXT,
    "points" INTEGER NOT NULL DEFAULT 1,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "question_bank_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quizzes" (
    "id" UUID NOT NULL,
    "lesson_id" UUID NOT NULL,
    "time_limit_seconds" INTEGER NOT NULL DEFAULT 1200,
    "starts_at" TIMESTAMPTZ,
    "ends_at" TIMESTAMPTZ,
    "pass_mark" INTEGER NOT NULL DEFAULT 60,
    "max_attempts" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "quizzes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quiz_questions" (
    "id" UUID NOT NULL,
    "quiz_id" UUID NOT NULL,
    "question_id" UUID NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "quiz_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quiz_attempts" (
    "id" UUID NOT NULL,
    "quiz_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "question_ids" UUID[],
    "answers" JSONB NOT NULL DEFAULT '{}',
    "typing_events" JSONB NOT NULL DEFAULT '{}',
    "flags" JSONB NOT NULL DEFAULT '{}',
    "tab_switches" INTEGER NOT NULL DEFAULT 0,
    "status" "AttemptStatus" NOT NULL DEFAULT 'in_progress',
    "started_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deadline_at" TIMESTAMPTZ NOT NULL,
    "submitted_at" TIMESTAMPTZ,
    "auto_submitted" BOOLEAN NOT NULL DEFAULT false,
    "auto_score" INTEGER NOT NULL DEFAULT 0,
    "manual_scores" JSONB NOT NULL DEFAULT '{}',
    "max_score" INTEGER NOT NULL DEFAULT 0,
    "score" INTEGER,
    "percent" INTEGER,
    "passed" BOOLEAN,
    "feedback" TEXT NOT NULL DEFAULT '',
    "graded_by" UUID,
    "graded_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "quiz_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assignments" (
    "id" UUID NOT NULL,
    "lesson_id" UUID NOT NULL,
    "instructions" TEXT NOT NULL DEFAULT '',
    "due_at" TIMESTAMPTZ,
    "max_marks" INTEGER NOT NULL DEFAULT 100,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rubrics" (
    "id" UUID NOT NULL,
    "assignment_id" UUID NOT NULL,
    "criteria" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "rubrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submissions" (
    "id" UUID NOT NULL,
    "assignment_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "typing_events" JSONB NOT NULL DEFAULT '[]',
    "flags" JSONB NOT NULL DEFAULT '{}',
    "status" "SubmissionStatus" NOT NULL DEFAULT 'draft',
    "draft_saved_at" TIMESTAMPTZ,
    "submitted_at" TIMESTAMPTZ,
    "late" BOOLEAN NOT NULL DEFAULT false,
    "grade" INTEGER,
    "rubric_scores" JSONB NOT NULL DEFAULT '{}',
    "feedback" TEXT NOT NULL DEFAULT '',
    "graded_by" UUID,
    "returned_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "submissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "question_bank_course_id_type_idx" ON "question_bank"("course_id", "type");

-- CreateIndex
CREATE UNIQUE INDEX "quizzes_lesson_id_key" ON "quizzes"("lesson_id");

-- CreateIndex
CREATE UNIQUE INDEX "quiz_questions_quiz_id_question_id_key" ON "quiz_questions"("quiz_id", "question_id");

-- CreateIndex
CREATE INDEX "quiz_attempts_quiz_id_user_id_idx" ON "quiz_attempts"("quiz_id", "user_id");

-- CreateIndex
CREATE INDEX "quiz_attempts_status_deadline_at_idx" ON "quiz_attempts"("status", "deadline_at");

-- CreateIndex
CREATE UNIQUE INDEX "assignments_lesson_id_key" ON "assignments"("lesson_id");

-- CreateIndex
CREATE UNIQUE INDEX "rubrics_assignment_id_key" ON "rubrics"("assignment_id");

-- CreateIndex
CREATE INDEX "submissions_status_submitted_at_idx" ON "submissions"("status", "submitted_at");

-- CreateIndex
CREATE UNIQUE INDEX "submissions_assignment_id_user_id_key" ON "submissions"("assignment_id", "user_id");

-- AddForeignKey
ALTER TABLE "question_bank" ADD CONSTRAINT "question_bank_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_questions" ADD CONSTRAINT "quiz_questions_quiz_id_fkey" FOREIGN KEY ("quiz_id") REFERENCES "quizzes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_questions" ADD CONSTRAINT "quiz_questions_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "question_bank"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_quiz_id_fkey" FOREIGN KEY ("quiz_id") REFERENCES "quizzes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rubrics" ADD CONSTRAINT "rubrics_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
