import { currentSeller } from "@/lib/business-identity";

/**
 * What a unit of stock really cost us. Product.purchasePrice is stored ex-VAT
 * (suppliers' VAT-inclusive prices are divided by 1.21 on import), but a seller
 * that isn't a VAT payer can't reclaim the VAT it pays on purchases — for us
 * it is a real cost. Once the seller is a VAT payer (has a DIČ) the ex-VAT
 * figure is the right one again.
 */
export function purchaseCost(purchasePrice: number | { toString(): string }, vatRate: number): number {
  const net = Number(purchasePrice);
  return currentSeller().dic ? net : net * (1 + vatRate / 100);
}
