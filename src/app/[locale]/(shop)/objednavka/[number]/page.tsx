import Image from "next/image";
import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/format";
import { calculateSklikConversionValue } from "@/lib/sklik";
import { SklikConversion } from "@/components/sklik-conversion";
import { HeurekaConversion } from "@/components/heureka-conversion";
import { PAYMENT_LABELS, PICKUP_ADDRESS, SHIPPING_LABELS } from "@/lib/shipping";
import { ShippingIcon } from "@/components/shipping-icons";
import { ORDER_STATUS_LABELS } from "@/lib/orders/status-labels";
import { generateQrPlatbaDataUrl } from "@/lib/payments/qr-platba";
import { getCurrentCustomerId } from "@/lib/customer/get-current-customer";
import {
  ADMIN_COOKIE_NAME,
  ORDER_ACCESS_COOKIE_NAME,
  verifyOrderAccess,
} from "@/lib/orders/verify-access";

export default async function OrderConfirmationPage({
  params,
}: {
  params: Promise<{ number: string }>;
}) {
  const { number } = await params;
  const order = await prisma.order.findUnique({
    where: { number },
    include: { items: { include: { product: { select: { code: true } } } } },
  });
  if (!order) notFound();

  const [cookieStore, customerId] = await Promise.all([cookies(), getCurrentCustomerId()]);
  const hasAccess = await verifyOrderAccess(order, {
    cookieToken: cookieStore.get(ORDER_ACCESS_COOKIE_NAME)?.value,
    adminCookie: cookieStore.get(ADMIN_COOKIE_NAME)?.value,
    customerId,
  });
  if (!hasAccess) notFound();

  const sklikConversionValue = calculateSklikConversionValue(
    order.items.map((item) => ({
      unitPrice: Number(item.unitPrice),
      qty: item.qty,
      vatRate: item.vatRate,
    })),
    Number(order.discountAmount),
  );

  const iban = process.env.BANK_IBAN;
  const qrDataUrl =
    order.paymentMethod === "BANK_TRANSFER" && iban
      ? await generateQrPlatbaDataUrl({
          iban,
          amount: Number(order.total),
          variableSymbol: order.number,
          message: `Objednavka ${order.number}`,
        })
      : null;

  return (
    <main className="mx-auto flex max-w-2xl flex-1 flex-col gap-6 px-4 py-10">
      <SklikConversion orderId={order.number} value={sklikConversionValue} />
      <HeurekaConversion
        orderId={order.number}
        items={order.items.map((item) => ({
          itemId: item.product?.code ?? item.ean ?? item.name,
          name: item.name,
          unitPrice: Number(item.unitPrice),
          qty: item.qty,
        }))}
        totalVat={Number(order.total)}
      />
      <h1 className="text-2xl font-bold text-ink">Děkujeme za objednávku!</h1>
      <p className="text-ink/70">
        Číslo objednávky <strong className="text-ink">{order.number}</strong>. Potvrzení jsme
        poslali na {order.email}.
      </p>

      <div className="flex flex-col gap-1 border border-line bg-line/30 p-4 text-sm text-ink">
        <span>
          Stav objednávky: <strong>{ORDER_STATUS_LABELS[order.status]}</strong>
        </span>
        {order.trackingNumber && (
          <span>
            Sledovací číslo zásilky: <strong>{order.trackingNumber}</strong>
          </span>
        )}
      </div>

      <ul className="flex flex-col divide-y divide-line border-y border-line">
        {order.items.map((item) => (
          <li key={item.id} className="flex justify-between py-3 text-sm text-ink">
            <span>
              {item.name} × {item.qty}
            </span>
            <span>{formatPrice(Number(item.unitPrice) * item.qty)}</span>
          </li>
        ))}
      </ul>

      <div className="flex flex-col gap-1 text-sm text-ink">
        <div className="flex justify-between">
          <span>Doprava</span>
          <span className="flex items-center gap-2">
            <ShippingIcon method={order.shippingMethod} />
            {SHIPPING_LABELS[order.shippingMethod]}
          </span>
        </div>
        <div className="flex justify-between">
          <span>Platba</span>
          <span>{PAYMENT_LABELS[order.paymentMethod]}</span>
        </div>
        {Number(order.codSurcharge) > 0 && (
          <div className="flex justify-between">
            <span>Příplatek za dobírku</span>
            <span>{formatPrice(order.codSurcharge)}</span>
          </div>
        )}
        {Number(order.discountAmount) > 0 && (
          <div className="flex justify-between text-ok">
            <span>Sleva {order.couponCode && `(${order.couponCode})`}</span>
            <span>−{formatPrice(order.discountAmount)}</span>
          </div>
        )}
        <div className="flex justify-between text-base font-bold">
          <span>Celkem</span>
          <span className="text-accent">{formatPrice(order.total)}</span>
        </div>
      </div>

      {order.paymentMethod === "BANK_TRANSFER" && (
        <div className="border border-line p-4">
          <h2 className="mb-2 text-sm font-semibold text-ink">Platba převodem</h2>
          {qrDataUrl ? (
            <div className="flex items-center gap-4">
              <Image src={qrDataUrl} alt="QR platba" width={140} height={140} unoptimized />
              <p className="text-sm text-ink/70">
                Naskenujte QR kód v bankovní aplikaci, nebo zadejte platbu ručně s variabilním
                symbolem <strong className="text-ink">{order.number.replace(/\D/g, "")}</strong>{" "}
                a částkou <strong className="text-ink">{formatPrice(order.total)}</strong>.
              </p>
            </div>
          ) : (
            <p className="text-sm text-ink/70">
              Platební údaje pro bankovní převod vám zašleme e-mailem, jakmile bude dokončeno
              nastavení účtu.
            </p>
          )}
        </div>
      )}

      {order.paymentMethod === "CASH_ON_DELIVERY" && (
        <p className="bg-line/30 p-4 text-sm text-ink/80">
          Objednávku zaplatíte v hotovosti nebo kartou při převzetí zásilky.
        </p>
      )}

      {order.shippingMethod === "OSOBNI_ODBER" && (
        <p className="bg-line/30 p-4 text-sm text-ink/80">
          Zboží si vyzvednete osobně na adrese <strong className="text-ink">{PICKUP_ADDRESS}</strong>.
          Jakmile bude objednávka připravená, ozveme se vám s termínem vyzvednutí.
        </p>
      )}

      <a
        href={`/api/orders/${order.number}/faktura`}
        target="_blank"
        rel="noreferrer"
        className="text-sm font-medium text-accent underline"
      >
        Stáhnout fakturu (PDF)
      </a>

      <Link href="/" className="text-sm text-accent-2 hover:text-accent hover:underline">
        Zpět na hlavní stránku
      </Link>
    </main>
  );
}
