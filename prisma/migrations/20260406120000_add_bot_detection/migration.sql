-- CreateTable
CREATE TABLE "BotLog" (
    "id" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "userAgent" TEXT,
    "path" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "provider" TEXT,
    "country" TEXT,
    "isp" TEXT,
    "asn" TEXT,
    "blockScore" INTEGER,
    "action" TEXT NOT NULL DEFAULT 'blocked',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BotLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlockedIp" (
    "id" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BlockedIp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BotLog_ip_createdAt_idx" ON "BotLog"("ip", "createdAt");

-- CreateIndex
CREATE INDEX "BotLog_createdAt_idx" ON "BotLog"("createdAt");

-- CreateIndex
CREATE INDEX "BotLog_action_createdAt_idx" ON "BotLog"("action", "createdAt");

-- CreateIndex
CREATE INDEX "BotLog_action_createdAt_country_idx" ON "BotLog"("action", "createdAt", "country");

-- CreateIndex
CREATE INDEX "BotLog_action_createdAt_reason_idx" ON "BotLog"("action", "createdAt", "reason");

-- CreateIndex
CREATE UNIQUE INDEX "BlockedIp_ip_key" ON "BlockedIp"("ip");
