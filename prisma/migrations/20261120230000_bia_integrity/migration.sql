-- CreateEnum
CREATE TYPE "BiaSeverity" AS ENUM ('INFO', 'MOYENNE', 'ELEVEE', 'CRITIQUE');

-- CreateEnum
CREATE TYPE "IntegrityFindingStatus" AS ENUM ('OUVERT', 'QUALIFIE', 'RESOLU', 'CLOS');

-- CreateEnum
CREATE TYPE "BiaIncidentStatus" AS ENUM ('OUVERT', 'EN_COURS', 'RESOLU', 'CLOS');

-- CreateTable
CREATE TABLE "IntegrityFinding" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "branchId" TEXT,
    "ruleCode" TEXT NOT NULL,
    "severity" "BiaSeverity" NOT NULL,
    "status" "IntegrityFindingStatus" NOT NULL DEFAULT 'OUVERT',
    "title" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "fingerprint" TEXT NOT NULL,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "IntegrityFinding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BiaIncident" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "findingId" TEXT,
    "title" TEXT NOT NULL,
    "severity" "BiaSeverity" NOT NULL,
    "status" "BiaIncidentStatus" NOT NULL DEFAULT 'OUVERT',
    "assigneeName" TEXT,
    "openedByUserId" TEXT NOT NULL,
    "openedByName" TEXT NOT NULL,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BiaIncident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BiaIncidentEvent" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BiaIncidentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IntegrityFinding_organizationId_fingerprint_key" ON "IntegrityFinding"("organizationId", "fingerprint");
CREATE INDEX "IntegrityFinding_organizationId_status_idx" ON "IntegrityFinding"("organizationId", "status");
CREATE INDEX "IntegrityFinding_branchId_idx" ON "IntegrityFinding"("branchId");
CREATE UNIQUE INDEX "BiaIncident_findingId_key" ON "BiaIncident"("findingId");
CREATE INDEX "BiaIncident_organizationId_status_idx" ON "BiaIncident"("organizationId", "status");
CREATE INDEX "BiaIncidentEvent_incidentId_createdAt_idx" ON "BiaIncidentEvent"("incidentId", "createdAt");

-- AddForeignKey
ALTER TABLE "IntegrityFinding" ADD CONSTRAINT "IntegrityFinding_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IntegrityFinding" ADD CONSTRAINT "IntegrityFinding_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BiaIncident" ADD CONSTRAINT "BiaIncident_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BiaIncident" ADD CONSTRAINT "BiaIncident_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "IntegrityFinding"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BiaIncidentEvent" ADD CONSTRAINT "BiaIncidentEvent_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "BiaIncident"("id") ON DELETE CASCADE ON UPDATE CASCADE;
