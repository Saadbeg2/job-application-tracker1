-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('Applied', 'Interview', 'Rejected', 'Offer', 'Withdrawn');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('pending', 'completed', 'ignored');

-- CreateEnum
CREATE TYPE "ReviewItemType" AS ENUM ('new_application', 'status_update', 'task', 'unknown_job_related');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('pending', 'approved', 'ignored', 'not_relevant');

-- CreateEnum
CREATE TYPE "ReportSendStatus" AS ENUM ('sent', 'failed');

-- CreateEnum
CREATE TYPE "WorkMode" AS ENUM ('Remote', 'Hybrid', 'OnSite', 'Unknown');

-- CreateEnum
CREATE TYPE "DiscoveredJobStatus" AS ENUM ('new', 'saved', 'ignored', 'applied');

-- CreateTable
CREATE TABLE "Application" (
    "id" SERIAL NOT NULL,
    "company" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "dateApplied" TIMESTAMP(3) NOT NULL,
    "lastFollowedUpAt" TIMESTAMP(3),
    "lastFollowedUpWith" TEXT,
    "lastFollowUpNotes" TEXT,
    "followUpCount" INTEGER NOT NULL DEFAULT 0,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'Applied',
    "source" TEXT,
    "jobLink" TEXT,
    "resumeUsed" TEXT,
    "notes" TEXT,
    "jobDescription" TEXT,
    "location" TEXT,
    "referral" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Application_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" SERIAL NOT NULL,
    "applicationId" INTEGER,
    "company" TEXT NOT NULL,
    "role" TEXT,
    "title" TEXT NOT NULL,
    "status" "TaskStatus" NOT NULL DEFAULT 'pending',
    "dueDate" TIMESTAMP(3),
    "sourceEmailSubject" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewItem" (
    "id" SERIAL NOT NULL,
    "type" "ReviewItemType" NOT NULL,
    "reviewStatus" "ReviewStatus" NOT NULL DEFAULT 'pending',
    "company" TEXT NOT NULL,
    "role" TEXT,
    "location" TEXT,
    "suggestedStatus" "ApplicationStatus",
    "taskTitle" TEXT,
    "source" TEXT,
    "gmailMessageId" TEXT,
    "threadId" TEXT,
    "emailSender" TEXT,
    "emailSubject" TEXT,
    "emailReceivedAt" TIMESTAMP(3),
    "confidence" DOUBLE PRECISION,
    "matchedApplicationId" INTEGER,
    "extractedDataJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReviewItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailMetadata" (
    "id" SERIAL NOT NULL,
    "gmailMessageId" TEXT NOT NULL,
    "threadId" TEXT,
    "sender" TEXT,
    "subject" TEXT,
    "receivedAt" TIMESTAMP(3),
    "detectedType" "ReviewItemType" NOT NULL,
    "confidence" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailMetadata_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GmailConnection" (
    "id" SERIAL NOT NULL,
    "providerAccountEmail" TEXT,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT,
    "expiryDate" TIMESTAMP(3),
    "grantedScopes" TEXT,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GmailConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScanHistory" (
    "id" SERIAL NOT NULL,
    "scanStartedAt" TIMESTAMP(3) NOT NULL,
    "scanEndedAt" TIMESTAMP(3) NOT NULL,
    "scanWindowStart" TIMESTAMP(3) NOT NULL,
    "scanWindowEnd" TIMESTAMP(3) NOT NULL,
    "resultCount" INTEGER NOT NULL,
    "createdReviewItemsCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScanHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoogleSheetSync" (
    "id" SERIAL NOT NULL,
    "spreadsheetId" TEXT NOT NULL,
    "spreadsheetUrl" TEXT NOT NULL,
    "applicationsSheetName" TEXT NOT NULL DEFAULT 'Applications',
    "tasksSheetName" TEXT NOT NULL DEFAULT 'Tasks',
    "lastSyncedAt" TIMESTAMP(3),
    "lastSyncStatus" TEXT,
    "lastSyncError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoogleSheetSync_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportRecipient" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReportRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportSendLog" (
    "id" SERIAL NOT NULL,
    "recipientId" INTEGER NOT NULL,
    "reportDate" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL,
    "status" "ReportSendStatus" NOT NULL,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportSendLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscoveredJob" (
    "id" SERIAL NOT NULL,
    "companyName" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "location" TEXT,
    "workMode" "WorkMode" NOT NULL DEFAULT 'Unknown',
    "jobUrl" TEXT NOT NULL,
    "description" TEXT,
    "dateFound" TIMESTAMP(3) NOT NULL,
    "fitScore" INTEGER,
    "fitReason" TEXT,
    "status" "DiscoveredJobStatus" NOT NULL DEFAULT 'new',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiscoveredJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Task_applicationId_idx" ON "Task"("applicationId");

-- CreateIndex
CREATE INDEX "ReviewItem_reviewStatus_idx" ON "ReviewItem"("reviewStatus");

-- CreateIndex
CREATE INDEX "ReviewItem_type_idx" ON "ReviewItem"("type");

-- CreateIndex
CREATE INDEX "ReviewItem_matchedApplicationId_idx" ON "ReviewItem"("matchedApplicationId");

-- CreateIndex
CREATE INDEX "ReviewItem_gmailMessageId_idx" ON "ReviewItem"("gmailMessageId");

-- CreateIndex
CREATE UNIQUE INDEX "EmailMetadata_gmailMessageId_key" ON "EmailMetadata"("gmailMessageId");

-- CreateIndex
CREATE UNIQUE INDEX "ReportRecipient_email_key" ON "ReportRecipient"("email");

-- CreateIndex
CREATE INDEX "ReportSendLog_reportDate_idx" ON "ReportSendLog"("reportDate");

-- CreateIndex
CREATE UNIQUE INDEX "ReportSendLog_recipientId_reportDate_key" ON "ReportSendLog"("recipientId", "reportDate");

-- CreateIndex
CREATE UNIQUE INDEX "DiscoveredJob_jobUrl_key" ON "DiscoveredJob"("jobUrl");

-- CreateIndex
CREATE INDEX "DiscoveredJob_status_idx" ON "DiscoveredJob"("status");

-- CreateIndex
CREATE INDEX "DiscoveredJob_fitScore_idx" ON "DiscoveredJob"("fitScore");

-- CreateIndex
CREATE INDEX "DiscoveredJob_dateFound_idx" ON "DiscoveredJob"("dateFound");

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewItem" ADD CONSTRAINT "ReviewItem_matchedApplicationId_fkey" FOREIGN KEY ("matchedApplicationId") REFERENCES "Application"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportSendLog" ADD CONSTRAINT "ReportSendLog_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "ReportRecipient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
