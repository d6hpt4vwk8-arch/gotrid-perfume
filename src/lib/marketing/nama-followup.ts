import { randomInt } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { logAdminActivity } from "@/lib/admin/activity-log";
import { buildUnsubscribeUrl } from "./unsubscribe";
import { isEmailConfigured } from "@/lib/email/resend";
import { sendNamaFollowupEmail } from "@/lib/email/send-nama-followup-email";

// Follow-up for people who got the free Nama Fiji Discovery Box (GIFT-NAMA-FIJI) with an order (owner, 2026-11-14):
// some days after the parcel was delivered they get ONE personal code, 10 % on the whole Nama Fiji range, valid 14
// days, single use. The NAMA- prefix makes the checkout apply the percentage to Nama Fiji lines only (coupons.ts).
// Sends only when NAMA_FOLLOWUP_ENABLED=true; otherwise the daily cron just counts who would get it.
export const NAMA_FOLLOWUP_ACTION = "marketing.nama_followup";
export const NAMA_GIFT_CODE = "GIFT-NAMA-FIJI";
const DISCOUNT_PERCENT = 10;
const VALID_DAYS = 14;
// Wait after delivery so they have tried the six sachets.
const DAYS_AFTER_DELIVERY = 7;
const MAX_AGE_DAYS = 90;
const CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

export interface NamaFollowupCandidate {
  orderId: string;
  email: string;
  firstName: string;
  country: string;
}

function newCode(): string {
  let c = "NAMA-";
  for (let i = 0; i < 6; i++) c += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return c;
}

export async function getNamaFollowupCandidates(now: Date = new Date()): Promise<NamaFollowupCandidate[]> {
  const orders = await prisma.order.findMany({
    where: {
      status: "DELIVERED",
      deliveredAt: { lte: new Date(now.getTime() - DAYS_AFTER_DELIVERY * 86_400_000), gte: new Date(now.getTime() - MAX_AGE_DAYS * 86_400_000) },
      items: { some: { isGift: true, product: { code: NAMA_GIFT_CODE } } },
    },
    select: { id: true, email: true, firstName: true, shippingCountry: true },
  });
  if (orders.length === 0) return [];
  const emails = orders.map((o) => o.email.trim().toLowerCase());
  const [done, unsubscribed] = await Promise.all([
    prisma.adminActivityLog.findMany({ where: { action: NAMA_FOLLOWUP_ACTION, entityId: { in: emails } }, select: { entityId: true } }),
    prisma.newsletterUnsubscribe.findMany({ where: { email: { in: emails } }, select: { email: true } }),
  ]);
  const skip = new Set([...done.map((d) => d.entityId ?? ""), ...unsubscribed.map((u) => u.email.toLowerCase())]);
  const seen = new Set<string>();
  const out: NamaFollowupCandidate[] = [];
  for (const o of orders) {
    const key = o.email.trim().toLowerCase();
    if (skip.has(key) || seen.has(key)) continue;
    seen.add(key);
    out.push({ orderId: o.id, email: o.email.trim(), firstName: (o.firstName ?? "").trim(), country: o.shippingCountry ?? "CZ" });
  }
  return out;
}

export async function runNamaFollowup(): Promise<{ enabled: boolean; candidates: number; emailed: number; failed: number }> {
  const enabled = process.env.NAMA_FOLLOWUP_ENABLED === "true";
  const candidates = await getNamaFollowupCandidates().catch(() => []);
  if (!enabled || !isEmailConfigured()) return { enabled, candidates: candidates.length, emailed: 0, failed: 0 };

  let emailed = 0;
  let failed = 0;
  for (const c of candidates) {
    const key = c.email.toLowerCase();
    const code = newCode();
    const expiresAt = new Date(Date.now() + VALID_DAYS * 86_400_000);
    try {
      await prisma.coupon.create({
        data: { code, type: "PERCENT", value: DISCOUNT_PERCENT, active: true, usageLimit: 1, ownerEmail: key, expiresAt },
      });
      await sendNamaFollowupEmail({
        email: c.email,
        firstName: c.firstName,
        locale: c.country === "SK" ? "sk" : "cs",
        code,
        percent: DISCOUNT_PERCENT,
        expiresAt,
        unsubscribeUrl: await buildUnsubscribeUrl(c.email),
      });
      await logAdminActivity({ action: NAMA_FOLLOWUP_ACTION, entityType: "Email", entityId: key, detail: `${code} (${DISCOUNT_PERCENT} %, do ${expiresAt.toISOString().slice(0, 10)})` });
      emailed++;
    } catch (err) {
      failed++;
      await logAdminActivity({ action: `${NAMA_FOLLOWUP_ACTION}_failed`, entityType: "Email", entityId: key, detail: String(err).slice(0, 200) });
    }
  }
  return { enabled, candidates: candidates.length, emailed, failed };
}
