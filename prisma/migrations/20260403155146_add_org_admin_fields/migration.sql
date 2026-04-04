-- AlterTable
ALTER TABLE "LinkedAccount" ADD COLUMN     "isOrgAdmin" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "orgRoles" TEXT[] DEFAULT ARRAY[]::TEXT[];
