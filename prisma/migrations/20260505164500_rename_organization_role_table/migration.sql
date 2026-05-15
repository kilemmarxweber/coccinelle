DO $$
BEGIN
  -- Rename Better Auth dynamic role table to expected casing.
  IF to_regclass('public."OrganizationRole"') IS NOT NULL
     AND to_regclass('public."organizationRole"') IS NULL THEN
    EXECUTE 'ALTER TABLE "OrganizationRole" RENAME TO "organizationRole"';
  END IF;

  -- Keep index names aligned with the new table name.
  IF to_regclass('public."OrganizationRole_organizationId_idx"') IS NOT NULL
     AND to_regclass('public."organizationRole_organizationId_idx"') IS NULL THEN
    EXECUTE 'ALTER INDEX "OrganizationRole_organizationId_idx" RENAME TO "organizationRole_organizationId_idx"';
  END IF;

  IF to_regclass('public."OrganizationRole_organizationId_role_key"') IS NOT NULL
     AND to_regclass('public."organizationRole_organizationId_role_key"') IS NULL THEN
    EXECUTE 'ALTER INDEX "OrganizationRole_organizationId_role_key" RENAME TO "organizationRole_organizationId_role_key"';
  END IF;

  -- Keep foreign key name aligned as well.
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'organizationRole'
      AND constraint_name = 'OrganizationRole_organizationId_fkey'
  ) THEN
    EXECUTE 'ALTER TABLE "organizationRole" RENAME CONSTRAINT "OrganizationRole_organizationId_fkey" TO "organizationRole_organizationId_fkey"';
  END IF;
END $$;
