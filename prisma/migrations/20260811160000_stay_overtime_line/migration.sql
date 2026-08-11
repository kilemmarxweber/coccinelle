-- AlterEnum
DO $$ BEGIN
  ALTER TYPE "FolioLineKind" ADD VALUE IF NOT EXISTS 'STAY_OVERTIME';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
