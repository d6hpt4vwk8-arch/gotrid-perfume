import { prisma } from "@/lib/prisma";
import { logAdminActivity } from "@/lib/admin/activity-log";
import { fetchNewIncomingPayments, type FioIncomingPayment } from "@/lib/payments/fio-bank";
import { formatPrice } from "@/lib/format";
import { EMAIL_FROM, OWNER_EMAIL, getResendClient, isEmailConfigured } from "@/lib/email/resend";

// Bank apps reading the SPAYD QR sometimes round the shown amount to the
// nearest whole crown (same quirk as Packeta's COD field, see
// src/lib/packeta.ts) — tolerate up to 1 Kč difference before treating a
// payment as a mismatch that needs a human look.
const AMOUNT_TOLERANCE_KC = 1;

/** Reverses buildSpaydPayload's variable symbol back into "GTyymmdd-xxxx" — see src/lib/payments/qr-platba.ts and src/lib/orders/generate-order-number.ts. */
function orderNumberFromVariableSymbol(vs: string): string | null {
  if (!/^\d{10}$/.test(vs)) return null;
  return `GT${vs.slice(0, 6)}-${vs.slice(6, 10)}`;
}

async function notifyOwnerOfReview(subject: string, html: string) {
  if (!isEmailConfigured()) {
    console.warn(`[fio-sync] Resend not configured — skipping owner alert: ${subject}`);
    return;
  }
  try {
    await getResendClient().emails.send({ from: EMAIL_FROM, to: OWNER_EMAIL, subject, html });
  } catch (err) {
    console.error("[fio-sync] failed to send owner alert email", err);
  }
}

export interface FioSyncResult {
  checked: number;
  confirmed: number;
  flaggedForReview: number;
}

/**
 * Auto-confirms BANK_TRANSFER orders once Fio banka shows the matching
 * incoming payment, so the owner no longer has to check internet banking by
 * hand — payments can arrive up to a day late, but once they land this
 * catches them on the next daily run. Anything that doesn't cleanly match
 * (wrong/missing VS, amount mismatch, payment for an order that isn't
 * pending) is left untouched and flagged instead of guessed at.
 */
export async function syncFioPayments(): Promise<FioSyncResult> {
  let payments: FioIncomingPayment[];
  try {
    payments = await fetchNewIncomingPayments();
  } catch (err) {
    console.error("[fio-sync] failed to fetch transactions", err);
    return { checked: 0, confirmed: 0, flaggedForReview: 0 };
  }

  let confirmed = 0;
  let flaggedForReview = 0;

  for (const payment of payments) {
    try {
      await processPayment(payment);
    } catch (err) {
      console.error(`[fio-sync] failed to process payment (VS ${payment.variableSymbol})`, err);
    }
  }

  async function processPayment(payment: FioIncomingPayment) {
    if (!payment.variableSymbol) return;
    const orderNumber = orderNumberFromVariableSymbol(payment.variableSymbol);
    // Not shaped like one of our order numbers at all — most incoming
    // payments to a business account aren't customer orders, so skip
    // quietly rather than flagging every unrelated transfer.
    if (!orderNumber) return;

    const order = await prisma.order.findUnique({ where: { number: orderNumber } });

    if (!order) {
      flaggedForReview++;
      await logAdminActivity({
        action: "order.fio_payment_unmatched",
        entityType: "Order",
        detail: `Platba ${formatPrice(payment.amount)} s VS ${payment.variableSymbol} (od ${payment.counterpartyName ?? "neznámý"}) neodpovídá žádné objednávce (${orderNumber} neexistuje).`,
      });
      await notifyOwnerOfReview(
        `Fio: nepřiřazená platba ${formatPrice(payment.amount)} (VS ${payment.variableSymbol})`,
        `<p>Došla platba <strong>${formatPrice(payment.amount)}</strong> od <strong>${payment.counterpartyName ?? "neznámý plátce"}</strong> s variabilním symbolem <strong>${payment.variableSymbol}</strong>, ale objednávka ${orderNumber} v systému neexistuje.</p><p>Zkontrolujte prosím ručně v internetovém bankovnictví.</p>`,
      );
      return;
    }

    if (order.paymentMethod !== "BANK_TRANSFER" || order.status !== "NEW") {
      flaggedForReview++;
      await logAdminActivity({
        action: "order.fio_payment_unexpected",
        entityType: "Order",
        entityId: order.id,
        detail: `${order.number}: přišla platba ${formatPrice(payment.amount)}, ale objednávka je "${order.paymentMethod}" / stav "${order.status}" (očekáváno BANK_TRANSFER / NEW) — možná duplicitní nebo pozdní platba.`,
      });
      await notifyOwnerOfReview(
        `Fio: neočekávaná platba k objednávce ${order.number}`,
        `<p>K objednávce <strong>${order.number}</strong> (platba: ${order.paymentMethod}, stav: ${order.status}) přišla platba <strong>${formatPrice(payment.amount)}</strong> od ${payment.counterpartyName ?? "neznámého plátce"}.</p><p>Zkontrolujte prosím ručně, zda jde o duplicitní nebo opožděnou platbu.</p>`,
      );
      return;
    }

    const expected = Number(order.total);
    const diff = Math.abs(expected - payment.amount);
    if (diff > AMOUNT_TOLERANCE_KC) {
      flaggedForReview++;
      await logAdminActivity({
        action: "order.fio_payment_amount_mismatch",
        entityType: "Order",
        entityId: order.id,
        detail: `${order.number}: očekávaná částka ${formatPrice(order.total)}, přišlo ${formatPrice(payment.amount)} od ${payment.counterpartyName ?? "neznámý"} (rozdíl ${formatPrice(diff)}).`,
      });
      await notifyOwnerOfReview(
        `Fio: nesedí částka u objednávky ${order.number}`,
        `<p>Objednávka <strong>${order.number}</strong> čeká na <strong>${formatPrice(order.total)}</strong>, ale přišla platba <strong>${formatPrice(payment.amount)}</strong> od ${payment.counterpartyName ?? "neznámého plátce"} (rozdíl ${formatPrice(diff)}).</p><p>Zkontrolujte prosím a označte objednávku ručně, pokud je platba v pořádku.</p>`,
      );
      return;
    }

    const claimed = await prisma.order.updateMany({
      where: { id: order.id, status: "NEW" },
      data: { status: "PAID" },
    });
    if (claimed.count === 0) return; // already confirmed by a concurrent/earlier run

    confirmed++;
    await logAdminActivity({
      action: "order.fio_payment_confirmed",
      entityType: "Order",
      entityId: order.id,
      detail: `${order.number}: platba ${formatPrice(payment.amount)} přijata na účet (od ${payment.counterpartyName ?? "neznámý"}), objednávka automaticky označena jako Zaplaceno.`,
    });
  }

  return { checked: payments.length, confirmed, flaggedForReview };
}
