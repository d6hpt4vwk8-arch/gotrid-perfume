ALTER TABLE "Product" ADD COLUMN "salesCount" INTEGER NOT NULL DEFAULT 0;

UPDATE "Product" p
SET "salesCount" = COALESCE(oi.qty_sum, 0)
FROM (
  SELECT "productId", SUM(qty) AS qty_sum
  FROM "OrderItem"
  WHERE "productId" IS NOT NULL
  GROUP BY "productId"
) oi
WHERE p.id = oi."productId";
