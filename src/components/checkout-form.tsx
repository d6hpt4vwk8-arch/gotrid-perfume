"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useCart } from "@/lib/cart-context";
import { useConsent } from "@/lib/consent-context";
import { formatPrice } from "@/lib/format";
import { PAYMENT_LABELS, SHIPPING_LABELS, getCodSurcharge, getShippingPrice } from "@/lib/shipping";
import type { ShopSettings } from "@/lib/settings.server";
import { ZasilkovnaPicker } from "@/components/zasilkovna-picker";
import { BalikovnaPicker } from "@/components/balikovna-picker";
import { CustomerLogoutButton } from "@/components/customer/logout-button";
import { TrustBadges } from "@/components/trust-badges";
import type { Customer } from "@prisma/client";

type ShippingMethod = keyof typeof SHIPPING_LABELS;
type PaymentMethod = keyof typeof PAYMENT_LABELS;

function CheckoutSteps({ steps }: { steps: { label: string; done: boolean }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs font-medium">
      {steps.map((step, i) => (
        <div key={step.label} className="flex items-center gap-2">
          <span
            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] ${
              step.done ? "bg-ink text-white" : "border border-line text-accent-2"
            }`}
          >
            {step.done ? "✓" : i + 1}
          </span>
          <span className={step.done ? "text-ink" : "text-accent-2"}>{step.label}</span>
          {i < steps.length - 1 && <span className="h-px w-4 bg-line" aria-hidden />}
        </div>
      ))}
    </div>
  );
}

export function CheckoutForm({
  settings,
  customer,
}: {
  settings: ShopSettings;
  customer: Customer | null;
}) {
  const { items, total: itemsTotal, clear } = useCart();
  const { consent } = useConsent();

  const [email, setEmail] = useState(customer?.email ?? "");
  const [phone, setPhone] = useState(customer?.phone ?? "");
  const [firstName, setFirstName] = useState(customer?.firstName ?? "");
  const [lastName, setLastName] = useState(customer?.lastName ?? "");
  const [shippingMethod, setShippingMethod] = useState<ShippingMethod>("ZASILKOVNA");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("BANK_TRANSFER");
  const [pickupPoint, setPickupPoint] = useState<{ id: string; name: string } | null>(null);
  const [street, setStreet] = useState(customer?.addressStreet ?? "");
  const [city, setCity] = useState(customer?.addressCity ?? "");
  const [postalCode, setPostalCode] = useState(customer?.addressPostalCode ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [couponInput, setCouponInput] = useState("");
  const [coupon, setCoupon] = useState<{ code: string; discountAmount: number } | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [couponChecking, setCouponChecking] = useState(false);

  const shippingPrice = useMemo(
    () => getShippingPrice(shippingMethod, itemsTotal, settings),
    [shippingMethod, itemsTotal, settings],
  );
  const codSurcharge = useMemo(
    () => getCodSurcharge(paymentMethod, settings),
    [paymentMethod, settings],
  );
  const total = itemsTotal + shippingPrice + codSurcharge - (coupon?.discountAmount ?? 0);

  const usesPickupPoint = shippingMethod === "ZASILKOVNA" || shippingMethod === "BALIKOVNA";

  const contactDone = Boolean(email.trim() && phone.trim() && firstName.trim() && lastName.trim());
  const shippingDone =
    contactDone &&
    (usesPickupPoint
      ? Boolean(pickupPoint)
      : Boolean(street.trim() && city.trim() && postalCode.trim()));
  // Payment always has a pre-selected default, so it only counts as "reached"
  // once the earlier steps are actually filled in — otherwise it'd show as
  // done before the visitor has typed anything.
  const steps = [
    { label: "Kontakt", done: contactDone },
    { label: "Doprava", done: shippingDone },
    { label: "Platba", done: shippingDone },
    { label: "Hotovo", done: false },
  ];

  async function applyCoupon() {
    if (!couponInput.trim()) return;
    setCouponChecking(true);
    setCouponError(null);
    try {
      const res = await fetch("/api/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: couponInput.trim(), itemsTotal }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCoupon(null);
        setCouponError(data.error ?? "Slevový kód se nepodařilo ověřit.");
        return;
      }
      setCoupon(data);
    } catch {
      setCoupon(null);
      setCouponError("Slevový kód se nepodařilo ověřit.");
    } finally {
      setCouponChecking(false);
    }
  }

  if (items.length === 0) {
    return (
      <main className="mx-auto flex max-w-3xl flex-1 flex-col items-center gap-4 px-4 py-20 text-center">
        <h1 className="text-2xl font-bold text-ink">Košík je prázdný</h1>
        <Link href="/" className="rounded-sm bg-ink px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent">
          Zpět na výběr produktů
        </Link>
      </main>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          phone,
          firstName,
          lastName,
          shippingMethod,
          paymentMethod,
          pickupPointId: usesPickupPoint ? pickupPoint?.id : undefined,
          shippingStreet: !usesPickupPoint ? street : undefined,
          shippingCity: !usesPickupPoint ? city : undefined,
          shippingPostalCode: !usesPickupPoint ? postalCode : undefined,
          items: items.map((i) => ({ productId: i.productId, qty: i.qty })),
          marketingConsent: Boolean(consent?.marketing),
          couponCode: coupon?.code,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Objednávku se nepodařilo odeslat.");
        setSubmitting(false);
        return;
      }

      clear();
      if (data.redirectUrl) {
        window.location.href = data.redirectUrl;
      } else {
        // Full navigation (not router.push) so the browser actually hits the
        // Route Handler and picks up the HttpOnly access cookie it sets —
        // keeps the token out of the URL bar/history, see that route's comment.
        window.location.href = `/api/orders/${data.orderNumber}/access?token=${data.accessToken}`;
      }
    } catch {
      setError("Objednávku se nepodařilo odeslat, zkuste to prosím znovu.");
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex max-w-4xl flex-1 flex-col gap-8 px-4 py-10 md:flex-row">
      <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-6">
        <h1 className="text-2xl font-bold text-ink">Pokladna</h1>

        <CheckoutSteps steps={steps} />

        {customer && (
          <div className="flex items-center justify-between rounded-sm border border-line bg-line/20 px-3 py-2 text-sm text-ink">
            <span>
              Přihlášen jako <strong>{customer.email}</strong>
            </span>
            <CustomerLogoutButton />
          </div>
        )}

        <fieldset className="flex flex-col gap-3">
          <legend className="mb-1 text-sm font-semibold text-ink">Kontaktní údaje</legend>
          <input
            required
            type="email"
            name="email"
            autoComplete="email"
            placeholder="E-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-sm border border-line px-3 py-2 text-sm text-ink"
          />
          <input
            required
            type="tel"
            name="tel"
            autoComplete="tel"
            placeholder="Telefon"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="rounded-sm border border-line px-3 py-2 text-sm text-ink"
          />
          <div className="flex gap-3">
            <input
              required
              name="given-name"
              autoComplete="given-name"
              placeholder="Jméno"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="w-full rounded-sm border border-line px-3 py-2 text-sm text-ink"
            />
            <input
              required
              name="family-name"
              autoComplete="family-name"
              placeholder="Příjmení"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="w-full rounded-sm border border-line px-3 py-2 text-sm text-ink"
            />
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-semibold text-ink">Doprava</legend>
          {(Object.keys(SHIPPING_LABELS) as ShippingMethod[]).map((method) => (
            <label key={method} className="flex items-center gap-2 text-sm text-ink">
              <input
                type="radio"
                name="shippingMethod"
                checked={shippingMethod === method}
                onChange={() => {
                  setShippingMethod(method);
                  // Point IDs are method-specific (Zásilkovna's widget ID vs.
                  // a Balíkovna address string) — carrying a stale selection
                  // across a method switch would submit it under the wrong method.
                  setPickupPoint(null);
                }}
                className="accent-accent"
              />
              {SHIPPING_LABELS[method]} —{" "}
              {itemsTotal >= settings.freeShippingThreshold
                ? "zdarma"
                : formatPrice(settings.shippingPrices[method])}
            </label>
          ))}

          {shippingMethod === "ZASILKOVNA" ? (
            <div className="pt-2">
              <ZasilkovnaPicker
                selectedPointName={pickupPoint?.name ?? null}
                onSelect={setPickupPoint}
              />
            </div>
          ) : shippingMethod === "BALIKOVNA" ? (
            <div className="pt-2">
              <BalikovnaPicker
                selectedPointName={pickupPoint?.name ?? null}
                onSelect={setPickupPoint}
              />
            </div>
          ) : (
            <div className="flex flex-col gap-2 pt-2">
              <input
                required
                name="street-address"
                autoComplete="street-address"
                placeholder="Ulice a číslo popisné"
                value={street}
                onChange={(e) => setStreet(e.target.value)}
                className="rounded-sm border border-line px-3 py-2 text-sm text-ink"
              />
              <div className="flex gap-3">
                <input
                  required
                  name="address-level2"
                  autoComplete="address-level2"
                  placeholder="Město"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full rounded-sm border border-line px-3 py-2 text-sm text-ink"
                />
                <input
                  required
                  name="postal-code"
                  autoComplete="postal-code"
                  placeholder="PSČ"
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  className="w-full rounded-sm border border-line px-3 py-2 text-sm text-ink"
                />
              </div>
            </div>
          )}
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-semibold text-ink">Platba</legend>
          {(Object.keys(PAYMENT_LABELS) as PaymentMethod[]).map((method) => (
            <label key={method} className="flex items-center gap-2 text-sm text-ink">
              <input
                type="radio"
                name="paymentMethod"
                checked={paymentMethod === method}
                onChange={() => setPaymentMethod(method)}
                className="accent-accent"
              />
              {PAYMENT_LABELS[method]}
              {method === "CASH_ON_DELIVERY" &&
                settings.codSurcharge > 0 &&
                ` (+${formatPrice(settings.codSurcharge)})`}
            </label>
          ))}
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-semibold text-ink">Slevový kód</legend>
          {coupon ? (
            <div className="flex items-center justify-between rounded-sm border border-ok/40 bg-ok/10 px-3 py-2 text-sm text-ink">
              <span>
                Kód <strong>{coupon.code}</strong> uplatněn
              </span>
              <button
                type="button"
                onClick={() => {
                  setCoupon(null);
                  setCouponInput("");
                }}
                className="text-xs text-accent-2 underline hover:text-accent"
              >
                Odebrat
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                placeholder="Zadejte kód"
                value={couponInput}
                onChange={(e) => setCouponInput(e.target.value)}
                className="flex-1 rounded-sm border border-line px-3 py-2 text-sm text-ink"
              />
              <button
                type="button"
                onClick={applyCoupon}
                disabled={couponChecking || !couponInput.trim()}
                className="rounded-sm border border-line px-4 py-2 text-sm font-medium text-ink hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-50"
              >
                {couponChecking ? "Ověřuji…" : "Použít"}
              </button>
            </div>
          )}
          {couponError && <p className="text-xs text-red-600">{couponError}</p>}
        </fieldset>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <TrustBadges />

        <button
          type="submit"
          disabled={submitting || (usesPickupPoint && !pickupPoint)}
          className="rounded-sm bg-ink px-5 py-3 text-sm font-semibold text-white hover:bg-accent disabled:cursor-not-allowed disabled:bg-line disabled:text-accent-2"
        >
          {submitting ? "Odesílám…" : `Závazně objednat — ${formatPrice(total)}`}
        </button>
      </form>

      <aside className="w-full shrink-0 md:w-72">
        <h2 className="mb-3 text-sm font-semibold text-ink">Souhrn objednávky</h2>
        <ul className="flex flex-col gap-2 text-sm text-ink">
          {items.map((item) => (
            <li key={item.productId} className="flex justify-between">
              <span>
                {item.name} × {item.qty}
              </span>
              <span>{formatPrice(item.price * item.qty)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex flex-col gap-1 border-t border-line pt-3 text-sm text-ink">
          <div className="flex justify-between">
            <span>Zboží</span>
            <span>{formatPrice(itemsTotal)}</span>
          </div>
          <div className="flex justify-between">
            <span>Doprava</span>
            <span>{shippingPrice === 0 ? "zdarma" : formatPrice(shippingPrice)}</span>
          </div>
          {codSurcharge > 0 && (
            <div className="flex justify-between">
              <span>Příplatek za dobírku</span>
              <span>{formatPrice(codSurcharge)}</span>
            </div>
          )}
          {coupon && (
            <div className="flex justify-between text-ok">
              <span>Sleva ({coupon.code})</span>
              <span>−{formatPrice(coupon.discountAmount)}</span>
            </div>
          )}
          <div className="flex justify-between text-base font-bold">
            <span>Celkem</span>
            <span className="text-accent">{formatPrice(total)}</span>
          </div>
        </div>
      </aside>
    </main>
  );
}
