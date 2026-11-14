import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings.server";
import { NEW_ARRIVALS_ACTION, runNewArrivals } from "./new-arrivals";
import { runWeeklyNewsletter, WEEKLY_NEWSLETTER_ACTION } from "./weekly-newsletter-campaign";

// Daily driver for the two newsletter streams (owner's rules, 2026-11-14):
//  1. subscribers: a "Novinky" mail at most once a week, only new products in their categories, never repeated;
//  2. past buyers who did not subscribe: ONE personalised pick, once ever.
// Both draw from one daily cap because the Resend Free plan allows 100 mails/day in total, shared with order mails.
// Sends only when NEWSLETTER_AUTO_ENABLED=true; otherwise the cron does nothing here.
const DEFAULT_DAILY_CAP = 40;

const pragueDay = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Prague" });

export interface NewsletterAutoResult {
  enabled: boolean;
  cap: number;
  alreadySentToday: number;
  newArrivalsSent: number;
  oneOffSent: number;
}

export async function runNewsletterAuto(): Promise<NewsletterAutoResult> {
  const enabled = process.env.NEWSLETTER_AUTO_ENABLED === "true";
  const cap = Number(process.env.NEWSLETTER_DAILY_CAP) > 0 ? Number(process.env.NEWSLETTER_DAILY_CAP) : DEFAULT_DAILY_CAP;
  const result: NewsletterAutoResult = { enabled, cap, alreadySentToday: 0, newArrivalsSent: 0, oneOffSent: 0 };
  if (!enabled) return result;

  const today = pragueDay.format(new Date());
  const recent = await prisma.adminActivityLog.findMany({
    where: { action: { in: [NEW_ARRIVALS_ACTION, WEEKLY_NEWSLETTER_ACTION] }, createdAt: { gte: new Date(Date.now() - 36 * 3_600_000) } },
    select: { createdAt: true },
  });
  result.alreadySentToday = recent.filter((l) => pragueDay.format(l.createdAt) === today).length;
  let left = cap - result.alreadySentToday;
  if (left <= 0) return result;

  const s = await getSettings();
  const settings = { freeShippingThreshold: Number(s.freeShippingThreshold), czkToEurRate: Number(s.czkToEurRate) };

  const arrivals = await runNewArrivals({ apply: true, limit: left, settings });
  result.newArrivalsSent = arrivals.sent;
  left -= arrivals.sent;
  if (left <= 0 || arrivals.stoppedEarly) return result;

  const oneOff = await runWeeklyNewsletter({ apply: true, limit: left, settings });
  result.oneOffSent = oneOff.sent;
  return result;
}
