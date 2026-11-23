-- AlterTable
ALTER TABLE "plans" ADD COLUMN "course_ids" UUID[] DEFAULT ARRAY[]::UUID[];

-- AlterTable
ALTER TABLE "subscriptions" ADD COLUMN "course_ids" UUID[] DEFAULT ARRAY[]::UUID[];
