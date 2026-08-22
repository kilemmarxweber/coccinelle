-- Couleurs de base de l’interface client, par branche.
ALTER TABLE "Branch" ADD COLUMN IF NOT EXISTS "customerUiPrimary" TEXT;
ALTER TABLE "Branch" ADD COLUMN IF NOT EXISTS "customerUiBackground" TEXT;
ALTER TABLE "Branch" ADD COLUMN IF NOT EXISTS "customerUiCard" TEXT;
