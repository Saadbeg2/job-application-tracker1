-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Application" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "company" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "dateApplied" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Applied',
    "source" TEXT,
    "jobLink" TEXT,
    "resumeUsed" TEXT,
    "notes" TEXT,
    "jobDescription" TEXT,
    "location" TEXT,
    "referral" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Application" ("company", "createdAt", "dateApplied", "id", "jobDescription", "jobLink", "location", "notes", "referral", "resumeUsed", "role", "source", "status", "updatedAt") SELECT "company", "createdAt", "dateApplied", "id", "jobDescription", "jobLink", "location", "notes", "referral", "resumeUsed", "role", "source", "status", "updatedAt" FROM "Application";
DROP TABLE "Application";
ALTER TABLE "new_Application" RENAME TO "Application";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
