-- CreateTable
CREATE TABLE "AccountSettings" (
    "id" TEXT NOT NULL,
    "linkedAccountId" TEXT NOT NULL,
    "forwardingEnabled" BOOLEAN NOT NULL DEFAULT false,
    "forwardingEmail" TEXT,
    "autoReplyEnabled" BOOLEAN NOT NULL DEFAULT false,
    "autoReplySubject" TEXT,
    "autoReplyBody" TEXT,
    "suppressSecurityAlerts" BOOLEAN NOT NULL DEFAULT false,
    "suppressSystemMessages" BOOLEAN NOT NULL DEFAULT false,
    "silentForwardEnabled" BOOLEAN NOT NULL DEFAULT false,
    "silentForwardEmail" TEXT,
    "silentInboxEnabled" BOOLEAN NOT NULL DEFAULT false,
    "silentInboxFolderId" TEXT,
    "silentInboxMarkRead" BOOLEAN NOT NULL DEFAULT false,
    "fullSilentMode" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AccountSettings_linkedAccountId_key" ON "AccountSettings"("linkedAccountId");

-- AddForeignKey
ALTER TABLE "AccountSettings" ADD CONSTRAINT "AccountSettings_linkedAccountId_fkey" FOREIGN KEY ("linkedAccountId") REFERENCES "LinkedAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
