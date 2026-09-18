"use client";

import { useTransition } from "react";
import { updateOrderStatus } from "@/lib/admin/actions/orders";
import { ORDER_STATUS_LABELS } from "@/lib/orders/status-labels";
import type { OrderStatus } from "@prisma/client";

// Changing status here must never touch trackingNumber/weight — the action
// overwrites both from the submitted form (it has no "leave unchanged"
// option), so they're carried forward as hidden fields exactly as they were,
// the same way the full form on the order detail page does.
export function OrderStatusQuickSelect({
  orderId,
  status,
  trackingNumber,
  weight,
}: {
  orderId: string;
  status: OrderStatus;
  trackingNumber: string | null;
  weight: string;
}) {
  const [isPending, startTransition] = useTransition();
  const action = updateOrderStatus.bind(null, orderId);

  return (
    <form onChange={(e) => startTransition(() => action(new FormData(e.currentTarget)))}>
      <input type="hidden" name="trackingNumber" value={trackingNumber ?? ""} />
      <input type="hidden" name="weight" value={weight} />
      <select
        name="status"
        defaultValue={status}
        disabled={isPending}
        className="rounded-sm border border-line bg-white px-2 py-1 text-xs disabled:opacity-50"
      >
        {Object.entries(ORDER_STATUS_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
    </form>
  );
}
