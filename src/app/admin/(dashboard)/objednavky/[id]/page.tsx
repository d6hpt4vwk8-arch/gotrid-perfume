import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/format";
import { SHIPPING_LABELS, PAYMENT_LABELS } from "@/lib/shipping";
import { ORDER_STATUS_LABELS } from "@/lib/orders/status-labels";
import { updateOrderStatus } from "@/lib/admin/actions/orders";
import { getCustomerReputationMap } from "@/lib/customer-reputation";

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      customer: true,
      items: {
        include: { product: { include: { images: { take: 1, orderBy: { sortOrder: "asc" } } } } },
      },
    },
  });
  if (!order) notFound();
  const reputation = (await getCustomerReputationMap([order.email])).get(order.email);
  const awaitingPayment = order.paymentMethod === "CARD" && order.status === "NEW";

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      {awaitingPayment && (
        <div className="rounded-sm border border-red-300 bg-red-50 p-4 text-sm font-medium text-red-800">
          ⚠ Platba kartou zatím nebyla potvrzena. Nevyřizujte a neodesílejte tuto objednávku,
          dokud stav nezmění na „Zaplacená“ — pokud zákazník platbu nedokončí, objednávka se do
          2 hodin automaticky zruší a sklad se uvolní.
        </div>
      )}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink">Objednávka {order.number}</h1>
        <div className="flex items-center gap-4">
          {order.shippingMethod === "ZASILKOVNA" && (
            <a
              href={`/api/admin/orders/${order.id}/label`}
              target="_blank"
              rel="noreferrer"
              className="text-sm font-medium underline"
            >
              Štítek Zásilkovna (PDF)
            </a>
          )}
          <a
            href={`/api/orders/${order.number}/faktura`}
            target="_blank"
            rel="noreferrer"
            className="text-sm font-medium underline"
          >
            Faktura (PDF)
          </a>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6 rounded-sm border border-line bg-white p-4 text-sm">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase text-accent-2">Zákazník</span>
          <span>
            {order.firstName} {order.lastName}
            {reputation?.risk && (
              <span title="Má zrušenou/vrácenou objednávku" className="ml-1.5">
                😠
              </span>
            )}
            {reputation?.repeat && (
              <span title="Stálý zákazník (2+ objednávky)" className="ml-1.5">
                😊
              </span>
            )}
          </span>
          <span>{order.email}</span>
          <span>{order.phone}</span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase text-accent-2">Doprava a platba</span>
          <span>{SHIPPING_LABELS[order.shippingMethod]}</span>
          <span>{PAYMENT_LABELS[order.paymentMethod]}</span>
          {order.pickupPointId && <span>Výdejní místo: {order.pickupPointId}</span>}
          {order.shippingStreet && (
            <span>
              {order.shippingStreet}, {order.shippingPostalCode} {order.shippingCity}
            </span>
          )}
        </div>
      </div>

      <div className="rounded-sm border border-line bg-white p-4">
        <span className="mb-2 block text-xs font-semibold uppercase text-accent-2">
          Položky
        </span>
        <ul className="flex flex-col divide-y divide-line text-sm">
          {order.items.map((item) => {
            const image = item.product?.images[0];
            const thumb = image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={image.url}
                alt=""
                className="h-12 w-12 shrink-0 rounded-sm border border-line object-cover"
              />
            ) : (
              <div className="h-12 w-12 shrink-0 rounded-sm border border-line bg-line/30" />
            );
            const details = (
              <span className="flex flex-col">
                <span>
                  {item.name} × {item.qty}
                </span>
                {item.ean && <span className="text-xs text-accent-2">EAN: {item.ean}</span>}
              </span>
            );
            return (
              <li key={item.id} className="flex items-center justify-between gap-3 py-2">
                {item.productId ? (
                  <Link
                    href={`/admin/produkty/${item.productId}`}
                    target="_blank"
                    className="flex min-w-0 flex-1 items-center gap-3 hover:underline"
                  >
                    {thumb}
                    {details}
                  </Link>
                ) : (
                  <span className="flex min-w-0 flex-1 items-center gap-3">
                    {thumb}
                    {details}
                  </span>
                )}
                <span className="shrink-0">{formatPrice(Number(item.unitPrice) * item.qty)}</span>
              </li>
            );
          })}
        </ul>
        <div className="mt-3 flex flex-col gap-1 border-t border-line pt-3 text-sm">
          <div className="flex justify-between text-accent-2">
            <span>Doprava</span>
            <span>{formatPrice(order.shippingPrice)}</span>
          </div>
          {Number(order.codSurcharge) > 0 && (
            <div className="flex justify-between text-accent-2">
              <span>Příplatek za dobírku</span>
              <span>{formatPrice(order.codSurcharge)}</span>
            </div>
          )}
          {Number(order.discountAmount) > 0 && (
            <div className="flex justify-between text-green-700">
              <span>Sleva {order.couponCode && `(${order.couponCode})`}</span>
              <span>−{formatPrice(order.discountAmount)}</span>
            </div>
          )}
          <div className="flex justify-between font-semibold">
            <span>Celkem</span>
            <span>{formatPrice(order.total)}</span>
          </div>
        </div>
      </div>

      <div className="rounded-sm border border-line bg-white p-4">
        <span className="mb-2 block text-xs font-semibold uppercase text-accent-2">Stav</span>
        <form action={updateOrderStatus.bind(null, order.id)} className="flex flex-wrap items-center gap-3">
          <select
            name="status"
            defaultValue={order.status}
            className="rounded-sm border border-line px-3 py-2 text-sm"
          >
            {Object.entries(ORDER_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <input
            name="trackingNumber"
            placeholder="Sledovací číslo zásilky"
            defaultValue={order.trackingNumber ?? ""}
            className="rounded-sm border border-line px-3 py-2 text-sm"
          />
          {order.shippingMethod === "ZASILKOVNA" && (
            <label className="flex items-center gap-2 text-sm text-accent-2">
              Váha (kg)
              <input
                name="weight"
                type="number"
                step="0.1"
                min="0.1"
                defaultValue={order.weight.toString()}
                className="w-20 rounded-sm border border-line px-3 py-2 text-sm"
              />
            </label>
          )}
          <button
            type="submit"
            className="rounded-sm bg-ink px-4 py-2 text-sm font-medium text-white hover:bg-accent"
          >
            Uložit
          </button>
        </form>
        {order.packetaId && (
          <p className="mt-3 text-xs text-accent-2">Packeta ID zásilky: {order.packetaId}</p>
        )}
      </div>
    </div>
  );
}
