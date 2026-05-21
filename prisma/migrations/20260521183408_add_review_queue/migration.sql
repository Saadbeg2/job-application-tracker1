-- CreateTable
CREATE TABLE "ReviewItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "type" TEXT NOT NULL,
    "reviewStatus" TEXT NOT NULL DEFAULT 'pending',
    "company" TEXT NOT NULL,
    "role" TEXT,
    "suggestedStatus" TEXT,
    "taskTitle" TEXT,
    "source" TEXT,
    "gmailMessageId" TEXT,
    "emailSender" TEXT,
    "emailSubject" TEXT,
    "emailReceivedAt" DATETIME,
    "confidence" REAL,
    "matchedApplicationId" INTEGER,
    "extractedDataJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ReviewItem_matchedApplicationId_fkey" FOREIGN KEY ("matchedApplicationId") REFERENCES "Application" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ReviewItem_reviewStatus_idx" ON "ReviewItem"("reviewStatus");

-- CreateIndex
CREATE INDEX "ReviewItem_type_idx" ON "ReviewItem"("type");

-- CreateIndex
CREATE INDEX "ReviewItem_matchedApplicationId_idx" ON "ReviewItem"("matchedApplicationId");
