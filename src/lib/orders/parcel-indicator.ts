import type { OrderStatus, PaymentMethod, ShippingMethod } from "@prisma/client";
import { estimateDeliveryDate } from "@/lib/delivery-estimate";

/**
 * Parcel indicator for the admin order list: "who holds the parcel right now, and do I have to do something?"
 *
 *  - holder  = who has the ball: me (pack / hand over), the carrier (on its way), the customer (waiting at a pickup
 *              point or for a personal pickup) or nobody (closed: delivered / returned / cancelled);
 *  - urgent  = the red flag: something is late or about to expire and needs my attention now.
 *
 * Derived only from what is in the database (order status, label/tracking present, the delivery date promised on the
 * site), so it needs no carrier API call. Carrier scans (GLS "not collected", "waiting in the box until…") are a later
 * step — see `carrierHint` in the callers once those fields exist.
 */
export type ParcelHolder = "me" | "carrier" | "customer" | "closed";
export type ParcelTone = "red" | "amber" | "slate" | "green" | "muted";

export interface ParcelIndicator {
  holder: ParcelHolder;
  tone: ParcelTone;
  icon: string;
  label: string;
  hint: string;
  urgent: boolean;
}

export interface ParcelIndicatorInput {
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  shippingMethod: ShippingMethod;
  createdAt: Date;
  trackingNumber: string | null;
  glsParcelNumber: string | null;
  packetaId: string | null;
  balikovnaParcelCode: string | null;
}

export const PARCEL_HOLDER_LABELS: Record<Exclude<ParcelHolder, "closed">, string> = {
  me: "U mě",
  carrier: "U dopravce",
  customer: "U zákazníka",
};

const DAY_MS = 86_400_000;

/** End of the day on which the delivery date shown to the customer falls. */
function promisedDeadline(createdAt: Date): Date {
  const promised = estimateDeliveryDate(3, createdAt);
  promised.setHours(23, 59, 59, 999);
  return promised;
}

function daysText(days: number): string {
  return days <= 0 ? "dnes" : days === 1 ? "1 den" : days < 5 ? `${days} dny` : `${days} dní`;
}

export function getParcelIndicator(o: ParcelIndicatorInput, now: Date = new Date()): ParcelIndicator | null {
  const days = Math.floor((now.getTime() - o.createdAt.getTime()) / DAY_MS);
  const ageText = daysText(days);

  if (o.status === "CANCELLED") {
    return { holder: "closed", tone: "muted", icon: "✕", label: "Zrušeno", hint: "Objednávka je zrušená.", urgent: false };
  }
  // A card order that has not been paid yet is not a parcel to chase (the order list already flags it).
  if (o.status === "NEW" && o.paymentMethod === "CARD") return null;

  if (o.status === "REFUNDED") {
    return { holder: "closed", tone: "muted", icon: "↩", label: "Vráceno", hint: "Zásilka se vrátila (nevyzvednuto) nebo byla vrácena platba.", urgent: false };
  }
  if (o.status === "DELIVERED") {
    return { holder: "closed", tone: "green", icon: "✅", label: "Doručeno", hint: "Doručeno / vyzvednuto.", urgent: false };
  }

  const age = now.getTime() - o.createdAt.getTime();
  const overdue = now.getTime() > promisedDeadline(o.createdAt).getTime();

  if (o.shippingMethod === "OSOBNI_ODBER") {
    if (age > 30 * DAY_MS) {
      return { holder: "closed", tone: "muted", icon: "🏠", label: "Starý osobní odběr", hint: "Osobní odběr starší než 30 dní — uzavřít (Doručeno / Zrušeno).", urgent: false };
    }
    if (age > 10 * DAY_MS) {
      return { holder: "customer", tone: "red", icon: "🏠", label: `Nevyzvednuto · ${ageText}`, hint: "Osobní odběr čeká déle než 10 dní — napsat zákazníkovi.", urgent: true };
    }
    return { holder: "customer", tone: "slate", icon: "🏠", label: `Čeká na vyzvednutí · ${ageText}`, hint: "Osobní odběr čeká na zákazníka. Po vyzvednutí nastavit Doručeno.", urgent: false };
  }

  const hasLabel = Boolean(o.trackingNumber || o.glsParcelNumber || o.packetaId || o.balikovnaParcelCode);
  const isGls = o.shippingMethod === "GLS" || o.shippingMethod === "GLS_MISTO";

  if (o.status === "SHIPPED") {
    // Only GLS parcels are synced to Doručeno / Vráceno automatically (daily cron). For the others a long-shipped
    // order simply means nobody closed it — a reminder, never an alarm.
    if (age > 30 * DAY_MS) {
      return {
        holder: "carrier", tone: "slate", icon: "🚚", label: "Odesláno 30+ dní",
        hint: isGls
          ? "Starší než 30 dní a GLS stav nepotvrdil — zkontrolovat v MyGLS a uzavřít ručně."
          : "U tohoto dopravce se doručení nesleduje automaticky — nastavit Doručeno nebo Vráceno ručně.",
        urgent: false,
      };
    }
    const daysLate = (now.getTime() - promisedDeadline(o.createdAt).getTime()) / DAY_MS;
    if (isGls && daysLate > 7) {
      return { holder: "carrier", tone: "red", icon: "🚚", label: `Dlouho na cestě · ${ageText}`, hint: "Odesláno, ale přes týden po slíbeném termínu — zkontrolovat u GLS.", urgent: true };
    }
    if (overdue) {
      return { holder: "carrier", tone: "amber", icon: "🚚", label: `Na cestě, po termínu · ${ageText}`, hint: "Odesláno, ale slíbený termín doručení už uplynul.", urgent: false };
    }
    return { holder: "carrier", tone: "slate", icon: "🚚", label: `Na cestě · ${ageText}`, hint: "Odesláno dopravci.", urgent: false };
  }

  // NEW (COD / bank transfer), PAID, PROCESSING — the parcel is still with me.
  if (hasLabel) {
    // The order status is not always moved to Odesláno after the parcel is handed over, so a label alone cannot prove the
    // carrier never took it — amber ("verify"), not red, until the carrier's own scans are stored.
    return {
      holder: "me", tone: "amber", icon: "🏷",
      label: overdue ? `Ověřit odeslání · ${ageText}` : `Předat dopravci · ${ageText}`,
      hint: overdue
        ? "Štítek je vytvořený, objednávka není označená jako odeslaná a termín už uplynul — ověřit u dopravce, zda zásilku převzal, a označit jako odeslanou."
        : "Štítek je vytvořený — zásilku předat dopravci a označit jako odeslanou.",
      urgent: false,
    };
  }
  return {
    holder: "me", tone: overdue ? "red" : "amber", icon: "📦",
    label: `Zabalit · ${ageText}`,
    hint: overdue
      ? "Slíbený termín uplynul a zásilka nemá štítek — vyřídit hned a případně napsat zákazníkovi."
      : "Zatím bez štítku — zabalit a vytvořit štítek.",
    urgent: overdue,
  };
}
