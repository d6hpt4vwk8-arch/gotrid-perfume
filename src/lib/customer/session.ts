// Web Crypto (crypto.subtle) rather than node:crypto — mirrors src/lib/admin-auth.ts
// so the same helper style works if this ever needs to run on the Edge runtime.
import { prisma } from "@/lib/prisma";

export const CUSTOMER_COOKIE_NAME = "gotrid_customer_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function getSecret(): string {
  const secret = process.env.CUSTOMER_SESSION_SECRET;
  if (!secret) {
    throw new Error("CUSTOMER_SESSION_SECRET není nastaven.");
  }
  return secret;
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function sign(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(getSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return toHex(signature);
}

function constantTimeEqual(a: string, b: string): boolean {
  const bytesA = new TextEncoder().encode(a);
  const bytesB = new TextEncoder().encode(b);
  if (bytesA.length !== bytesB.length) return false;
  let diff = 0;
  for (let i = 0; i < bytesA.length; i++) diff |= bytesA[i] ^ bytesB[i];
  return diff === 0;
}

/** Caller must pass the customer's current sessionVersion (from the row it just read/wrote). */
export async function createCustomerSessionToken(
  customerId: string,
  sessionVersion: number,
): Promise<string> {
  const expires = Date.now() + SESSION_TTL_MS;
  const payload = `${customerId}.${sessionVersion}.${expires}`;
  return `${payload}.${await sign(payload)}`;
}

/**
 * Beyond signature + expiry, checks the token's sessionVersion against the
 * customer's current one in the DB — bumped on password reset, so a stolen
 * cookie stops working the moment the real owner resets their password
 * instead of staying valid until its 30-day expiry (security audit: sessions
 * couldn't be revoked).
 */
export async function verifyCustomerSessionToken(
  token: string | undefined | null,
): Promise<string | null> {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 4) return null;
  const [customerId, sessionVersionRaw, expiresRaw, signature] = parts;

  const payload = `${customerId}.${sessionVersionRaw}.${expiresRaw}`;
  const expected = await sign(payload);
  if (!constantTimeEqual(signature, expected)) return null;

  const expires = Number(expiresRaw);
  if (!Number.isFinite(expires) || Date.now() >= expires) return null;

  const tokenSessionVersion = Number(sessionVersionRaw);
  if (!Number.isFinite(tokenSessionVersion)) return null;

  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { sessionVersion: true },
  });
  if (!customer || customer.sessionVersion !== tokenSessionVersion) return null;

  return customerId;
}
