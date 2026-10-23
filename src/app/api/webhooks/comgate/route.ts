import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getComgateStatus, isValidComgateSecret } from "@/lib/payments/comgate";
import { cancelUnpaidOrder, markOrderPaid } from "@/lib/payments/order-payment-effects";

// Comgate "předání výsledku platby na pozadí": a form-encoded POST (merchant, test, price, curr, label, refId,
// transId, secret, status, …) to the URL set in the client portal. We trust the secret it carries AND re-read
// the payment from Comgate's status API, so a forged request can never mark an order paid. Always answer
// `code=0&message=OK` for a payment we handled (or ignore on purpose) — any other body makes Comgate retry.
const OK = () => new NextResponse("code=0&message=OK", { status: 200, headers: { "Content-Type": "application/x-www-form-urlencoded" } });
const FAIL = (message: string, status = 400) =>
  new NextResponse(`code=1&message=${encodeURIComponent(message)}`, { status, headers: { "Content-Type": "application/x-www-form-urlencoded" } });

export async function POST(req: NextRequest) {
  const raw = await req.text();
  // Documented as form-encoded, but accept JSON too so a format surprise can't silently drop a paid order.
  let form: URLSearchParams;
  try {
    const json = raw.trim().startsWith("{") ? (JSON.parse(raw) as Record<string, unknown>) : null;
    form = json ? new URLSearchParams(Object.entries(json).map(([k, v]) => [k, String(v)])) : new URLSearchParams(raw);
  } catch {
    form = new URLSearchParams(raw);
  }
  const transId = form.get("transId");
  const secretOk = isValidComgateSecret(form.get("secret"));
  const merchantOk = form.get("merchant") === process.env.COMGATE_MERCHANT;
  if (!secretOk || !merchantOk || !transId) {
    // Field names and which check failed only — never the secret itself.
    console.error(
      `[comgate webhook] rejected: secret ${secretOk ? "ok" : "bad"}, merchant ${merchantOk ? "ok" : `bad (${form.get("merchant")})`}, transId ${transId ? "present" : "missing"}, content-type ${req.headers.get("content-type")}, fields: ${[...form.keys()].join(",")}`,
    );
    return FAIL("invalid request", 403);
  }

  const order = await prisma.order.findUnique({
    where: { comgateTransId: transId },
    select: { id: true, number: true, total: true, chargedAmount: true, chargedCurrency: true },
  });
  if (!order) {
    // Not one of ours (or created while testing elsewhere) — acknowledge so Comgate stops retrying.
    console.warn(`[comgate webhook] unknown transId ${transId} (refId ${form.get("refId")})`);
    return OK();
  }

  let state;
  try {
    state = await getComgateStatus(transId);
  } catch (err) {
    console.error(`[comgate webhook] status check failed for ${order.number}`, err);
    return FAIL("status unavailable", 503); // transient — let Comgate retry
  }
  if (state.refId !== order.number) {
    console.error(`[comgate webhook] refId mismatch for ${order.number}: ${state.refId}`);
    return FAIL("refId mismatch", 409);
  }

  if (state.status === "PAID") {
    const expectedCents = Math.round(Number(order.chargedAmount ?? order.total) * 100);
    const expectedCurr = order.chargedCurrency ?? "CZK";
    if (state.price !== expectedCents || state.curr !== expectedCurr) {
      // Paid amount differs from the order — never auto-confirm, leave it for the owner to look at.
      console.error(`[comgate webhook] amount mismatch for ${order.number}: ${state.price} ${state.curr} vs ${expectedCents} ${expectedCurr}`);
      return FAIL("amount mismatch", 409);
    }
    await markOrderPaid(order.id);
  } else if (state.status === "CANCELLED") {
    await cancelUnpaidOrder(order.id);
  }
  // PENDING / AUTHORIZED: nothing to do yet — the final status arrives in another push.
  return OK();
}
