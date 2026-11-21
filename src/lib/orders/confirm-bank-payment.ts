import { prisma } from "@/lib/prisma";
import { logAdminActivity } from "@/lib/admin/activity-log";
import { formatEurAmount, formatPrice } from "@/lib/format";
import { EMAIL_FROM, OWNER_EMAIL, getResendClient, isEmailConfigured } from "@/lib/email/resend";
import { sendHeurekaOrderLog } from "@/lib/analytics/heureka-overeno";
import { awardPointsForOrder } from "@/lib/loyalty";
import { orderNumberFromPayment, type BankPayment } from "@/lib/payments/airbank-email";

// Bank apps reading the SPAYD QR sometimes round the shown amount to whole crowns (same quirk as Packeta's COD field),
// so 1 Kč of difference is still "paid in full". EUR payments get 5 cents for the same reason.
const TOLERANCE_CZK = 1;
const TOLERANCE_EUR = 0.05;

export type BankPaymentOutcome =
  | "confirmed" // NEW → PAID
  | "seen-already-paid" // order was already marked paid by hand — just recorded
  | "ignored" // not a customer order payment (debit, Comgate payout, unrelated transfer)
  | "flagged"; // needs a human look, owner e-mailed

export interface BankPaymentResult {
  outcome: BankPaymentOutcome;
  orderNumber?: string;
  detail: string;
}

/** Every log row for a payment carries this token, so the same notification is never processed twice. */
export function paymentToken(code: string): string {
  return `[tx:${code}]`;
}

function money(p: BankPayment): string {
  return p.currency === "EUR" ? formatEurAmount(p.amount) : formatPrice(p.amount);
}

async function notifyOwner(subject: string, html: string): Promise<void> {
  if (!isEmailConfigured()) {
    console.warn(`[bank-payments] Resend not configured — skipping owner alert: ${subject}`);
    return;
  }
  try {
    await getResendClient().emails.send({ from: EMAIL_FROM, to: OWNER_EMAIL, subject, html });
  } catch (err) {
    console.error("[bank-payments] failed to send owner alert", err);
  }
}

/**
 * Matches one incoming bank payment (parsed from an Air Bank notification) with its order and, when everything lines up,
 * marks the BANK_TRANSFER order PAID — the same follow-ups as the admin's manual "Zaplaceno" (Heureka survey, loyalty
 * points). Anything that does not match cleanly (wrong amount, wrong status, unknown order, second payment) is left
 * untouched and e-mailed to the owner instead of guessed at. `dryRun` changes nothing and sends nothing.
 */
export async function processBankPayment(p: BankPayment, opts: { dryRun?: boolean } = {}): Promise<BankPaymentResult> {
  const dry = opts.dryRun === true;
  const token = p.transactionCode ? paymentToken(p.transactionCode) : "[tx:none]";
  const payer = p.counterpartyName ?? "neznámý plátce";

  if (p.direction !== "credit") return { outcome: "ignored", detail: "odchozí platba" };
  // Comgate settles card payments to this account with a 10-digit VS that can look like an order number — never an order.
  if (/comgate/i.test(p.counterpartyName ?? "")) return { outcome: "ignored", detail: "výplata z Comgate" };

  const resolved = orderNumberFromPayment(p);
  if (!resolved) return { outcome: "ignored", detail: `platba ${money(p)} od ${payer} bez čísla objednávky` };
  const orderNumber: string = resolved;

  const order = await prisma.order.findUnique({ where: { number: orderNumber }, include: { items: true } });

  async function flag(action: string, subject: string, html: string, entityId?: string): Promise<BankPaymentResult> {
    const detail = `${orderNumber}: ${subject} ${token}`;
    if (!dry) {
      await logAdminActivity({ action, entityType: "Order", entityId, detail });
      await notifyOwner(`Banka: ${subject}`, `${html}<p style="color:#8a857e;font-size:12px">Kód transakce ${p.transactionCode ?? "—"}, zpráva „${p.message || "—"}“.</p>`);
    }
    return { outcome: "flagged", orderNumber, detail: subject };
  }

  if (!order) {
    return flag(
      "order.bank_payment_unmatched",
      `nepřiřazená platba ${money(p)} (${orderNumber})`,
      `<p>Došla platba <strong>${money(p)}</strong> od <strong>${payer}</strong>, která odkazuje na objednávku <strong>${orderNumber}</strong>, ale ta v systému neexistuje.</p><p>Zkontrolujte ji prosím ručně v internetovém bankovnictví.</p>`,
    );
  }

  const alreadyRecorded = await prisma.adminActivityLog.findFirst({
    where: { entityId: order.id, action: { in: ["order.bank_payment_confirmed", "order.bank_payment_seen"] } },
    select: { id: true },
  });

  if (order.paymentMethod !== "BANK_TRANSFER") {
    return flag(
      "order.bank_payment_unexpected",
      `platba ${money(p)} k objednávce ${order.number} s jinou platební metodou`,
      `<p>K objednávce <strong>${order.number}</strong> (platba: ${order.paymentMethod}, stav: ${order.status}) přišla bankovní platba <strong>${money(p)}</strong> od ${payer}.</p><p>Zkontrolujte prosím, zda nejde o omyl nebo duplicitu.</p>`,
      order.id,
    );
  }

  // Amount in the currency the customer was told to pay: EUR for Slovak orders, CZK otherwise.
  const eurOrder = order.chargedCurrency === "EUR" && order.chargedAmount !== null;
  const expectedCurrency = eurOrder ? "EUR" : "CZK";
  const expected = eurOrder ? Number(order.chargedAmount) : Number(order.total);
  const tolerance = eurOrder ? TOLERANCE_EUR : TOLERANCE_CZK;

  if (order.status !== "NEW") {
    // Marked PAID (or shipped) by hand before the bank mail arrived: nothing to do, just remember we saw the payment.
    if (!alreadyRecorded && p.currency === expectedCurrency && Math.abs(expected - p.amount) <= tolerance) {
      const detail = `${order.number}: platba ${money(p)} od ${payer} odpovídá objednávce, ta už byla označena jako "${order.status}" ručně ${token}`;
      if (!dry) await logAdminActivity({ action: "order.bank_payment_seen", entityType: "Order", entityId: order.id, detail });
      return { outcome: "seen-already-paid", orderNumber, detail };
    }
    return flag(
      "order.bank_payment_unexpected",
      `další/neočekávaná platba ${money(p)} k objednávce ${order.number} (stav ${order.status})`,
      `<p>K objednávce <strong>${order.number}</strong> (stav: ${order.status}) přišla platba <strong>${money(p)}</strong> od ${payer}, ačkoliv už byla zaplacena nebo zrušena.</p><p>Zkontrolujte prosím, zda nejde o duplicitní nebo pozdní platbu (případně vraťte peníze).</p>`,
      order.id,
    );
  }

  if (p.currency !== expectedCurrency) {
    return flag(
      "order.bank_payment_amount_mismatch",
      `měna platby ${p.currency} neodpovídá objednávce ${order.number} (${expectedCurrency})`,
      `<p>Objednávka <strong>${order.number}</strong> čeká na <strong>${expectedCurrency === "EUR" ? formatEurAmount(expected) : formatPrice(expected)}</strong>, ale přišlo <strong>${money(p)}</strong> od ${payer}.</p><p>Zkontrolujte prosím a případně objednávku označte ručně.</p>`,
      order.id,
    );
  }

  const diff = Math.abs(expected - p.amount);
  if (diff > tolerance) {
    return flag(
      "order.bank_payment_amount_mismatch",
      `nesedí částka u objednávky ${order.number} (čeká ${expectedCurrency === "EUR" ? formatEurAmount(expected) : formatPrice(expected)}, přišlo ${money(p)})`,
      `<p>Objednávka <strong>${order.number}</strong> čeká na <strong>${expectedCurrency === "EUR" ? formatEurAmount(expected) : formatPrice(expected)}</strong>, ale přišla platba <strong>${money(p)}</strong> od ${payer} (rozdíl ${expectedCurrency === "EUR" ? formatEurAmount(diff) : formatPrice(diff)}).</p><p>Zkontrolujte prosím a označte objednávku ručně, pokud je platba v pořádku.</p>`,
      order.id,
    );
  }

  const detail = `${order.number}: platba ${money(p)} přijata na účet (od ${payer}), objednávka automaticky označena jako Zaplaceno ${token}`;
  if (dry) return { outcome: "confirmed", orderNumber, detail };

  const claimed = await prisma.order.updateMany({ where: { id: order.id, status: "NEW" }, data: { status: "PAID" } });
  if (claimed.count === 0) return { outcome: "seen-already-paid", orderNumber, detail: "objednávku mezitím potvrdil někdo jiný" };

  await logAdminActivity({ action: "order.bank_payment_confirmed", entityType: "Order", entityId: order.id, detail });
  await logAdminActivity({ action: "order.status_change", entityType: "Order", entityId: order.id, detail: `${order.number}: NEW → PAID (banka)` });

  // Same follow-ups as the admin's manual NEW → PAID for a non-card order (see updateOrderStatus).
  void sendHeurekaOrderLog({
    orderId: order.number,
    email: order.email,
    country: order.shippingCountry,
    items: order.items.map((i) => ({ productId: i.productId, name: i.name, ean: i.ean, qty: i.qty, unitPrice: Number(i.unitPrice) })),
  }).catch((err) => console.error(`[heureka-overeno] failed for ${order.number}`, err));
  void awardPointsForOrder(order.id).catch((err) => console.error(`[loyalty] award failed for ${order.number}`, err));

  return { outcome: "confirmed", orderNumber, detail };
}
