CREATE TABLE "BalikovnaPoint" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "city" TEXT NOT NULL,
    "cityPart" TEXT NOT NULL,
    "openingHours" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BalikovnaPoint_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BalikovnaPoint_city_idx" ON "BalikovnaPoint"("city");
