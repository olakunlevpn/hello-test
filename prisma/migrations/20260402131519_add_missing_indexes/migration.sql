-- CreateIndex
CREATE INDEX "AutomationRule_linkedAccountId_isActive_idx" ON "AutomationRule"("linkedAccountId", "isActive");

-- CreateIndex
CREATE INDEX "LinkedAccount_webhookSubscriptionId_idx" ON "LinkedAccount"("webhookSubscriptionId");

-- CreateIndex
CREATE INDEX "Payment_userId_status_idx" ON "Payment"("userId", "status");
