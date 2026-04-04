/*
  Warnings:

  - You are about to drop the column `action` on the `AutomationRule` table. All the data in the column will be lost.
  - You are about to drop the column `keyword` on the `AutomationRule` table. All the data in the column will be lost.
  - You are about to drop the column `ruleType` on the `AutomationRule` table. All the data in the column will be lost.
  - Added the required column `updatedAt` to the `AutomationRule` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "AutomationRule" DROP COLUMN "action",
DROP COLUMN "keyword",
DROP COLUMN "ruleType",
ADD COLUMN     "actions" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "conditionLogic" TEXT NOT NULL DEFAULT 'AND',
ADD COLUMN     "conditions" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "name" TEXT NOT NULL DEFAULT 'Untitled Rule',
ADD COLUMN     "priority" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "stopProcessing" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- DropEnum
DROP TYPE "RuleType";

-- CreateIndex
CREATE INDEX "AutomationRule_linkedAccountId_priority_idx" ON "AutomationRule"("linkedAccountId", "priority");
