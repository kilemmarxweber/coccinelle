-- RBAC métier branche : rôles + privilèges (catalogue global)

CREATE TYPE "PrivilegeAction" AS ENUM ('CREATE', 'READ', 'UPDATE', 'DELETE', 'VIEW');

CREATE TABLE "BranchRole" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BranchRole_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BranchRole_slug_key" ON "BranchRole"("slug");

CREATE TABLE "BranchRolePrivilege" (
    "id" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "action" "PrivilegeAction" NOT NULL,
    "allowed" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BranchRolePrivilege_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BranchRolePrivilege_roleId_resource_action_key" ON "BranchRolePrivilege"("roleId", "resource", "action");
CREATE INDEX "BranchRolePrivilege_roleId_idx" ON "BranchRolePrivilege"("roleId");
CREATE INDEX "BranchRolePrivilege_resource_idx" ON "BranchRolePrivilege"("resource");

ALTER TABLE "BranchRolePrivilege" ADD CONSTRAINT "BranchRolePrivilege_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "BranchRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;
