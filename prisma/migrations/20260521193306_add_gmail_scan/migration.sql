-- AlterTable
ALTER TABLE "ReviewItem" ADD COLUMN "threadId" TEXT;

-- CreateTable
CREATE TABLE "EmailMetadata" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "gmailMessageId" TEXT NOT NULL,
    "threadId" TEXT,
    "sender" TEXT,
    "subject" TEXT,
    "receivedAt" DATETIME,
    "detectedType" TEXT NOT NULL,
    "confidence" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "GmailConnection" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "providerAccountEmail" TEXT,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT,
    "expiryDate" DATETIME,
    "connectedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ScanHistory" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "scanStartedAt" DATETIME NOT NULL,
    "scanEndedAt" DATETIME NOT NULL,
    "scanWindowStart" DATETIME NOT NULL,
    "scanWindowEnd" DATETIME NOT NULL,
    "resultCount" INTEGER NOT NULL,
    "createdReviewItemsCount" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "EmailMetadata_gmailMessageId_key" ON "EmailMetadata"("gmailMessageId");

-- CreateIndex
CREATE INDEX "ReviewItem_gmailMessageId_idx" ON "ReviewItem"("gmailMessageId");
