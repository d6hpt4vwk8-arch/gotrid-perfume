-- CreateTable
CREATE TABLE "RecommendationEvent" (
    "id" TEXT NOT NULL,
    "block" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "productId" TEXT,
    "sourceProductId" TEXT,
    "locale" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecommendationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RecommendationEvent_block_event_createdAt_idx" ON "RecommendationEvent"("block", "event", "createdAt");

-- CreateIndex
CREATE INDEX "RecommendationEvent_createdAt_idx" ON "RecommendationEvent"("createdAt");
