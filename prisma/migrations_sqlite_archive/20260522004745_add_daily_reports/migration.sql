-- CreateTable
CREATE TABLE "ReportRecipient" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ReportSendLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "recipientId" INTEGER NOT NULL,
    "reportDate" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "sentAt" DATETIME NOT NULL,
    "status" TEXT NOT NULL,
    "errorMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReportSendLog_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "ReportRecipient" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "ReportRecipient_email_key" ON "ReportRecipient"("email");

-- CreateIndex
CREATE INDEX "ReportSendLog_reportDate_idx" ON "ReportSendLog"("reportDate");

-- CreateIndex
CREATE UNIQUE INDEX "ReportSendLog_recipientId_reportDate_key" ON "ReportSendLog"("recipientId", "reportDate");
