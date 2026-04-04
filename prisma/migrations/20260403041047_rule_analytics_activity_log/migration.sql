-- AlterTable
ALTER TABLE "AutomationRule" ADD COLUMN     "lastTriggeredAt" TIMESTAMP(3),
ADD COLUMN     "triggerCount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL,
    "linkedAccountId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "details" TEXT,
    "emailSubject" TEXT,
    "emailFrom" TEXT,
    "ruleName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ActivityLog_linkedAccountId_createdAt_idx" ON "ActivityLog"("linkedAccountId", "createdAt");

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_linkedAccountId_fkey" FOREIGN KEY ("linkedAccountId") REFERENCES "LinkedAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
