-- CreateEnum
CREATE TYPE "Department" AS ENUM ('rotating', 'instrument', 'static_dept', 'electrical', 'process_control_automation');

-- AlterTable
ALTER TABLE "contracts" ADD COLUMN "department" "Department" NOT NULL DEFAULT 'rotating';
