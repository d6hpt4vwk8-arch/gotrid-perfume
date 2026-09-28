-- Standalone: Postgres can't use a new enum value in the same transaction
-- it was added in (same precedent as 20260908140000_add_gls_misto_shipping_method).
ALTER TYPE "ShippingMethod" ADD VALUE 'ZASILKOVNA_HD';
