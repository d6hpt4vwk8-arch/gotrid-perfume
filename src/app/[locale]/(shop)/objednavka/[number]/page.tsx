import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

import { getCurrentLocale, getTr } from "@/i18n/tr.server";
import { calculateSklikConversionValue } from "@/lib/sklik";
import { SklikConversion } from "@/components/sklik-conversion";
import { HeurekaConversion } from "@/components/heureka-conversion";
import { GlamiConversion } from "@/components/glami-conversion";
import { PAYMENT_LABELS, PICKUP_ADDRESS, SHIPPING_LABELS } from "@/lib/shipping";
import { ShippingIcon } from "@/components/shipping-icons";
import { ORDER_STATUS_LABELS, canDownloadInvoice } from "@/lib/orders/status-labels";
import { bankQrDataUrl, getBankPayment } from "@/lib/payments/bank-details";
import { orderMoney } from "@/lib/orders/order-money";
import { localizedItemNames } from "@/lib/orders/item-names";
import { FACEBOOK_URL, INSTAGRAM_HANDLE, INSTAGRAM_URL, TIKTOK_URL } from "@/lib/site";
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
  const tr = await getTr();
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

  // Orders paid by card in EUR carry a snapshot of the charged amount; show
  // every line in euros at that same ratio so the page matches the receipt.
  const money = orderMoney(order);
  const itemNames = await localizedItemNames(order.items, await getCurrentLocale());

  const sklikConversionValue = calculateSklikConversionValue(
    order.items.map((item) => ({
      unitPrice: Number(item.unitPrice),
      qty: item.qty,
      vatRate: item.vatRate,
    })),
    Number(order.discountAmount),
  );

  const bank = getBankPayment(order);
  const qrDataUrl = bank ? await bankQrDataUrl(bank) : null;

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
      <GlamiConversion
        orderId={order.number}
        itemIds={order.items.map((item) => item.product?.code ?? item.ean ?? item.name)}
        value={Number(order.total)}
        createdAt={order.createdAt.toISOString()}
      />
      <h1 className="text-2xl font-bold text-ink">{tr("Děkujeme za objednávku!")}</h1>
      <p className="text-ink/70">
        {tr("Číslo objednávky")} <strong className="text-ink">{order.number}</strong>. {tr("Potvrzení jsme poslali na")} {order.email}.
      </p>

      <div className="flex flex-col gap-1 border border-line bg-line/30 p-4 text-sm text-ink">
        <span>
          {tr("Stav objednávky")}: <strong>{tr(ORDER_STATUS_LABELS[order.status])}</strong>
        </span>
        {order.trackingNumber && (
          <span>
            {tr("Sledovací číslo zásilky")}:{" "}
            {order.shippingMethod === "GLS" || order.shippingMethod === "GLS_MISTO" ? (
              <a
                href={`https://gls-group.com/CZ/cs/sledovani-zasilek?match=${order.trackingNumber}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold underline"
              >
                {order.trackingNumber}
              </a>
            ) : (
              <strong>{order.trackingNumber}</strong>
            )}
          </span>
        )}
      </div>

      <ul className="flex flex-col divide-y divide-line border-y border-line">
        {order.items.map((item) => (
          <li key={item.id} className="flex justify-between py-3 text-sm text-ink">
            <span>
              {itemNames.get(item.id) ?? item.name}
              {item.isGift && <span className="text-ok"> — {tr("dárek zdarma")}</span>} × {item.qty}
            </span>
            <span>{money(Number(item.unitPrice) * item.qty)}</span>
          </li>
        ))}
      </ul>

      <div className="flex flex-col gap-1 text-sm text-ink">
        <div className="flex justify-between">
          <span>{tr("Doprava")}</span>
          <span className="flex items-center gap-2">
            <ShippingIcon method={order.shippingMethod} />
            {tr(SHIPPING_LABELS[order.shippingMethod])}
          </span>
        </div>
        <div className="flex justify-between">
          <span>{tr("Platba")}</span>
          <span>{tr(PAYMENT_LABELS[order.paymentMethod])}</span>
        </div>
        {Number(order.codSurcharge) > 0 && (
          <div className="flex justify-between">
            <span>{tr("Příplatek za dobírku")}</span>
            <span>{money(order.codSurcharge)}</span>
          </div>
        )}
        {Number(order.discountAmount) > 0 && (
          <div className="flex justify-between text-ok">
            <span>{tr("Sleva")} {order.couponCode && `(${order.couponCode})`}</span>
            <span>−{money(order.discountAmount)}</span>
          </div>
        )}
        <div className="flex justify-between text-base font-bold">
          <span>{tr("Celkem")}</span>
          <span className="text-accent">{money(order.total)}</span>
        </div>
      </div>

      {order.paymentMethod === "BANK_TRANSFER" && order.status === "NEW" && (
        <div className="border border-line p-4">
          <h2 className="mb-2 text-sm font-semibold text-ink">{tr("Platba převodem")}</h2>
          {qrDataUrl && bank ? (
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <Image src={qrDataUrl} alt={tr("QR platba")} width={140} height={140} unoptimized />
              <div className="flex flex-col gap-2 text-sm text-ink/70">
                <p>{tr("Naskenujte QR kód v bankovní aplikaci, nebo zadejte platbu ručně.")}</p>
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
                  {bank.account && (
                    <>
                      <dt>{tr("Číslo účtu")}</dt>
                      <dd className="font-semibold text-ink">{bank.account}</dd>
                    </>
                  )}
                  <dt>IBAN</dt>
                  <dd className="font-semibold text-ink">{bank.iban}</dd>
                  {bank.bic && (
                    <>
                      <dt>BIC</dt>
                      <dd className="font-semibold text-ink">{bank.bic}</dd>
                    </>
                  )}
                  <dt>{tr("Příjemce")}</dt>
                  <dd className="font-semibold text-ink">{bank.beneficiary}</dd>
                  <dt>{tr("Částka")}</dt>
                  <dd className="font-semibold text-ink">{bank.amountLabel}</dd>
                  <dt>{tr("Variabilní symbol")}</dt>
                  <dd className="font-semibold text-ink">{bank.variableSymbol}</dd>
                </dl>
              </div>
            </div>
          ) : (
            <p className="text-sm text-ink/70">
              {tr("Platební údaje pro bankovní převod vám zašleme e-mailem, jakmile bude dokončeno nastavení účtu.")}
            </p>
          )}
        </div>
      )}

      {order.paymentMethod === "CASH_ON_DELIVERY" && (
        <p className="bg-line/30 p-4 text-sm text-ink/80">
          {tr("Objednávku zaplatíte v hotovosti nebo kartou při převzetí zásilky.")}
        </p>
      )}

      {order.shippingMethod === "OSOBNI_ODBER" && (
        <p className="bg-line/30 p-4 text-sm text-ink/80">
          {tr("Zboží si vyzvednete osobně na adrese")} <strong className="text-ink">{PICKUP_ADDRESS}</strong>.{" "}
          {tr("Jakmile bude objednávka připravená, ozveme se vám s termínem vyzvednutí.")}
        </p>
      )}

      {canDownloadInvoice(order.status) ? (
        <a
          href={`/api/orders/${order.number}/faktura`}
          target="_blank"
          rel="noreferrer"
          className="text-sm font-medium text-accent underline"
        >
          {tr("Stáhnout fakturu (PDF)")}
        </a>
      ) : (
        <p className="text-sm text-ink/70">
          {tr("Faktura bude k dispozici po zaplacení nebo vyřízení objednávky.")}
        </p>
      )}

      <div className="flex flex-col gap-1 border border-line p-4 text-sm">
        <span className="font-semibold text-ink">{tr("Sledujte nás")}</span>
        <span className="text-ink/70">{tr("Tipy na vůně a péči, novinky a ukázky našich produktů.")}</span>
        <span className="mt-1 flex flex-wrap gap-x-5 gap-y-1 font-medium text-ink">
          {[
            [INSTAGRAM_URL, `Instagram @${INSTAGRAM_HANDLE}`],
            [FACEBOOK_URL, "Facebook"],
            [TIKTOK_URL, "TikTok"],
          ].map(([href, label]) => (
            <a key={href} href={href} target="_blank" rel="noopener noreferrer" className="underline">
              {label} →
            </a>
          ))}
        </span>
      </div>

      <Link href="/" className="text-sm text-accent-2 hover:text-accent hover:underline">
        {tr("Zpět na hlavní stránku")}
      </Link>
    </main>
  );
}
