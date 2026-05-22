-- AlterTable
ALTER TABLE "GmailConnection" ADD COLUMN "grantedScopes" TEXT;

-- CreateTable
CREATE TABLE "GoogleSheetSync" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "spreadsheetId" TEXT NOT NULL,
    "spreadsheetUrl" TEXT NOT NULL,
    "applicationsSheetName" TEXT NOT NULL DEFAULT 'Applications',
    "tasksSheetName" TEXT NOT NULL DEFAULT 'Tasks',
    "lastSyncedAt" DATETIME,
    "lastSyncStatus" TEXT,
    "lastSyncError" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
