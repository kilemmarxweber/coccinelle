-- CreateEnum
CREATE TYPE "StatutReservation" AS ENUM ('CONFIRME', 'EMBARQUE', 'RATE', 'REPORTE', 'ANNULE');

-- CreateEnum
CREATE TYPE "StatutPaiement" AS ENUM ('EN_ATTENTE', 'PAYE', 'ECHOUE');

-- CreateEnum
CREATE TYPE "MethodePaiement" AS ENUM ('CASH', 'MOBILE_MONEY', 'CARTE');

-- CreateEnum
CREATE TYPE "StatutColis" AS ENUM ('EN_ATTENTE', 'EXPEDIE', 'LIVRE');

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "postnom" TEXT NOT NULL,
    "prenom" TEXT NOT NULL,
    "sexe" TEXT NOT NULL,
    "dateNaissance" TIMESTAMP(3) NOT NULL,
    "telephone" TEXT NOT NULL,
    "email" TEXT,
    "numeroIdentite" TEXT NOT NULL,
    "adresse" TEXT,
    "nationalite" TEXT,
    "photo" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'actif',
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
CREATE UNIQUE INDEX "Client_telephone_key" ON "Client"("telephone");

-- CreateIndex
CREATE UNIQUE INDEX "Client_email_key" ON "Client"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Client_numeroIdentite_key" ON "Client"("numeroIdentite");

-- CreateIndex
CREATE INDEX "Client_telephone_idx" ON "Client"("telephone");

-- CreateIndex
CREATE INDEX "Trajet_villeDepart_villeArrivee_idx" ON "Trajet"("villeDepart", "villeArrivee");

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
