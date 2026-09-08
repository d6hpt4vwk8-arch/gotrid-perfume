CREATE TABLE "PriceCompetitionImport" (
    "id" TEXT NOT NULL,
    "periodLabel" TEXT,
    "rowCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceCompetitionImport_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PriceCompetitionRow" (
    "id" TEXT NOT NULL,
    "importId" TEXT NOT NULL,
    "productCode" TEXT NOT NULL,
    "offerName" TEXT NOT NULL,
    "impressionsByPrice" INTEGER NOT NULL,
    "avgPositionByPrice" DECIMAL(6,2),
    "impressionsRecommended" INTEGER NOT NULL,
    "avgPositionRecommended" DECIMAL(6,2),
    "clicksTotal" INTEGER NOT NULL,

    CONSTRAINT "PriceCompetitionRow_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PriceCompetitionRow_importId_idx" ON "PriceCompetitionRow"("importId");

CREATE INDEX "PriceCompetitionRow_productCode_idx" ON "PriceCompetitionRow"("productCode");

ALTER TABLE "PriceCompetitionRow" ADD CONSTRAINT "PriceCompetitionRow_importId_fkey" FOREIGN KEY ("importId") REFERENCES "PriceCompetitionImport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
