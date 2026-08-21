-- CreateEnum
CREATE TYPE "PayrollPeriodStatus" AS ENUM ('OPEN', 'REVIEW', 'LOCKED', 'PAID');

-- CreateEnum
CREATE TYPE "AttendanceKind" AS ENUM ('PRESENT', 'ABSENT', 'ABSENT_NOTIFIED', 'LEAVE', 'REST');

-- CreateEnum
CREATE TYPE "PayTreatment" AS ENUM ('PAID', 'UNPAID', 'NONE');

-- CreateEnum
CREATE TYPE "JustificationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "AdvanceStatus" AS ENUM ('REQUESTED', 'APPROVED', 'PAID', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "StaffPayoutMethod" AS ENUM ('MOBILE_MONEY', 'BANK', 'CASH');

-- CreateEnum
CREATE TYPE "LeaveRequestStatus" AS ENUM ('REQUESTED', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "BranchPayrollSettings" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "defaultDailyRateUsd" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "workWeek" JSONB NOT NULL,
    "notifyBeforeHour" INTEGER NOT NULL DEFAULT 18,
    "advanceCapPct" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "justificationDays" INTEGER NOT NULL DEFAULT 3,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BranchPayrollSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffPayrollProfile" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "branchMemberId" TEXT NOT NULL,
    "dailyRateUsd" DOUBLE PRECISION,
    "payoutMethod" "StaffPayoutMethod" NOT NULL DEFAULT 'MOBILE_MONEY',
    "mobileMoneyPhone" TEXT,
    "bankName" TEXT,
    "bankAccount" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffPayrollProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollPeriod" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "status" "PayrollPeriodStatus" NOT NULL DEFAULT 'OPEN',
    "exchangeRateUsed" DOUBLE PRECISION,
    "closedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffAttendanceDay" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "branchMemberId" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "workDate" DATE NOT NULL,
    "kind" "AttendanceKind" NOT NULL,
    "payTreatment" "PayTreatment" NOT NULL,
    "dailyRateUsd" DOUBLE PRECISION NOT NULL,
    "justificationStatus" "JustificationStatus",
    "justificationNote" TEXT,
    "absenceNoticeSentAt" TIMESTAMP(3),
    "followUpNoticeSentAt" TIMESTAMP(3),
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffAttendanceDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffLeaveRequest" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "branchMemberId" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "status" "LeaveRequestStatus" NOT NULL DEFAULT 'REQUESTED',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffLeaveRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffSalaryAdvance" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "branchMemberId" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "amountUsd" DOUBLE PRECISION NOT NULL,
    "status" "AdvanceStatus" NOT NULL DEFAULT 'REQUESTED',
    "expenseId" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffSalaryAdvance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payslip" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "branchMemberId" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "dailyRateUsd" DOUBLE PRECISION NOT NULL,
    "expectedDays" INTEGER NOT NULL,
    "unpaidAbsenceDays" INTEGER NOT NULL,
    "grossUsd" DOUBLE PRECISION NOT NULL,
    "absenceDeductionUsd" DOUBLE PRECISION NOT NULL,
    "advancesUsd" DOUBLE PRECISION NOT NULL,
    "netUsd" DOUBLE PRECISION NOT NULL,
    "netCdf" DOUBLE PRECISION NOT NULL,
    "exchangeRateUsed" DOUBLE PRECISION NOT NULL,
    "lines" JSONB NOT NULL,
    "pdfUrl" TEXT,
    "expenseId" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payslip_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BranchPayrollSettings_branchId_key" ON "BranchPayrollSettings"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "StaffPayrollProfile_branchMemberId_key" ON "StaffPayrollProfile"("branchMemberId");

-- CreateIndex
CREATE INDEX "StaffPayrollProfile_branchId_active_idx" ON "StaffPayrollProfile"("branchId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollPeriod_branchId_year_month_key" ON "PayrollPeriod"("branchId", "year", "month");

-- CreateIndex
CREATE INDEX "PayrollPeriod_branchId_status_idx" ON "PayrollPeriod"("branchId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "StaffAttendanceDay_branchMemberId_workDate_key" ON "StaffAttendanceDay"("branchMemberId", "workDate");

-- CreateIndex
CREATE INDEX "StaffAttendanceDay_branchId_workDate_idx" ON "StaffAttendanceDay"("branchId", "workDate");

-- CreateIndex
CREATE INDEX "StaffAttendanceDay_periodId_idx" ON "StaffAttendanceDay"("periodId");

-- CreateIndex
CREATE INDEX "StaffLeaveRequest_branchId_status_idx" ON "StaffLeaveRequest"("branchId", "status");

-- CreateIndex
CREATE INDEX "StaffLeaveRequest_branchMemberId_startDate_idx" ON "StaffLeaveRequest"("branchMemberId", "startDate");

-- CreateIndex
CREATE UNIQUE INDEX "StaffSalaryAdvance_expenseId_key" ON "StaffSalaryAdvance"("expenseId");

-- CreateIndex
CREATE INDEX "StaffSalaryAdvance_branchId_periodId_idx" ON "StaffSalaryAdvance"("branchId", "periodId");

-- CreateIndex
CREATE INDEX "StaffSalaryAdvance_branchMemberId_status_idx" ON "StaffSalaryAdvance"("branchMemberId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Payslip_expenseId_key" ON "Payslip"("expenseId");

-- CreateIndex
CREATE UNIQUE INDEX "Payslip_periodId_branchMemberId_key" ON "Payslip"("periodId", "branchMemberId");

-- CreateIndex
CREATE INDEX "Payslip_branchId_periodId_idx" ON "Payslip"("branchId", "periodId");

-- AddForeignKey
ALTER TABLE "BranchPayrollSettings" ADD CONSTRAINT "BranchPayrollSettings_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffPayrollProfile" ADD CONSTRAINT "StaffPayrollProfile_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffPayrollProfile" ADD CONSTRAINT "StaffPayrollProfile_branchMemberId_fkey" FOREIGN KEY ("branchMemberId") REFERENCES "BranchMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollPeriod" ADD CONSTRAINT "PayrollPeriod_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffAttendanceDay" ADD CONSTRAINT "StaffAttendanceDay_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffAttendanceDay" ADD CONSTRAINT "StaffAttendanceDay_branchMemberId_fkey" FOREIGN KEY ("branchMemberId") REFERENCES "BranchMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffAttendanceDay" ADD CONSTRAINT "StaffAttendanceDay_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "PayrollPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffLeaveRequest" ADD CONSTRAINT "StaffLeaveRequest_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffLeaveRequest" ADD CONSTRAINT "StaffLeaveRequest_branchMemberId_fkey" FOREIGN KEY ("branchMemberId") REFERENCES "BranchMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffSalaryAdvance" ADD CONSTRAINT "StaffSalaryAdvance_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffSalaryAdvance" ADD CONSTRAINT "StaffSalaryAdvance_branchMemberId_fkey" FOREIGN KEY ("branchMemberId") REFERENCES "BranchMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffSalaryAdvance" ADD CONSTRAINT "StaffSalaryAdvance_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "PayrollPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payslip" ADD CONSTRAINT "Payslip_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payslip" ADD CONSTRAINT "Payslip_branchMemberId_fkey" FOREIGN KEY ("branchMemberId") REFERENCES "BranchMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payslip" ADD CONSTRAINT "Payslip_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "PayrollPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;
