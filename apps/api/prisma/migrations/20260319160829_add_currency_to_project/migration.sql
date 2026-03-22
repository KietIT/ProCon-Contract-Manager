-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('USD', 'VND');

-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "currency" "Currency" NOT NULL DEFAULT 'USD';
