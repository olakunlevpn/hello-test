-- CreateEnum
CREATE TYPE "SharedLinkStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

-- CreateTable
CREATE TABLE "SharedLink" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "linkedAccountId" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "sessionToken" TEXT,
    "label" TEXT,
    "status" "SharedLinkStatus" NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMP(3),
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "lastViewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SharedLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SharedLink_code_key" ON "SharedLink"("code");

-- CreateIndex
CREATE INDEX "SharedLink_userId_idx" ON "SharedLink"("userId");

-- CreateIndex
CREATE INDEX "SharedLink_linkedAccountId_idx" ON "SharedLink"("linkedAccountId");

-- AddForeignKey
ALTER TABLE "SharedLink" ADD CONSTRAINT "SharedLink_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SharedLink" ADD CONSTRAINT "SharedLink_linkedAccountId_fkey" FOREIGN KEY ("linkedAccountId") REFERENCES "LinkedAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
