-- CreateTable
CREATE TABLE "DiscoveredJob" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "companyName" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "location" TEXT,
    "workMode" TEXT NOT NULL DEFAULT 'Unknown',
    "jobUrl" TEXT NOT NULL,
    "description" TEXT,
    "dateFound" DATETIME NOT NULL,
    "fitScore" INTEGER,
    "fitReason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'new',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "DiscoveredJob_jobUrl_key" ON "DiscoveredJob"("jobUrl");

-- CreateIndex
CREATE INDEX "DiscoveredJob_status_idx" ON "DiscoveredJob"("status");

-- CreateIndex
CREATE INDEX "DiscoveredJob_fitScore_idx" ON "DiscoveredJob"("fitScore");

-- CreateIndex
CREATE INDEX "DiscoveredJob_dateFound_idx" ON "DiscoveredJob"("dateFound");
