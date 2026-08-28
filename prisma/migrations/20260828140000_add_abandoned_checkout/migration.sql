-- CreateTable
CREATE TABLE "AbandonedCheckout" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "firstName" TEXT,
    "phone" TEXT,
    "cartSnapshot" JSONB NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "emailSentAt" TIMESTAMP(3),
    "recoveredAt" TIMESTAMP(3),

    CONSTRAINT "AbandonedCheckout_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AbandonedCheckout_email_key" ON "AbandonedCheckout"("email");
