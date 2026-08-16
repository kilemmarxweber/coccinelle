-- Member.role : owner | admin | user (défaut user)
-- Legacy : gestionnaire → admin ; guichetier / parent / member → user

ALTER TABLE "member" ALTER COLUMN "role" SET DEFAULT 'user';

UPDATE "member"
SET "role" = 'admin'
WHERE lower("role") IN ('gestionnaire', 'admin');

UPDATE "member"
SET "role" = 'user'
WHERE lower("role") IN ('guichetier', 'parent', 'member', '')
   OR "role" IS NULL;

UPDATE "member"
SET "role" = 'owner'
WHERE lower("role") = 'owner';
