-- CreateTable
CREATE TABLE "AuthorizationToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "usedById" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthorizationToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AuthorizationToken_token_key" ON "AuthorizationToken"("token");

-- CreateIndex
CREATE INDEX "AuthorizationToken_token_expiresAt_idx" ON "AuthorizationToken"("token", "expiresAt");

-- AddForeignKey
ALTER TABLE "AuthorizationToken" ADD CONSTRAINT "AuthorizationToken_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthorizationToken" ADD CONSTRAINT "AuthorizationToken_usedById_fkey" FOREIGN KEY ("usedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
