import { timingSafeEqual } from "node:crypto";

// Comgate payment gateway (REST API 2.0, https://apidoc.comgate.cz/api/rest/). Replaces Stripe for card and
// online-bank payments: the payment is created server-side with the merchant id + secret (HTTP Basic), the
// customer is redirected to the returned URL, and Comgate reports the result back to /api/webhooks/comgate.
// Env: COMGATE_MERCHANT (portal → Platební brány → Propojení obchodu), COMGATE_SECRET, COMGATE_TEST=true while testing.

const API = "https://payments.comgate.cz/v2.0";

export function isComgateConfigured(): boolean {
  return Boolean(process.env.COMGATE_MERCHANT && process.env.COMGATE_SECRET);
}

export function isComgateTestMode(): boolean {
  return process.env.COMGATE_TEST === "true";
}

/**
 * Which gateway a card order should use. While COMGATE_TEST=true the live shop must not send real customers to a
 * test gateway (their orders would end up "paid" without any money), so only the e-mails listed in
 * COMGATE_TEST_EMAILS (comma separated, the owner's) go through Comgate; everyone else keeps using Stripe.
 */
export function shouldUseComgate(customerEmail: string): boolean {
  if (!isComgateConfigured()) return false;
  if (!isComgateTestMode()) return true;
  const allowed = (process.env.COMGATE_TEST_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(customerEmail.trim().toLowerCase());
}

function authHeader(): string {
  const merchant = process.env.COMGATE_MERCHANT;
  const secret = process.env.COMGATE_SECRET;
  if (!merchant || !secret) {
    throw new Error("COMGATE_MERCHANT / COMGATE_SECRET nejsou nastaveny — platba kartou zatím není dostupná.");
  }
  return `Basic ${Buffer.from(`${merchant}:${secret}`).toString("base64")}`;
}

export interface ComgatePayment {
  transId: string;
  redirect: string;
}

export interface CreateComgatePaymentInput {
  orderNumber: string;
  /** Major units in `currency` (CZK or EUR), converted to cents/haléře here. */
  amount: number;
  currency: "CZK" | "EUR";
  email: string;
  phone?: string | null;
  fullName: string;
  country: "CZ" | "SK";
  lang: "cs" | "sk";
  urlPaid: string;
  urlCancelled: string;
  urlPending: string;
}

/** E.164 only — Comgate rejects free-form numbers, and email alone is enough for the payer. */
function normalizePhone(phone?: string | null): string | undefined {
  if (!phone) return undefined;
  const cleaned = phone.replace(/[\s()-]/g, "");
  return /^\+\d{8,15}$/.test(cleaned) ? cleaned : undefined;
}

export async function createComgatePayment(input: CreateComgatePaymentInput): Promise<ComgatePayment> {
  const body = {
    test: isComgateTestMode(),
    country: input.country,
    price: Math.round(input.amount * 100),
    curr: input.currency,
    // 1–16 characters, shown in the portal: our order number (GT261023-1234 = 13 chars).
    label: input.orderNumber.slice(0, 16),
    refId: input.orderNumber,
    // The payer picks (card, Apple/Google Pay, bank buttons) on Comgate's page — whatever is enabled for the shop.
    method: "ALL",
    email: input.email,
    phone: normalizePhone(input.phone),
    fullName: input.fullName,
    category: "PHYSICAL_GOODS_ONLY",
    lang: input.lang,
    // Same lifetime as the old Stripe checkout: an abandoned payment is cancelled (webhook → stock released) after 2 h.
    expirationTime: "2h",
    url_paid: input.urlPaid,
    url_cancelled: input.urlCancelled,
    url_pending: input.urlPending,
  };

  const res = await fetch(`${API}/payment.json`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: authHeader() },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => null)) as { code?: number; message?: string; transId?: string; redirect?: string } | null;
  if (!res.ok || !data || data.code !== 0 || !data.transId || !data.redirect) {
    throw new Error(`Comgate create payment failed (${res.status}): ${data ? `${data.code} ${data.message}` : "no body"}`);
  }
  return { transId: data.transId, redirect: data.redirect };
}

export interface ComgateStatus {
  status: "PENDING" | "PAID" | "CANCELLED" | "AUTHORIZED";
  price: number; // cents/haléře
  curr: string;
  refId: string;
  test: boolean;
}

/** Asks Comgate for the payment's real state — used to confirm a webhook before it changes an order. */
export async function getComgateStatus(transId: string): Promise<ComgateStatus> {
  const res = await fetch(`${API}/payment/transId/${encodeURIComponent(transId)}.json`, {
    headers: { Accept: "application/json", Authorization: authHeader() },
  });
  const data = (await res.json().catch(() => null)) as
    | { code?: number; message?: string; status?: string; price?: string | number; curr?: string; refId?: string; test?: string | boolean }
    | null;
  if (!res.ok || !data || data.code !== 0 || !data.status) {
    throw new Error(`Comgate status failed (${res.status}): ${data ? `${data.code} ${data.message}` : "no body"}`);
  }
  return {
    status: data.status as ComgateStatus["status"],
    price: Number(data.price),
    curr: String(data.curr ?? ""),
    refId: String(data.refId ?? ""),
    test: data.test === true || data.test === "true",
  };
}

/** Constant-time comparison of the shared secret Comgate echoes back in its webhook. */
export function isValidComgateSecret(candidate: string | null | undefined): boolean {
  const secret = process.env.COMGATE_SECRET;
  if (!secret || !candidate) return false;
  const a = Buffer.from(candidate);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}
