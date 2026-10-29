ALTER TYPE "PointReason" ADD VALUE 'challenge_solved';
CREATE TYPE "ChallengeDifficulty" AS ENUM ('easy', 'medium', 'hard');

CREATE TABLE "challenges" (
    "id" UUID NOT NULL,
    "track_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "difficulty" "ChallengeDifficulty" NOT NULL DEFAULT 'easy',
    "statement" TEXT NOT NULL,
    "starter_code" TEXT NOT NULL DEFAULT '',
    "test_cases" JSONB NOT NULL DEFAULT '[]',
    "hidden_tests" JSONB NOT NULL DEFAULT '[]',
    "publish_date" DATE NOT NULL,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "challenges_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "challenges_track_id_publish_date_key" ON "challenges"("track_id", "publish_date");
CREATE INDEX "challenges_publish_date_idx" ON "challenges"("publish_date");

CREATE TABLE "challenge_submissions" (
    "id" UUID NOT NULL,
    "challenge_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "language" TEXT NOT NULL,
    "code" TEXT NOT NULL DEFAULT '',
    "passed" BOOLEAN NOT NULL DEFAULT false,
    "passed_tests" INTEGER NOT NULL DEFAULT 0,
    "total_tests" INTEGER NOT NULL DEFAULT 0,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "solved_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "challenge_submissions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "challenge_submissions_challenge_id_user_id_key" ON "challenge_submissions"("challenge_id", "user_id");
CREATE INDEX "challenge_submissions_user_id_solved_at_idx" ON "challenge_submissions"("user_id", "solved_at");

ALTER TABLE "challenges" ADD CONSTRAINT "challenges_track_id_fkey" FOREIGN KEY ("track_id") REFERENCES "tracks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "challenge_submissions" ADD CONSTRAINT "challenge_submissions_challenge_id_fkey" FOREIGN KEY ("challenge_id") REFERENCES "challenges"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "challenge_submissions" ADD CONSTRAINT "challenge_submissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
