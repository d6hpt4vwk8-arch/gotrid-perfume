import { prisma } from "@/lib/prisma";
import { logAdminActivity } from "@/lib/admin/activity-log";
import { EMAIL_FROM, getResendClient, isEmailConfigured } from "@/lib/email/resend";
import { renderWeeklyNewsletterHtml } from "@/lib/email/weekly-newsletter-email";
import { buildUnsubscribeUrl } from "./unsubscribe";
import { WISHLIST_EMAIL_ACTION } from "./wishlist-campaign";
import { planWeeklyNewsletter } from "./weekly-newsletter";

export const WEEKLY_NEWSLETTER_ACTION = "marketing.weekly_newsletter";

const COUNTABLE_STATUSES = ["NEW", "PAID", "PROCESSING", "SHIPPED", "DELIVERED"] as const;
// Nobody gets the weekly mail right after buying, and never twice in a week or on top of a wishlist mail.
const MIN_DAYS_SINCE_ORDER = 14;
const MIN_DAYS_BETWEEN_MAILS = 6;
const SEND_DELAY_MS = 700;
const MAX_CONSECUTIVE_ERRORS = 3;

export interface WeeklyRecipient {
  email: string;
  firstName: string;
}

export interface WeeklySelection {
  recipients: WeeklyRecipient[];
  skipped: { unsubscribed: number; orderedRecently: number; recentlyMailed: number; slovak: number };
}

/** A first name that is safe and sensible to greet with; anything odd (digits, e-mail, company-like) means no name. */
function greetingName(raw: string | null): string {
  const name = (raw ?? "").trim();
  if (!name || name.length > 24 || /[\d@<>&"]/.test(name)) return "";
  return name;
}

/**
 * Everyone the next weekly mail may go to: past buyers (existing-customer relationship, §7/3 of 480/2004 Sb.,
 * same basis as the second-order mail), minus unsubscribes, Slovak buyers (Czech copy only for now), recent buyers
 * and anyone mailed by marketing in the last week.
 */
export async function selectWeeklyRecipients(): Promise<WeeklySelection> {
  const orders = await prisma.order.findMany({
    where: { status: { in: [...COUNTABLE_STATUSES] } },
    select: { email: true, firstName: true, createdAt: true, shippingCountry: true },
    orderBy: { createdAt: "asc" },
  });
  const unsubscribed = new Set((await prisma.newsletterUnsubscribe.findMany({ select: { email: true } })).map((u) => u.email.toLowerCase()));

  const since = new Date(Date.now() - MIN_DAYS_BETWEEN_MAILS * 86400000);
  const recentLogs = await prisma.adminActivityLog.findMany({
    where: { action: { in: [WEEKLY_NEWSLETTER_ACTION, WISHLIST_EMAIL_ACTION] }, createdAt: { gte: since } },
    select: { action: true, entityId: true, detail: true },
  });
  const recentlyMailed = new Set<string>();
  for (const log of recentLogs) {
    if (log.action === WEEKLY_NEWSLETTER_ACTION && log.entityId) recentlyMailed.add(log.entityId.toLowerCase());
    // The wishlist log keeps the address in "detail" ("a@b.cz: 2 oblíbených (cena/sklad)").
    if (log.action === WISHLIST_EMAIL_ACTION && log.detail) recentlyMailed.add(log.detail.split(":")[0].trim().toLowerCase());
  }

  const latest = new Map<string, (typeof orders)[number]>();
  for (const o of orders) latest.set(o.email.trim().toLowerCase(), o);

  const skipped = { unsubscribed: 0, orderedRecently: 0, recentlyMailed: 0, slovak: 0 };
  const recipients: WeeklyRecipient[] = [];
  const now = Date.now();
  for (const [key, o] of latest) {
    if (unsubscribed.has(key)) { skipped.unsubscribed++; continue; }
    if (o.shippingCountry === "SK") { skipped.slovak++; continue; }
    if (now - o.createdAt.getTime() < MIN_DAYS_SINCE_ORDER * 86400000) { skipped.orderedRecently++; continue; }
    if (recentlyMailed.has(key)) { skipped.recentlyMailed++; continue; }
    recipients.push({ email: o.email.trim(), firstName: greetingName(o.firstName) });
  }
  return { recipients, skipped };
}

export interface WeeklyRunResult {
  selected: number;
  sent: number;
  noProducts: number;
  failed: number;
  stoppedEarly: boolean;
  skipped: WeeklySelection["skipped"];
}

/**
 * Plans (and, with `apply`, sends) the weekly e-mail. Without `apply` nothing is mailed or logged.
 * `settings` is passed in because this may run outside Next, where getSettings()'s cache does not work.
 */
export async function runWeeklyNewsletter(opts: {
  apply: boolean;
  limit?: number;
  settings: { freeShippingThreshold: number; czkToEurRate: number };
}): Promise<WeeklyRunResult> {
  const { recipients, skipped } = await selectWeeklyRecipients();
  const result: WeeklyRunResult = { selected: recipients.length, sent: 0, noProducts: 0, failed: 0, stoppedEarly: false, skipped };
  if (opts.apply && !isEmailConfigured()) throw new Error("RESEND_API_KEY není nastaven.");

  let consecutiveErrors = 0;
  for (const r of recipients.slice(0, opts.limit ?? recipients.length)) {
    // The pooled DB connection can be dropped mid-run (Neon, P1017): retry once, then skip this buyer — never abort the run.
    let plan: Awaited<ReturnType<typeof planWeeklyNewsletter>>;
    try {
      plan = await planWeeklyNewsletter(r.email, r.firstName).catch(() => planWeeklyNewsletter(r.email, r.firstName));
    } catch (err) {
      result.failed++;
      console.error(`[weekly-newsletter] could not plan a mail: ${(err as Error).message.slice(0, 120)}`);
      continue;
    }
    if (plan.picks.length === 0) { result.noProducts++; continue; }
    if (!opts.apply) { result.sent++; continue; }

    const unsubscribeUrl = await buildUnsubscribeUrl(r.email);
    const html = await renderWeeklyNewsletterHtml(plan, { settings: opts.settings });
    const { error } = await getResendClient().emails.send({
      from: EMAIL_FROM,
      to: r.email,
      subject: plan.subject,
      html,
      headers: { "List-Unsubscribe": `<${unsubscribeUrl}>` },
    });
    if (error) {
      result.failed++;
      console.error(`[weekly-newsletter] send failed: ${error.message}`);
      if (++consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) { result.stoppedEarly = true; break; }
      continue;
    }
    consecutiveErrors = 0;
    result.sent++;
    await logAdminActivity({ action: WEEKLY_NEWSLETTER_ACTION, entityType: "Email", entityId: r.email.toLowerCase(), detail: plan.subject });
    await new Promise((res) => setTimeout(res, SEND_DELAY_MS));
  }
  return result;
}
