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
