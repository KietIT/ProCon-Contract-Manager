-- CreateEnum
CREATE TYPE "SpendingType" AS ENUM ('opex', 'capex');

-- AlterTable
ALTER TABLE "contracts" ADD COLUMN "spending_type" "SpendingType" NOT NULL DEFAULT 'opex';
