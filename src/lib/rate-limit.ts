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

export async function recordRateLimitHit(key: string): Promise<void> {
  await prisma.rateLimitHit.create({ data: { key } });
}

export function getClientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}
