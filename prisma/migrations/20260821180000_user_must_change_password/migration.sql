-- Première connexion : mot de passe à changer (comptes créés par un admin).
ALTER TABLE "user"
  ADD COLUMN IF NOT EXISTS "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;
