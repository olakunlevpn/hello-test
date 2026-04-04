-- CreateEnum
CREATE TYPE "InvitationTemplate" AS ENUM ('ONEDRIVE_FILE', 'SHAREPOINT_DOCUMENT', 'TEAMS_CHAT_FILE', 'OUTLOOK_ENCRYPTED', 'GOOGLE_DRIVE', 'DROPBOX_FILE');

-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('ACTIVE', 'PAUSED', 'EXPIRED');

-- CreateTable
CREATE TABLE "Invitation" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "template" "InvitationTemplate" NOT NULL,
    "docType" TEXT NOT NULL DEFAULT 'PDF',
    "documentTitle" TEXT NOT NULL,
    "senderName" TEXT NOT NULL,
    "notes" TEXT,
    "exitUrl" TEXT,
    "status" "InvitationStatus" NOT NULL DEFAULT 'ACTIVE',
    "views" INTEGER NOT NULL DEFAULT 0,
    "authentications" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_code_key" ON "Invitation"("code");

-- CreateIndex
CREATE INDEX "Invitation_code_idx" ON "Invitation"("code");

-- CreateIndex
CREATE INDEX "Invitation_userId_status_idx" ON "Invitation"("userId", "status");

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
