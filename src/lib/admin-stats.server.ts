import { prisma } from "@/lib/prisma";
import { getSettings, type ShopSettings } from "@/lib/settings.server";
import { getShippingCost } from "@/lib/shipping";
import { purchaseCost } from "@/lib/cost-of-goods";
import { getPaymentFee } from "@/lib/payment-fee";

// Same definition of "an order that counts" as the dashboard's daily figures: confirmed orders, plus COD / bank-transfer
// orders from the moment they are placed (they sit in NEW until shipped/paid). Unconfirmed card orders stay out.
const REVENUE_STATUSES = ["PAID", "PROCESSING", "SHIPPED", "DELIVERED"] as const;
export const COUNTED_ORDER_FILTER = {
  OR: [
    { status: { in: [...REVENUE_STATUSES] } },
    { status: "NEW" as const, paymentMethod: { not: "CARD" as const } },
  ],
};

const TZ = "Europe/Prague";
const dayFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ });

/** Prague calendar day of an instant, "YYYY-MM-DD". */
export function pragueDay(d: Date): string {
  return dayFmt.format(d);
}

/** Adds whole days to a "YYYY-MM-DD" string (calendar arithmetic, no timezone involved). */
export function addDays(ymd: string, n: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** First instant (UTC) of a Prague calendar day. */
export function startOfPragueDayYmd(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  const utcGuess = Date.UTC(y, m - 1, d);
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: TZ,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
    })
      .formatToParts(new Date(utcGuess))
      .map((x) => [x.type, Number(x.value)]),
  ) as Record<string, number>;
  const offsetMs = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second) - utcGuess;
  return new Date(utcGuess - offsetMs);
}

/** 0 = Monday … 6 = Sunday for a "YYYY-MM-DD". */
export function weekdayIndex(ymd: string): number {
  const [y, m, d] = ymd.split("-").map(Number);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

export interface DayPoint {
  day: string;
  revenue: number;
  profit: number;
  orders: number;
}

type ProfitOrderRow = {
  createdAt: Date;
  total: unknown;
  shippingMethod: Parameters<typeof getShippingCost>[0];
  shippingCountry: string | null;
  paymentMethod: Parameters<typeof getPaymentFee>[0];
  items: { qty: number; isGift: boolean; product: { purchasePrice: unknown; vatRate: unknown } | null }[];
};

/** Net profit of one order — identical formula to the order detail page and the dashboard cards. */
export function orderNetProfit(order: ProfitOrderRow, settings: ShopSettings): number {
  const costOfGoods = order.items.reduce(
    (sum, item) =>
      sum +
      (item.isGift || !item.product
        ? 0
        : purchaseCost(item.product.purchasePrice as never, item.product.vatRate as never) * item.qty),
    0,
  );
  const shippingCost = getShippingCost(order.shippingMethod, settings, order.shippingCountry ?? "CZ", order.paymentMethod);
  const paymentFee = getPaymentFee(order.paymentMethod, Number(order.total), order.shippingCountry ?? "CZ", settings);
  return Number(order.total) - costOfGoods - shippingCost - paymentFee;
}

/** Per-Prague-day revenue / net profit / order count for [fromDay, toDay] inclusive; every day present (zeros included). */
export async function getDailySeries(fromDay: string, toDay: string): Promise<DayPoint[]> {
  const settings = await getSettings();
  const orders = await prisma.order.findMany({
    where: {
      ...COUNTED_ORDER_FILTER,
      createdAt: { gte: startOfPragueDayYmd(fromDay), lt: startOfPragueDayYmd(addDays(toDay, 1)) },
    },
    select: {
      createdAt: true,
      total: true,
      shippingMethod: true,
      shippingCountry: true,
      paymentMethod: true,
      items: { select: { qty: true, isGift: true, product: { select: { purchasePrice: true, vatRate: true } } } },
    },
  });
  const byDay = new Map<string, DayPoint>();
  for (let d = fromDay; d <= toDay; d = addDays(d, 1)) byDay.set(d, { day: d, revenue: 0, profit: 0, orders: 0 });
  for (const o of orders) {
    const p = byDay.get(pragueDay(o.createdAt));
    if (!p) continue;
    p.revenue += Number(o.total);
    p.profit += orderNetProfit(o as ProfitOrderRow, settings);
    p.orders += 1;
  }
  return [...byDay.values()];
}

export interface RepeatStats {
  customers: number;
  repeatCustomers: number;
  /** Share of customers whose first order is at least `matureDays` old that placed a second one. */
  repeatRate: number;
  matureCustomers: number;
  matureRepeat: number;
  medianDaysToSecond: number | null;
  revenueFromRepeat: number;
  totalRevenue: number;
  cohorts: { month: string; customers: number; repeat: number }[];
  /** Customers with 2+ orders, newest second order first. */
  repeatList: { email: string; name: string; orders: number; spent: number; first: Date; last: Date }[];
}

const REAL_ORDER_STATUSES = ["NEW", "PAID", "PROCESSING", "SHIPPED", "DELIVERED"] as const;

/** Repeat-purchase picture grouped by e-mail across all real orders (most checkouts are guest, so Customer rows are not enough). */
export async function getRepeatStats(matureDays = 30): Promise<RepeatStats> {
  const orders = await prisma.order.findMany({
    where: { status: { in: [...REAL_ORDER_STATUSES] } },
    select: { email: true, firstName: true, lastName: true, total: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  const byEmail = new Map<string, { name: string; email: string; dates: Date[]; spent: number }>();
  for (const o of orders) {
    const key = o.email.trim().toLowerCase();
    const row = byEmail.get(key) ?? { name: `${o.firstName} ${o.lastName}`.trim(), email: o.email, dates: [], spent: 0 };
    row.dates.push(o.createdAt);
    row.spent += Number(o.total);
    byEmail.set(key, row);
  }
  const rows = [...byEmail.values()];
  const matureBefore = Date.now() - matureDays * 86_400_000;
  const gaps: number[] = [];
  const cohortMap = new Map<string, { customers: number; repeat: number }>();
  let matureCustomers = 0;
  let matureRepeat = 0;
  let revenueFromRepeat = 0;
  let totalRevenue = 0;
  for (const r of rows) {
    totalRevenue += r.spent;
    const repeat = r.dates.length > 1;
    if (repeat) {
      revenueFromRepeat += r.spent;
      gaps.push((r.dates[1].getTime() - r.dates[0].getTime()) / 86_400_000);
    }
    if (r.dates[0].getTime() <= matureBefore) {
      matureCustomers += 1;
      if (repeat) matureRepeat += 1;
    }
    const month = pragueDay(r.dates[0]).slice(0, 7);
    const c = cohortMap.get(month) ?? { customers: 0, repeat: 0 };
    c.customers += 1;
    if (repeat) c.repeat += 1;
    cohortMap.set(month, c);
  }
  gaps.sort((a, b) => a - b);
  const repeatRows = rows.filter((r) => r.dates.length > 1);
  return {
    customers: rows.length,
    repeatCustomers: repeatRows.length,
    repeatRate: matureCustomers ? matureRepeat / matureCustomers : 0,
    matureCustomers,
    matureRepeat,
    medianDaysToSecond: gaps.length ? gaps[Math.floor(gaps.length / 2)] : null,
    revenueFromRepeat,
    totalRevenue,
    cohorts: [...cohortMap.entries()].sort(([a], [b]) => (a < b ? 1 : -1)).slice(0, 8).map(([month, v]) => ({ month, ...v })),
    repeatList: repeatRows
      .map((r) => ({ email: r.email, name: r.name, orders: r.dates.length, spent: r.spent, first: r.dates[0], last: r.dates[r.dates.length - 1] }))
      .sort((a, b) => b.last.getTime() - a.last.getTime()),
  };
}
