import { prisma } from "@/lib/prisma";
import { logAdminActivity } from "@/lib/admin/activity-log";
import { isConditionFlagged } from "@/lib/feeds/condition-flagged";
import { EMAIL_FROM, getResendClient, isEmailConfigured } from "@/lib/email/resend";
import { renderNewArrivalsHtml } from "@/lib/email/new-arrivals-email";
import { buildUnsubscribeUrl } from "./unsubscribe";
import {
  getCategoryIdsUnderRoot,
  recommendProductsForBuyer,
  rootsForTheme,
  type RecommendationTheme,
  type RecommendedProduct,
} from "./recommend-products";

// "Novinky" e-mail for people who SUBSCRIBED to the newsletter (owner's rule, 2026-11-14): at most once a week,
// only products that are new in the categories the subscriber has bought from, and never the same product twice.
// If nothing new qualifies, nothing is sent. Past buyers who did not subscribe get a single one-off pick instead
// (see selectWeeklyRecipients in weekly-newsletter-campaign.ts) and never a regular stream.
export const NEW_ARRIVALS_ACTION = "marketing.new_arrivals_email";

const MIN_DAYS_BETWEEN_MAILS = 7;
const LOOKBACK_DAYS = 30;
const MAX_PRODUCTS = 9;
const MAX_PER_BRAND = 2;
const MIN_PRODUCTS_TO_SEND = 3;
const SEND_DELAY_MS = 700;
const MAX_CONSECUTIVE_ERRORS = 3;
const COUNTABLE_STATUSES = ["NEW", "PAID", "PROCESSING", "SHIPPED", "DELIVERED"] as const;

export interface NewArrivalsRecipient {
  email: string;
  firstName: string;
}

export interface NewArrivalsPlan {
  email: string;
  firstName: string;
  theme: RecommendationTheme;
  categoryName: string | null;
  ctaPath: string;
  products: RecommendedProduct[];
  subject: string;
  preheader: string;
}

function greetingName(raw: string | null): string {
  const name = (raw ?? "").trim();
  if (!name || name.length > 24 || /[\d@<>&"]/.test(name)) return "";
  return name;
}

function subjectFor(theme: RecommendationTheme, categoryName: string | null): string {
  if (theme === "perfume") return "Novinky: parfémy";
  if (theme === "home_fragrance") return "Novinky: vůně do domova a auta";
  return categoryName ? `Novinky: ${categoryName.toLowerCase()}` : "Novinky v našem e-shopu";
}

/** Product ids already shown to this address in an earlier "Novinky" mail, and when the last one went out. */
async function sentHistory(email: string): Promise<{ ids: Set<string>; last: Date | null }> {
  const logs = await prisma.adminActivityLog.findMany({
    where: { action: NEW_ARRIVALS_ACTION, entityId: email.toLowerCase() },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true, detail: true },
  });
  const ids = new Set<string>();
  for (const l of logs) {
    try {
      const parsed = JSON.parse(l.detail ?? "{}") as { ids?: string[] };
      for (const id of parsed.ids ?? []) ids.add(id);
    } catch {
      /* an old/odd log line carries no ids */
    }
  }
  return { ids, last: logs[0]?.createdAt ?? null };
}

/** Everyone with an active newsletter subscription: opted in, not unsubscribed, Czech copy only for now. */
export async function selectNewArrivalsRecipients(): Promise<NewArrivalsRecipient[]> {
  const [customers, unsubscribed] = await Promise.all([
    prisma.customer.findMany({ where: { marketingOptIn: true }, select: { email: true, firstName: true, addressCountry: true } }),
    prisma.newsletterUnsubscribe.findMany({ select: { email: true } }),
  ]);
  const out = new Set(unsubscribed.map((u) => u.email.toLowerCase()));
  return customers
    .filter((c) => !out.has(c.email.toLowerCase()) && c.addressCountry !== "SK")
    .map((c) => ({ email: c.email.trim(), firstName: greetingName(c.firstName) }));
}

/**
 * What one subscriber would get now — computed without sending. Returns null when they are not due yet (mailed in
 * the last 7 days) or fewer than three new, not-yet-shown products fit their categories.
 */
export async function planNewArrivals(email: string, firstName: string): Promise<NewArrivalsPlan | null> {
  const history = await sentHistory(email);
  if (history.last && Date.now() - history.last.getTime() < MIN_DAYS_BETWEEN_MAILS * 86_400_000) return null;

  const rec = await recommendProductsForBuyer(email);
  const rootIds = (await Promise.all(rootsForTheme(rec.theme, rec.categoryName).map(getCategoryIdsUnderRoot))).flat();

  const bought = await prisma.orderItem.findMany({
    where: { order: { email: { equals: email, mode: "insensitive" }, status: { in: [...COUNTABLE_STATUSES] } }, productId: { not: null } },
    select: { productId: true },
  });
  const exclude = new Set<string>([...history.ids, ...bought.flatMap((b) => (b.productId ? [b.productId] : []))]);

  const since = new Date(Date.now() - LOOKBACK_DAYS * 86_400_000);
  const rows = await prisma.product.findMany({
    where: {
      visible: true,
      stock: { gt: 0 },
      isDefective: false,
      createdAt: { gte: since },
      id: { notIn: [...exclude] },
      // A subscriber with no purchases yet has no category to follow: any new product qualifies.
      ...(rootIds.length ? { categories: { some: { categoryId: { in: rootIds } } } } : {}),
      images: { some: {} },
    },
    orderBy: { createdAt: "desc" },
    take: 60,
    select: {
      id: true,
      name: true,
      nameSk: true,
      slug: true,
      price: true,
      brandId: true,
      isDefective: true,
      images: { take: 1, orderBy: { sortOrder: "asc" }, select: { url: true } },
    },
  });

  const perBrand = new Map<string, number>();
  const products: RecommendedProduct[] = [];
  for (const p of rows) {
    if (products.length >= MAX_PRODUCTS) break;
    if (isConditionFlagged(p.name, p.isDefective)) continue;
    const key = p.brandId ?? p.id;
    if ((perBrand.get(key) ?? 0) >= MAX_PER_BRAND) continue;
    perBrand.set(key, (perBrand.get(key) ?? 0) + 1);
    products.push({ id: p.id, name: p.name, nameSk: p.nameSk, slug: p.slug, price: Number(p.price), imageUrl: p.images[0]?.url ?? null });
  }
  if (products.length < MIN_PRODUCTS_TO_SEND) return null;

  return {
    email,
    firstName,
    theme: rec.theme,
    categoryName: rec.categoryName,
    ctaPath: rec.ctaPath,
    products,
    subject: subjectFor(rec.theme, rec.categoryName),
    preheader: firstName ? `${firstName}, v naší nabídce přibylo pár novinek.` : "V naší nabídce přibylo pár novinek.",
  };
}

export interface NewArrivalsRunResult {
  subscribers: number;
  due: number;
  sent: number;
  failed: number;
  stoppedEarly: boolean;
}

/** Plans (and, with `apply`, sends) the "Novinky" mails, at most `limit` of them. Without `apply` nothing is mailed or logged. */
export async function runNewArrivals(opts: {
  apply: boolean;
  limit?: number;
  settings: { freeShippingThreshold: number; czkToEurRate: number };
}): Promise<NewArrivalsRunResult> {
  const subscribers = await selectNewArrivalsRecipients();
  const result: NewArrivalsRunResult = { subscribers: subscribers.length, due: 0, sent: 0, failed: 0, stoppedEarly: false };
  if (opts.apply && !isEmailConfigured()) throw new Error("RESEND_API_KEY není nastaven.");
  const limit = opts.limit ?? Number.POSITIVE_INFINITY;

  let consecutiveErrors = 0;
  for (const r of subscribers) {
    if (result.sent >= limit) break;
    let plan: NewArrivalsPlan | null;
    try {
      plan = await planNewArrivals(r.email, r.firstName).catch(() => planNewArrivals(r.email, r.firstName));
    } catch (err) {
      result.failed++;
      console.error(`[new-arrivals] could not plan a mail: ${(err as Error).message.slice(0, 120)}`);
      continue;
    }
    if (!plan) continue;
    result.due++;
    if (!opts.apply) { result.sent++; continue; }

    const unsubscribeUrl = await buildUnsubscribeUrl(r.email);
    const html = await renderNewArrivalsHtml(plan, { settings: opts.settings });
    const { error } = await getResendClient().emails.send({
      from: EMAIL_FROM,
      to: r.email,
      subject: plan.subject,
      html,
      headers: { "List-Unsubscribe": `<${unsubscribeUrl}>` },
    });
    if (error) {
      result.failed++;
      console.error(`[new-arrivals] send failed: ${error.message}`);
      if (++consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) { result.stoppedEarly = true; break; }
      continue;
    }
    consecutiveErrors = 0;
    result.sent++;
    await logAdminActivity({
      action: NEW_ARRIVALS_ACTION,
      entityType: "Email",
      entityId: r.email.toLowerCase(),
      detail: JSON.stringify({ subject: plan.subject, ids: plan.products.map((p) => p.id) }),
    });
    await new Promise((res) => setTimeout(res, SEND_DELAY_MS));
  }
  return result;
}
