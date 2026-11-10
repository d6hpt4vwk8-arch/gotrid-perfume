import Link from "next/link";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { findOrderIdsBySearch } from "@/lib/orders/search.server";
import { formatPrice, formatEurAmount } from "@/lib/format";
import { ORDER_STATUS_LABELS } from "@/lib/orders/status-labels";
import { getCustomerReputationMap } from "@/lib/customer-reputation";
import { getReturnStatsByMethod } from "@/lib/orders/return-stats.server";
import { SHIPPING_LABELS, PAYMENT_LABELS } from "@/lib/shipping";
import { OrderStatusQuickSelect } from "@/components/admin/order-status-quick-select";
import { OrderHoverRow } from "@/components/admin/order-hover-row";
import { OrderBulkLabels } from "@/components/admin/order-bulk-labels";
import { ParcelDot, ParcelIndicatorBadge } from "@/components/admin/parcel-dot";
import { getParcelIndicator, PARCEL_HOLDER_LABELS } from "@/lib/orders/parcel-indicator";
import type { OrderStatus, ShippingMethod } from "@prisma/client";

// Parcel filters offered as chips: who holds the parcel (me / carrier / customer) or everything urgent (red flag).
const PARCEL_FILTERS = ["urgent", "me", "carrier", "customer"] as const;
type ParcelFilter = (typeof PARCEL_FILTERS)[number];
const PARCEL_FILTER_LABELS: Record<ParcelFilter, string> = {
  urgent: "❗ Řešit hned",
  me: `📦 ${PARCEL_HOLDER_LABELS.me}`,
  carrier: `🚚 ${PARCEL_HOLDER_LABELS.carrier}`,
  customer: `📍 ${PARCEL_HOLDER_LABELS.customer}`,
};

const PAGE_SIZE = 30;

// SHIPPING_LABELS carries the full wording (pickup address, "(Slovensko)") — too long for a table cell.
const SHIPPING_SHORT: Record<ShippingMethod, string> = {
  ZASILKOVNA: "Zásilkovna",
  ZASILKOVNA_HD: "Zásilkovna SK",
  PPL: "PPL",
  DPD: "DPD",
  BALIKOVNA: "Balíkovna",
  GLS: "GLS kurýr",
  GLS_MISTO: "GLS místo",
  OSOBNI_ODBER: "Osobní odběr",
};

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string; q?: string; parcel?: string }>;
}) {
  const { status, page: pageParam, q, parcel: parcelParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const query = q?.trim() ?? "";
  const parcelFilter = PARCEL_FILTERS.find((t) => t === parcelParam);

  // Parcel lights for every order still in play (not delivered / cancelled), computed in memory: a few hundred rows.
  const now = new Date();
  const activeOrders = await prisma.order.findMany({
    where: {
      status: { in: ["NEW", "PAID", "PROCESSING", "SHIPPED"] },
      createdAt: { gte: new Date(now.getTime() - 90 * 86_400_000) },
    },
    select: {
      id: true,
      status: true,
      paymentMethod: true,
      shippingMethod: true,
      createdAt: true,
      trackingNumber: true,
      glsParcelNumber: true,
      packetaId: true,
      balikovnaParcelCode: true,
    },
  });
  const filterCounts = new Map<ParcelFilter, number>();
  const idsByFilter = new Map<ParcelFilter, string[]>();
  const addTo = (f: ParcelFilter, id: string) => {
    filterCounts.set(f, (filterCounts.get(f) ?? 0) + 1);
    idsByFilter.set(f, [...(idsByFilter.get(f) ?? []), id]);
  };
  for (const o of activeOrders) {
    const ind = getParcelIndicator(o, now);
    if (!ind || ind.holder === "closed") continue;
    addTo(ind.holder, o.id);
    if (ind.urgent) addTo("urgent", o.id);
  }
  const parcelWhere: Prisma.OrderWhereInput = parcelFilter ? { id: { in: idsByFilter.get(parcelFilter) ?? [] } } : {};

  const statusFilter: Prisma.OrderWhereInput =
    status && status in ORDER_STATUS_LABELS ? { status: status as OrderStatus } : {};
  // Word-by-word, accent-insensitive search over order number, name (first +
  // last typed together works), company, phone, e-mail and line items
  // (name / EAN / product code) — see findOrderIdsBySearch.
  const searchFilter: Prisma.OrderWhereInput = query
    ? { id: { in: await findOrderIdsBySearch(query) } }
    : {};
  const where: Prisma.OrderWhereInput = { AND: [statusFilter, searchFilter, parcelWhere] };

  const [orders, total, returnStats] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { items: { select: { name: true, qty: true, isGift: true }, orderBy: { name: "asc" } } },
    }),
    prisma.order.count({ where }),
    getReturnStatsByMethod(),
  ]);
  const reputationMap = await getCustomerReputationMap(orders.map((o) => o.email));
  const totalDelivered = returnStats.reduce((sum, r) => sum + r.delivered, 0);
  const totalReturned = returnStats.reduce((sum, r) => sum + r.returned, 0);
  const overallRate =
    totalDelivered + totalReturned > 0 ? (totalReturned / (totalDelivered + totalReturned)) * 100 : 0;

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  // Carries status (but never page — a new search/status always starts back
  // at page 1) forward through the pagination links below.
  const baseParams = {
    ...(status ? { status } : {}),
    ...(query ? { q: query } : {}),
    ...(parcelFilter ? { parcel: parcelFilter } : {}),
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink">Objednávky ({total})</h1>
        <a
          href={`/api/admin/orders/export${status ? `?status=${status}` : ""}`}
          className="rounded-sm border border-line px-4 py-2 text-sm font-medium hover:border-accent-2"
        >
          Export do XLSX
        </a>
      </div>

      <form method="get" className="flex gap-2">
        {status && <input type="hidden" name="status" value={status} />}
        {parcelFilter && <input type="hidden" name="parcel" value={parcelFilter} />}
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Číslo objednávky, jméno a příjmení, telefon, e-mail, EAN nebo název produktu…"
          className="w-full max-w-md rounded-sm border border-line px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="rounded-sm bg-ink px-4 py-2 text-sm font-medium text-white hover:bg-accent"
        >
          Hledat
        </button>
        {query && (
          <Link
            href={status ? `/admin/objednavky?status=${status}` : "/admin/objednavky"}
            className="rounded-sm border border-line px-4 py-2 text-sm hover:border-accent-2"
          >
            Zrušit
          </Link>
        )}
      </form>

      {totalDelivered + totalReturned > 0 && (
        <div className="rounded-sm border border-line bg-white p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-accent-2">
              Nevyzvednuté zásilky (vráceno dopravcem)
            </span>
            <span
              className={`text-sm font-bold ${overallRate > 10 ? "text-red-600" : "text-ink"}`}
            >
              {overallRate.toFixed(1)} % celkem ({totalReturned} z {totalDelivered + totalReturned})
            </span>
          </div>
          <table className="mt-3 w-full text-sm">
            <thead className="text-left text-xs uppercase text-accent-2">
              <tr>
                <th className="py-1">Doprava</th>
                <th className="py-1 text-right">Doručeno</th>
                <th className="py-1 text-right">Vráceno</th>
                <th className="py-1 text-right">Podíl vrácených</th>
              </tr>
            </thead>
            <tbody>
              {returnStats.map((row) => (
                <tr key={row.method} className="border-t border-line">
                  <td className="py-1.5">{SHIPPING_LABELS[row.method]}</td>
                  <td className="py-1.5 text-right">{row.delivered}</td>
                  <td className="py-1.5 text-right">{row.returned}</td>
                  <td
                    className={`py-1.5 text-right font-medium ${
                      row.ratePercent > 10 ? "text-red-600" : "text-ink"
                    }`}
                  >
                    {row.ratePercent.toFixed(1)} %
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-wrap gap-2 text-sm">
        <Link
          href={query ? `/admin/objednavky?q=${encodeURIComponent(query)}` : "/admin/objednavky"}
          className={`rounded-full border px-3 py-1 ${!status ? "border-ink bg-ink text-white" : "border-line"}`}
        >
          Vše
        </Link>
        {Object.entries(ORDER_STATUS_LABELS).map(([value, label]) => (
          <Link
            key={value}
            href={`/admin/objednavky?${new URLSearchParams({ status: value, ...(query ? { q: query } : {}) })}`}
            className={`rounded-full border px-3 py-1 ${status === value ? "border-ink bg-ink text-white" : "border-line"}`}
          >
            {label}
          </Link>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-xs font-semibold uppercase text-accent-2">Zásilky:</span>
        {PARCEL_FILTERS.map((f) => {
          const count = filterCounts.get(f) ?? 0;
          const active = parcelFilter === f;
          return (
            <Link
              key={f}
              href={
                active
                  ? `/admin/objednavky${query ? `?q=${encodeURIComponent(query)}` : ""}`
                  : `/admin/objednavky?${new URLSearchParams({ parcel: f, ...(query ? { q: query } : {}) })}`
              }
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 ${
                active ? "border-ink bg-ink text-white" : f === "urgent" && count > 0 ? "border-red-300 bg-red-50 font-semibold text-red-800" : "border-line"
              }`}
            >
              {PARCEL_FILTER_LABELS[f]} ({count})
            </Link>
          );
        })}
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1 px-1 text-xs text-accent-2">
          <span className="inline-flex items-center gap-1.5"><ParcelDot tone="red" /> řešit hned</span>
          <span className="inline-flex items-center gap-1.5"><ParcelDot tone="amber" /> je na mně</span>
          <span className="inline-flex items-center gap-1.5"><ParcelDot tone="slate" /> čeká (dopravce / zákazník)</span>
          <span className="inline-flex items-center gap-1.5"><ParcelDot tone="green" /> doručeno</span>
        </span>
      </div>

      <OrderBulkLabels />

      <div className="overflow-x-auto rounded-sm border border-line bg-white">
        <table className="w-full min-w-[600px] text-sm">
          <thead className="border-b border-line bg-white text-left text-xs uppercase text-accent-2">
            <tr>
              <th className="w-8 px-3 py-2" />
              <th className="px-3 py-2">Číslo</th>
              <th className="px-3 py-2">Datum</th>
              <th className="px-3 py-2">Zákazník</th>
              <th className="px-3 py-2">Celkem</th>
              <th className="px-3 py-2">Doprava</th>
              <th className="px-3 py-2">Zásilka</th>
              <th className="px-3 py-2">Stav</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <OrderHoverRow
                key={o.id}
                className="border-b border-line last:border-0 hover:bg-white"
                preview={{
                  number: o.number,
                  customer: `${o.firstName} ${o.lastName}`,
                  items: o.items,
                  shipping: SHIPPING_LABELS[o.shippingMethod],
                  payment: PAYMENT_LABELS[o.paymentMethod],
                  total: formatPrice(o.total),
                  note: o.customerNote,
                  tracking: o.trackingNumber,
                }}
              >
                <td className="px-3 py-2">
                  <input type="checkbox" data-order-select value={o.id} aria-label={`Vybrat ${o.number}`} />
                </td>
                <td className="px-3 py-2">
                  <Link href={`/admin/objednavky/${o.id}`} className="font-medium hover:underline">
                    {o.number}
                  </Link>
                  {o.giftSticker && (
                    <span title="Dárek: nalepit štítek s přáním" className="ml-1.5">
                      🎁
                    </span>
                  )}
                  {o.customerNote && (
                    <span title={o.customerNote} className="ml-1.5">
                      📝
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-accent-2">
                  {new Date(o.createdAt).toLocaleString("cs-CZ")}
                </td>
                <td className="px-3 py-2">
                  {o.firstName} {o.lastName}
                  {reputationMap.get(o.email)?.risk && (
                    <span title="Má zrušenou/vrácenou objednávku" className="ml-1.5">
                      😠
                    </span>
                  )}
                  {reputationMap.get(o.email)?.repeat && (
                    <span title="Stálý zákazník (2+ objednávky)" className="ml-1.5">
                      😊
                    </span>
                  )}
                  {o.trafficSource && (
                    <div className="text-xs text-accent-2">{o.trafficSource}</div>
                  )}
                </td>
                <td className="px-3 py-2">
                  {formatPrice(o.total)}
                  {o.chargedCurrency === "EUR" && o.chargedAmount && (
                    <div className="text-xs text-accent-2">klientovi {formatEurAmount(o.chargedAmount)}</div>
                  )}
                </td>
                <td className="px-3 py-2">
                  {/* Personal pickups have no label to print and no parcel to hand over, so they're easy to forget — make them stand out. */}
                  <span
                    className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${
                      o.shippingMethod === "OSOBNI_ODBER" ? "bg-amber-100 text-amber-900" : "bg-stone-100 text-accent"
                    }`}
                  >
                    {SHIPPING_SHORT[o.shippingMethod]}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <ParcelIndicatorBadge indicator={getParcelIndicator(o, now)} />
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1.5">
                    <OrderStatusQuickSelect
                      orderId={o.id}
                      status={o.status}
                      trackingNumber={o.trackingNumber}
                      weight={o.weight.toString()}
                    />
                    {o.paymentMethod === "CARD" && o.status === "NEW" && (
                      <span
                        title="Platba kartou zatím nepotvrzena — nevyřizovat, dokud se nezmění na Zaplaceno"
                        className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700"
                      >
                        ⚠ čeká na platbu
                      </span>
                    )}
                  </div>
                </td>
              </OrderHoverRow>
            ))}
            {orders.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-accent-2">
                  {query ? `Žádné objednávky neodpovídají „${query}“.` : "Žádné objednávky."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <Link
              key={p}
              href={`/admin/objednavky?${new URLSearchParams({ ...baseParams, page: String(p) })}`}
              className={`rounded px-3 py-1 text-sm ${
                p === page ? "bg-ink text-white" : "border border-line"
              }`}
            >
              {p}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
