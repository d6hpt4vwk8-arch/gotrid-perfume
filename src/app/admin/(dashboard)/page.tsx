import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/format";
import { DailyChart, type ChartMetric } from "@/components/admin/daily-chart";
import { getMonthlyGoal } from "@/lib/admin-goals";
import {
  addDays,
  getDailySeries,
  getRepeatStats,
  pragueDay,
  weekdayIndex,
  type DayPoint,
} from "@/lib/admin-stats.server";

const LOW_STOCK_THRESHOLD = 5;
const WEEKDAYS = ["Po", "Út", "St", "Čt", "Pá", "So", "Ne"];
const WEEKDAYS_LONG = ["pondělí", "úterý", "středa", "čtvrtek", "pátek", "sobota", "neděle"];

const METRICS: { key: ChartMetric; label: string }[] = [
  { key: "profit", label: "Zisk" },
  { key: "revenue", label: "Obrat" },
  { key: "orders", label: "Objednávky" },
];

const sum = (list: DayPoint[], k: "revenue" | "profit" | "orders") => list.reduce((s, p) => s + p[k], 0);

function fmtPct(now: number, before: number): { text: string; good: boolean } | null {
  if (before === 0) return null;
  const pct = ((now - before) / Math.abs(before)) * 100;
  return { text: `${pct >= 0 ? "+" : "−"}${Math.abs(Math.round(pct))} %`, good: pct >= 0 };
}

function Delta({ now, before, suffix = "oproti předchozímu období" }: { now: number; before: number; suffix?: string }) {
  const d = fmtPct(now, before);
  if (!d) return <span className="text-xs text-accent-2">{suffix}: —</span>;
  return (
    <span className="text-xs text-accent-2">
      <span className={d.good ? "font-semibold text-ok" : "font-semibold text-red-600"}>{d.text}</span> {suffix}
    </span>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-sm border border-line bg-white p-4 ${className}`}>{children}</div>;
}

function ProgressBar({ label, value, goal, unit, expected }: { label: string; value: number; goal: number; unit: string; expected: number }) {
  const pct = goal > 0 ? Math.max(0, Math.min(100, (value / goal) * 100)) : 0;
  const mark = goal > 0 ? Math.max(0, Math.min(100, (expected / goal) * 100)) : 0;
  const onTrack = value >= expected;
  const fmt = (n: number) => (unit === "Kč" ? formatPrice(n) : `${Math.round(n)} ${unit}`);
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="font-medium text-ink">{label}</span>
        <span className="text-accent-2">
          {fmt(value)} z {fmt(goal)} · <span className="font-semibold text-ink">{Math.round(pct)} %</span>
        </span>
      </div>
      <div className="relative h-2.5 rounded-full bg-line">
        <div className={`h-full rounded-full ${onTrack ? "bg-ok" : "bg-accent"}`} style={{ width: `${pct}%` }} />
        {/* where the month's calendar says we should be by now */}
        <div className="absolute top-[-3px] h-[16px] w-[2px] bg-ink/60" style={{ left: `${mark}%` }} title="Kde bychom měli být podle kalendáře" />
      </div>
    </div>
  );
}

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ metric?: string; days?: string }>;
}) {
  const sp = await searchParams;
  const metric: ChartMetric = METRICS.some((m) => m.key === sp.metric) ? (sp.metric as ChartMetric) : "profit";
  const days = sp.days === "90" ? 90 : sp.days === "14" ? 14 : 30;

  const today = pragueDay(new Date());
  const monthKey = today.slice(0, 7);
  const monthStart = `${monthKey}-01`;
  const prevMonthStart = (() => {
    const [y, m] = monthKey.split("-").map(Number);
    return m === 1 ? `${y - 1}-12-01` : `${y}-${String(m - 1).padStart(2, "0")}-01`;
  })();
  const curFrom = addDays(today, -(days - 1));
  const prevFrom = addDays(curFrom, -days);
  const fetchFrom = [prevFrom, prevMonthStart].sort()[0];

  const [series, repeat, newOrders, pendingReviews, productCount, topSellers, lowStock, unconfirmedToday] = await Promise.all([
    getDailySeries(fetchFrom, today),
    getRepeatStats(),
    prisma.order.count({ where: { status: "NEW" } }),
    prisma.review.count({ where: { published: false } }),
    prisma.product.count({ where: { visible: true } }),
    prisma.product.findMany({
      where: { visible: true, salesCount: { gt: 0 } },
      orderBy: { salesCount: "desc" },
      take: 6,
      select: { id: true, name: true, salesCount: true, stock: true },
    }),
    prisma.product.findMany({
      where: { visible: true, stock: { gt: 0, lte: LOW_STOCK_THRESHOLD } },
      orderBy: { stock: "asc" },
      take: 8,
      select: { id: true, name: true, stock: true },
    }),
    prisma.order.aggregate({
      where: { status: "NEW", paymentMethod: "CARD", createdAt: { gte: new Date(Date.now() - 24 * 3600_000) } },
      _sum: { total: true },
      _count: true,
    }),
  ]);

  const inRange = (from: string, to: string) => series.filter((p) => p.day >= from && p.day <= to);
  const current = inRange(curFrom, today);
  const previous = inRange(prevFrom, addDays(curFrom, -1));
  const todayPoint = series.find((p) => p.day === today)!;
  const yesterdayPoint = series.find((p) => p.day === addDays(today, -1))!;
  const monthSoFar = inRange(monthStart, today);
  const prevMonth = inRange(prevMonthStart, addDays(monthStart, -1));
  const prevMonthSamePeriod = inRange(prevMonthStart, addDays(prevMonthStart, monthSoFar.length - 1));

  // Month progress / pace
  const daysInMonth = (() => {
    const [y, m] = monthKey.split("-").map(Number);
    return new Date(Date.UTC(y, m, 0)).getUTCDate();
  })();
  const dayOfMonth = monthSoFar.length;
  const goal = getMonthlyGoal(monthKey);
  const monthProfit = sum(monthSoFar, "profit");
  const monthOrders = sum(monthSoFar, "orders");
  const monthRevenue = sum(monthSoFar, "revenue");
  const projectedProfit = dayOfMonth > 0 ? (monthProfit / dayOfMonth) * daysInMonth : 0;

  // Weekday pattern over the selected period
  const wd = WEEKDAYS.map((_, i) => {
    const pts = current.filter((p) => weekdayIndex(p.day) === i);
    return {
      i,
      n: pts.length,
      profit: pts.length ? sum(pts, "profit") / pts.length : 0,
      orders: pts.length ? sum(pts, "orders") / pts.length : 0,
    };
  });
  const bestWd = wd.reduce((a, b) => (b.profit > a.profit ? b : a), wd[0]);
  const maxWdProfit = Math.max(...wd.map((w) => Math.abs(w.profit)), 1);
  const topDays = [...current].filter((p) => p.orders > 0).sort((a, b) => b.profit - a.profit).slice(0, 3);
  const fmtDay = (ymd: string) => {
    const [, m, d] = ymd.split("-");
    return `${Number(d)}. ${Number(m)}.`;
  };

  const qs = (o: { metric?: string; days?: number }) => {
    const p = new URLSearchParams();
    p.set("metric", o.metric ?? metric);
    p.set("days", String(o.days ?? days));
    return `?${p.toString()}`;
  };
  const metricWord = metric === "profit" ? "zisk" : metric === "revenue" ? "obrat" : "objednávky";
  const totalNow = sum(current, metric);
  const totalBefore = sum(previous, metric);
  const fmtMetric = (v: number) => (metric === "orders" ? `${Math.round(v)} obj.` : formatPrice(v));

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-ink">Přehled</h1>
        <div className="flex flex-wrap gap-2 text-sm">
          <Link href="/admin/objednavky?status=NEW" className="rounded-full border border-line px-3 py-1 hover:border-accent-2">
            Nové objednávky: <b>{newOrders}</b>
          </Link>
          <Link href="/admin/recenze" className="rounded-full border border-line px-3 py-1 hover:border-accent-2">
            Recenze ke schválení: <b>{pendingReviews}</b>
          </Link>
        </div>
      </div>

      {/* Today / month / goal */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <div className="text-sm text-accent-2">Dnes</div>
          <div className="text-2xl font-bold text-ink">{formatPrice(todayPoint.revenue)}</div>
          <div className={`text-sm font-medium ${todayPoint.profit >= 0 ? "text-ok" : "text-red-600"}`}>
            zisk {formatPrice(todayPoint.profit)}
          </div>
          <div className="mt-1 text-xs text-accent-2">
            {todayPoint.orders} obj. · včera {formatPrice(yesterdayPoint.revenue)} / zisk {formatPrice(yesterdayPoint.profit)} ({yesterdayPoint.orders} obj.)
          </div>
          {unconfirmedToday._count > 0 && (
            <div className="mt-1 text-xs text-accent-2">
              + {unconfirmedToday._count} nepotvrzených plateb kartou ({formatPrice(unconfirmedToday._sum.total ?? 0)})
            </div>
          )}
        </Card>

        <Card>
          <div className="text-sm text-accent-2">Tento měsíc (od 1. do dneška)</div>
          <div className="text-2xl font-bold text-ink">{formatPrice(monthRevenue)}</div>
          <div className={`text-sm font-medium ${monthProfit >= 0 ? "text-ok" : "text-red-600"}`}>zisk {formatPrice(monthProfit)}</div>
          <div className="mt-1 flex flex-col text-xs text-accent-2">
            <span>{monthOrders} objednávek · tempo: zisk ≈ {formatPrice(projectedProfit)} za měsíc</span>
            <Delta now={monthProfit} before={sum(prevMonthSamePeriod, "profit")} suffix="zisk oproti stejnému období minulého měsíce" />
          </div>
        </Card>

        <Card>
          <div className="mb-2 text-sm text-accent-2">Cíl na měsíc</div>
          {goal.profit === null && goal.orders === null ? (
            <p className="text-sm text-accent-2">
              Cíl pro tento měsíc není nastavený. Minulý měsíc: zisk {formatPrice(sum(prevMonth, "profit"))}, {sum(prevMonth, "orders")} objednávek.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {goal.profit !== null && (
                <ProgressBar label="Zisk" value={monthProfit} goal={goal.profit} unit="Kč" expected={(goal.profit * dayOfMonth) / daysInMonth} />
              )}
              {goal.orders !== null && (
                <ProgressBar label="Objednávky" value={monthOrders} goal={goal.orders} unit="obj." expected={(goal.orders * dayOfMonth) / daysInMonth} />
              )}
              <div className="text-xs text-accent-2">
                Den {dayOfMonth} z {daysInMonth}. Svislá čárka = kde bychom měli být podle kalendáře.
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Daily chart */}
      <Card>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-ink">Vývoj po dnech</h2>
            <p className="text-xs text-accent-2">
              Sloupce = posledních {days} dní, přerušovaná čára = předchozích {days} dní. Nejlepší den je zvýrazněný.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            <div className="flex overflow-hidden rounded-sm border border-line">
              {METRICS.map((m) => (
                <Link
                  key={m.key}
                  href={qs({ metric: m.key })}
                  className={`px-3 py-1 ${metric === m.key ? "bg-ink text-white" : "hover:bg-line/50"}`}
                >
                  {m.label}
                </Link>
              ))}
            </div>
            <div className="flex overflow-hidden rounded-sm border border-line">
              {[14, 30, 90].map((d) => (
                <Link key={d} href={qs({ days: d })} className={`px-3 py-1 ${days === d ? "bg-ink text-white" : "hover:bg-line/50"}`}>
                  {d} dní
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div className="mb-2 flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <span className="text-xl font-bold text-ink">{fmtMetric(totalNow)}</span>
          <span className="text-sm text-accent-2">celkem {metricWord} za {days} dní</span>
          <Delta now={totalNow} before={totalBefore} suffix={`(${fmtMetric(totalBefore)} předtím)`} />
        </div>
        <DailyChart current={current} previous={previous} metric={metric} />
      </Card>

      {/* Best days */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <h2 className="mb-1 font-semibold text-ink">Nejlepší dny v týdnu</h2>
          <p className="mb-3 text-xs text-accent-2">
            Průměrný zisk za jeden takový den za posledních {days} dní.
            {bestWd.profit > 0 && <> Nejsilnější je <b className="text-ink">{WEEKDAYS_LONG[bestWd.i]}</b>.</>}
          </p>
          <div className="flex flex-col gap-1.5">
            {wd.map((w) => (
              <div key={w.i} className="flex items-center gap-2 text-sm">
                <span className="w-6 text-accent-2">{WEEKDAYS[w.i]}</span>
                <div className="h-4 flex-1 rounded-sm bg-line/50">
                  <div
                    className={`h-full rounded-sm ${w.profit < 0 ? "bg-red-500" : w.i === bestWd.i && w.profit > 0 ? "bg-ink" : "bg-accent-2/70"}`}
                    style={{ width: `${(Math.abs(w.profit) / maxWdProfit) * 100}%` }}
                  />
                </div>
                <span className="w-24 text-right tabular-nums">{formatPrice(w.profit)}</span>
                <span className="w-16 text-right text-xs text-accent-2">{w.orders.toFixed(1).replace(".", ",")} obj.</span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h2 className="mb-1 font-semibold text-ink">Nejlepší jednotlivé dny</h2>
          <p className="mb-3 text-xs text-accent-2">Podle zisku za posledních {days} dní.</p>
          {topDays.length === 0 ? (
            <p className="text-sm text-accent-2">V tomto období zatím žádné objednávky.</p>
          ) : (
            <ol className="flex flex-col divide-y divide-line text-sm">
              {topDays.map((p, i) => (
                <li key={p.day} className="flex items-center justify-between gap-3 py-2">
                  <span>
                    <span className="mr-2 text-accent-2">{i + 1}.</span>
                    {fmtDay(p.day)} <span className="text-accent-2">({WEEKDAYS[weekdayIndex(p.day)]})</span>
                  </span>
                  <span className="text-right">
                    <b>{formatPrice(p.profit)}</b> <span className="text-xs text-accent-2">zisk · {p.orders} obj. · obrat {formatPrice(p.revenue)}</span>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>

      {/* Repeat purchases */}
      <Card>
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-semibold text-ink">Opakované nákupy</h2>
          <Link href="/admin/zakaznici" className="text-sm text-accent underline">
            Seznam zákazníků →
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <div className="text-2xl font-bold text-ink">{repeat.customers}</div>
            <div className="text-xs text-accent-2">zákazníků celkem</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-ink">{repeat.repeatCustomers}</div>
            <div className="text-xs text-accent-2">koupilo víckrát ({repeat.customers ? Math.round((repeat.repeatCustomers / repeat.customers) * 1000) / 10 : 0} %)</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-ink">{repeat.matureCustomers ? `${Math.round(repeat.repeatRate * 1000) / 10} %` : "—"}</div>
            <div className="text-xs text-accent-2">se vrátilo (z těch, co kupovali před 30+ dny: {repeat.matureRepeat} z {repeat.matureCustomers})</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-ink">
              {repeat.medianDaysToSecond === null ? "—" : `${Math.round(repeat.medianDaysToSecond)} dní`}
            </div>
            <div className="text-xs text-accent-2">typicky mezi 1. a 2. nákupem</div>
          </div>
        </div>

        {repeat.cohorts.length > 0 && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[340px] text-sm">
              <thead className="text-left text-xs uppercase text-accent-2">
                <tr>
                  <th className="py-1 pr-3 font-normal">První nákup v měsíci</th>
                  <th className="py-1 pr-3 text-right font-normal">Zákazníků</th>
                  <th className="py-1 pr-3 text-right font-normal">Vrátilo se</th>
                  <th className="py-1 font-normal" />
                </tr>
              </thead>
              <tbody>
                {repeat.cohorts.map((c) => {
                  const pct = c.customers ? (c.repeat / c.customers) * 100 : 0;
                  return (
                    <tr key={c.month} className="border-t border-line">
                      <td className="py-1.5 pr-3">{c.month.slice(5)}/{c.month.slice(0, 4)}</td>
                      <td className="py-1.5 pr-3 text-right tabular-nums">{c.customers}</td>
                      <td className="py-1.5 pr-3 text-right tabular-nums">
                        {c.repeat} <span className="text-accent-2">({Math.round(pct * 10) / 10} %)</span>
                      </td>
                      <td className="w-1/3 py-1.5">
                        <div className="h-2 rounded-full bg-line/60">
                          <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, pct * 4)}%` }} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="mt-2 text-xs text-accent-2">Nové měsíce mají „vrátilo se“ zatím nízké — zákazník potřebuje čas na druhý nákup.</p>
          </div>
        )}

        {repeat.repeatList.length > 0 && (
          <div className="mt-4">
            <div className="mb-1 text-xs uppercase text-accent-2">Naši opakovaní zákazníci</div>
            <ul className="flex flex-col divide-y divide-line text-sm">
              {repeat.repeatList.slice(0, 8).map((r) => (
                <li key={r.email} className="flex items-center justify-between gap-3 py-1.5">
                  <Link href={`/admin/objednavky?q=${encodeURIComponent(r.email)}`} className="truncate hover:underline">
                    {r.name || r.email}
                  </Link>
                  <span className="shrink-0 text-accent-2">
                    {r.orders}× · {formatPrice(r.spent)} · naposledy {r.last.toLocaleDateString("cs-CZ")}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      {/* Top sellers / low stock */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-semibold text-ink">Nejprodávanější</h2>
          {topSellers.length === 0 ? (
            <p className="text-sm text-accent-2">Zatím žádná prodejní historie.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-line text-sm">
              {topSellers.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-2">
                  <Link href={`/admin/produkty/${p.id}`} className="truncate hover:underline">
                    {p.name}
                  </Link>
                  <span className="shrink-0 text-accent-2">
                    {p.salesCount} ks · sklad {p.stock}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="mb-3 font-semibold text-ink">Dochází na skladě</h2>
          {lowStock.length === 0 ? (
            <p className="text-sm text-accent-2">Žádné produkty pod {LOW_STOCK_THRESHOLD} ks.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-line text-sm">
              {lowStock.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-2">
                  <Link href={`/admin/produkty/${p.id}`} className="truncate hover:underline">
                    {p.name}
                  </Link>
                  <span className="shrink-0 font-medium text-red-600">{p.stock} ks</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-accent-2">{productCount} viditelných produktů v nabídce.</p>
        </Card>
      </div>
    </div>
  );
}
