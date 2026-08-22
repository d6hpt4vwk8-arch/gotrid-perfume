// Web Crypto (not node:crypto) so this stays importable from Edge-adjacent
// code without extra config — same approach as src/lib/admin-auth.ts.

import { prisma } from "@/lib/prisma";
import { SITE_URL } from "@/lib/site";

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

/** Every marketing email must link here (zákon č. 480/2004 Sb. §7/3 requires a free, simple opt-out). */
export async function buildUnsubscribeUrl(email: string): Promise<string> {
  const normalized = email.trim().toLowerCase();
  const sig = await sign(normalized);
  return `${SITE_URL}/api/newsletter/unsubscribe?email=${encodeURIComponent(normalized)}&sig=${sig}`;
}

export async function verifyUnsubscribeSignature(email: string, sig: string): Promise<boolean> {
  const expected = await sign(email.trim().toLowerCase());
  return constantTimeEqual(sig, expected);
}

/**
 * The actual gate for every marketing send is Customer.marketingOptIn, so
 * unsubscribing must flip that (not just record intent) — NewsletterUnsubscribe
 * is kept alongside as a timestamped log for the admin, not as the source of
 * truth. Case-insensitive since Customer.email is stored lowercased at
 * registration but this is defense-in-depth either way.
 */
export async function recordUnsubscribe(email: string): Promise<void> {
  const normalized = email.trim().toLowerCase();
  await prisma.newsletterUnsubscribe.upsert({
    where: { email: normalized },
    update: {},
    create: { email: normalized },
  });
  await prisma.customer.updateMany({
    where: { email: normalized },
    data: { marketingOptIn: false },
  });
}
