import type { OrderStatus } from "@prisma/client";

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  NEW: "Nová",
  PAID: "Zaplacená",
  PROCESSING: "Zpracovává se",
  SHIPPED: "Odeslaná",
  DELIVERED: "Doručená",
  CANCELLED: "Zrušená",
  REFUNDED: "Vrácená",
};

// A real Faktura is a fiscal document — it shouldn't exist for a sale that
// hasn't actually happened yet. NEW covers an unpaid bank transfer and an
// unfulfilled cash-on-delivery pickup alike (nothing marks COD orders PAID
// automatically — a courier/in-person handover is what stands in for
// payment, which is why status only moves on from NEW once the order is
// actually being fulfilled). CANCELLED never becomes a real sale either.
export function canDownloadInvoice(status: OrderStatus): boolean {
  return status !== "NEW" && status !== "CANCELLED";
}
