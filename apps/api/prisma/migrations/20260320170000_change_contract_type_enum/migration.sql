-- Update existing contracts to use new type values before changing enum
UPDATE "contracts" SET "type" = 'subcontract' WHERE "type" IN ('supply', 'service', 'mep', 'inspection');

-- Create new enum type
CREATE TYPE "ContractType_new" AS ENUM ('once_off', 'frame');

-- Map old values to new: subcontract -> once_off (default mapping)
ALTER TABLE "contracts" ALTER COLUMN "type" TYPE text;
UPDATE "contracts" SET "type" = 'once_off' WHERE "type" = 'subcontract';

-- Drop old enum and rename new one
DROP TYPE "ContractType";
ALTER TYPE "ContractType_new" RENAME TO "ContractType";

-- Cast column back to enum
ALTER TABLE "contracts" ALTER COLUMN "type" TYPE "ContractType" USING "type"::"ContractType";
