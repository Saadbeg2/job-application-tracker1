-- CreateTable
CREATE TABLE "GuestCompanySuggestion" (
    "id" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "suggestedBy" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'new',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuestCompanySuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GuestCompanySuggestion_status_idx" ON "GuestCompanySuggestion"("status");

-- CreateIndex
CREATE INDEX "GuestCompanySuggestion_createdAt_idx" ON "GuestCompanySuggestion"("createdAt");
