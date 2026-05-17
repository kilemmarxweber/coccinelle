-- CreateEnum
CREATE TYPE "RoleFamille" AS ENUM ('CHEF', 'CONJOINT', 'ENFANT');

-- CreateEnum
CREATE TYPE "StatutReservation" AS ENUM ('CONFIRME', 'EMBARQUE', 'RATE', 'REPORTE', 'ANNULE');

-- CreateEnum
CREATE TYPE "StatutPaiement" AS ENUM ('EN_ATTENTE', 'PAYE', 'ECHOUE');

-- CreateEnum
CREATE TYPE "MethodePaiement" AS ENUM ('CASH', 'MOBILE_MONEY', 'CARTE');

-- CreateEnum
CREATE TYPE "StatutColis" AS ENUM ('EN_ATTENTE', 'EXPEDIE', 'LIVRE');

-- CreateEnum
CREATE TYPE "TypePassager" AS ENUM ('CLIENT', 'EXTERNE');

-- CreateEnum
CREATE TYPE "CategoriePassager" AS ENUM ('ADULTE', 'ENFANT', 'BEBE');

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "role" TEXT,
    "banned" BOOLEAN DEFAULT false,
    "banReason" TEXT,
    "banExpires" TIMESTAMP(3),

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,
    "impersonatedBy" TEXT,
    "activeOrganizationId" TEXT,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "metadata" TEXT,

    CONSTRAINT "organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organizationRole" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "permission" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "organizationRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "member" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invitation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "inviterId" TEXT NOT NULL,

    CONSTRAINT "invitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dateInscription" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Trajet" (
    "id" TEXT NOT NULL,
    "villeDepart" TEXT NOT NULL,
    "villeArrivee" TEXT NOT NULL,
    "kilosGratuits" DOUBLE PRECISION NOT NULL,
    "prixParKilo" DOUBLE PRECISION NOT NULL,
    "prixBase" DOUBLE PRECISION NOT NULL,
    "dureeEstimee" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Trajet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Passager" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "codeUnique" TEXT NOT NULL,
    "clientId" TEXT,
    "nom" TEXT NOT NULL,
    "prenom" TEXT NOT NULL,
    "dateNaissance" TIMESTAMP(3),
    "categorie" "CategoriePassager" NOT NULL,
    "prix" DOUBLE PRECISION NOT NULL,
    "type" "TypePassager" NOT NULL,
    "statut" "TypePassager" NOT NULL,
    "ordre" INTEGER NOT NULL,
    "occupePlace" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Passager_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reservation" (
    "id" TEXT NOT NULL,
    "codeUnique" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "trajetId" TEXT NOT NULL,
    "dateDepart" TIMESTAMP(3) NOT NULL,
    "heureDepart" TEXT NOT NULL,
    "statut" "StatutReservation" NOT NULL DEFAULT 'CONFIRME',
    "nombreKilos" DOUBLE PRECISION,
    "surplusKilos" DOUBLE PRECISION,
    "montantSurplus" DOUBLE PRECISION,
    "prixBillet" DOUBLE PRECISION NOT NULL,
    "prixTotal" DOUBLE PRECISION NOT NULL,
    "penalite" DOUBLE PRECISION DEFAULT 0,
    "peutReporter" BOOLEAN NOT NULL DEFAULT true,
    "dateLimiteReport" TIMESTAMP(3),
    "nombrePlaces" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Colis" (
    "id" TEXT NOT NULL,
    "codeUnique" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "trajetId" TEXT NOT NULL,
    "poids" DOUBLE PRECISION NOT NULL,
    "kilosGratuits" DOUBLE PRECISION NOT NULL,
    "surplusKilos" DOUBLE PRECISION NOT NULL,
    "montantAPayer" DOUBLE PRECISION NOT NULL,
    "statut" "StatutColis" NOT NULL DEFAULT 'EN_ATTENTE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Colis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Paiement" (
    "id" TEXT NOT NULL,
    "codeUnique" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "montant" DOUBLE PRECISION NOT NULL,
    "methode" "MethodePaiement" NOT NULL,
    "statut" "StatutPaiement" NOT NULL DEFAULT 'EN_ATTENTE',
    "reference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Paiement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Penalite" (
    "id" TEXT NOT NULL,
    "codeUnique" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "montant" DOUBLE PRECISION NOT NULL,
    "raison" TEXT NOT NULL,
    "payee" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Penalite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE INDEX "session_userId_idx" ON "session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE INDEX "account_userId_idx" ON "account"("userId");

-- CreateIndex
CREATE INDEX "verification_identifier_idx" ON "verification"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "organization_slug_key" ON "organization"("slug");

-- CreateIndex
CREATE INDEX "organizationRole_organizationId_idx" ON "organizationRole"("organizationId");

-- CreateIndex
CREATE INDEX "organizationRole_role_idx" ON "organizationRole"("role");

-- CreateIndex
CREATE INDEX "member_organizationId_idx" ON "member"("organizationId");

-- CreateIndex
CREATE INDEX "member_userId_idx" ON "member"("userId");

-- CreateIndex
CREATE INDEX "invitation_organizationId_idx" ON "invitation"("organizationId");

-- CreateIndex
CREATE INDEX "invitation_email_idx" ON "invitation"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Client_userId_key" ON "Client"("userId");

-- CreateIndex
CREATE INDEX "Trajet_villeDepart_villeArrivee_idx" ON "Trajet"("villeDepart", "villeArrivee");

-- CreateIndex
CREATE UNIQUE INDEX "Passager_codeUnique_key" ON "Passager"("codeUnique");

-- CreateIndex
CREATE INDEX "Passager_type_idx" ON "Passager"("type");

-- CreateIndex
CREATE INDEX "Passager_reservationId_idx" ON "Passager"("reservationId");

-- CreateIndex
CREATE INDEX "Passager_clientId_idx" ON "Passager"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "Reservation_codeUnique_key" ON "Reservation"("codeUnique");

-- CreateIndex
CREATE INDEX "Reservation_clientId_idx" ON "Reservation"("clientId");

-- CreateIndex
CREATE INDEX "Reservation_trajetId_idx" ON "Reservation"("trajetId");

-- CreateIndex
CREATE INDEX "Reservation_codeUnique_idx" ON "Reservation"("codeUnique");

-- CreateIndex
CREATE UNIQUE INDEX "Colis_codeUnique_key" ON "Colis"("codeUnique");

-- CreateIndex
CREATE INDEX "Colis_clientId_idx" ON "Colis"("clientId");

-- CreateIndex
CREATE INDEX "Colis_trajetId_idx" ON "Colis"("trajetId");

-- CreateIndex
CREATE INDEX "Colis_codeUnique_idx" ON "Colis"("codeUnique");

-- CreateIndex
CREATE UNIQUE INDEX "Paiement_codeUnique_key" ON "Paiement"("codeUnique");

-- CreateIndex
CREATE INDEX "Paiement_reservationId_idx" ON "Paiement"("reservationId");

-- CreateIndex
CREATE INDEX "Paiement_codeUnique_idx" ON "Paiement"("codeUnique");

-- CreateIndex
CREATE UNIQUE INDEX "Penalite_codeUnique_key" ON "Penalite"("codeUnique");

-- CreateIndex
CREATE INDEX "Penalite_reservationId_idx" ON "Penalite"("reservationId");

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organizationRole" ADD CONSTRAINT "organizationRole_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member" ADD CONSTRAINT "member_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member" ADD CONSTRAINT "member_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_inviterId_fkey" FOREIGN KEY ("inviterId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Passager" ADD CONSTRAINT "Passager_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Passager" ADD CONSTRAINT "Passager_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_trajetId_fkey" FOREIGN KEY ("trajetId") REFERENCES "Trajet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Colis" ADD CONSTRAINT "Colis_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Colis" ADD CONSTRAINT "Colis_trajetId_fkey" FOREIGN KEY ("trajetId") REFERENCES "Trajet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Paiement" ADD CONSTRAINT "Paiement_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Penalite" ADD CONSTRAINT "Penalite_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
