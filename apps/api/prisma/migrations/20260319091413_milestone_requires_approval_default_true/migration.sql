-- AlterTable
ALTER TABLE "milestones" ALTER COLUMN "requires_approval" SET DEFAULT true;

-- Backfill: set all existing milestones to require approval
UPDATE "milestones" SET "requires_approval" = true WHERE "requires_approval" = false;
