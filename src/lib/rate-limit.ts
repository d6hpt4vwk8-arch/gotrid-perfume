import { prisma } from "@/lib/prisma";

/**
 * DB-backed sliding-window rate limit — an in-memory counter would silently
 * reset on every cold start once deployed to Vercel's serverless functions,
 * giving no real protection.
 *
 * Check and record are split so callers only count what actually matters —
 * e.g. failed login attempts, or successfully placed orders — instead of
 * penalizing a customer who just mistyped their postcode.
 */
export async function isRateLimited(
  key: string,
  maxAttempts: number,
  windowMs: number,
): Promise<boolean> {
  const since = new Date(Date.now() - windowMs);
  const count = await prisma.rateLimitHit.count({ where: { key, createdAt: { gte: since } } });
  return count >= maxAttempts;
}

const CLEANUP_MAX_AGE_MS = 24 * 60 * 60 * 1000; // window sizes used across the app top out well under this
const CLEANUP_PROBABILITY = 0.02; // no cron infra — piggyback an occasional sweep on real traffic instead

export async function recordRateLimitHit(key: string): Promise<void> {
  await prisma.rateLimitHit.create({ data: { key } });

  if (Math.random() < CLEANUP_PROBABILITY) {
    const before = new Date(Date.now() - CLEANUP_MAX_AGE_MS);
    void prisma.rateLimitHit
      .deleteMany({ where: { createdAt: { lt: before } } })
      .catch((err) => console.error("[rate-limit] cleanup failed", err));
  }
}

/**
 * Vercel's edge appends the true client IP as the LAST hop in
 * X-Forwarded-For — anything before that can be spoofed by the client, so
 * trusting the first entry (as this used to) lets an attacker pick their own
 * rate-limit bucket. `X-Real-IP` is the single Vercel-set trustworthy value
 * when present; falling back to the last XFF entry covers other hosts.
 */
export function getClientIp(req: Request): string {
  const realIp = req.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  const forwardedFor = req.headers.get("x-forwarded-for");
  if (!forwardedFor) return "unknown";
  const hops = forwardedFor.split(",").map((s) => s.trim());
  return hops[hops.length - 1] || "unknown";
}
