"use client";

import Image from "next/image";
import Link from "next/link";
import { useCart } from "@/lib/cart-context";
import { formatPrice } from "@/lib/format";
import { TrustBadges } from "@/components/trust-badges";

export default function CartPage() {
  const { items, setQty, removeItem, total, freeShippingThreshold } = useCart();
  const remaining = freeShippingThreshold - total;

  if (items.length === 0) {
    return (
      <main className="mx-auto flex max-w-3xl flex-1 flex-col items-center gap-4 px-4 py-20 text-center">
        <h1 className="text-2xl font-bold text-ink">Košík je prázdný</h1>
        <p className="text-accent-2">Přidejte si produkty z katalogu.</p>
        <Link
          href="/"
          className="rounded-sm bg-ink px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent"
        >
          Zpět na výběr produktů
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-3xl flex-1 flex-col gap-6 px-4 py-10">
      <h1 className="text-2xl font-bold text-ink">Košík</h1>

      <div className="flex flex-col gap-2 border border-line p-3 text-sm">
        {remaining > 0 ? (
          <>
            <span className="text-ink">
              Ještě <span className="font-semibold">{formatPrice(remaining)}</span> do dopravy zdarma
            </span>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-line">
              <div
                className="h-full rounded-full bg-accent transition-[width]"
                style={{ width: `${Math.min(100, (total / freeShippingThreshold) * 100)}%` }}
              />
            </div>
          </>
        ) : (
          <span className="font-semibold text-ok">Máte nárok na dopravu zdarma! 🎉</span>
        )}
      </div>

      <ul className="flex flex-col divide-y divide-line border-y border-line">
        {items.map((item) => (
          <li key={item.productId} className="flex items-center gap-4 py-4">
            <Link href={`/produkt/${item.slug}`} className="relative h-20 w-20 shrink-0 overflow-hidden bg-line/60">
              {item.image ? (
                <Image src={item.image} alt={item.name} fill sizes="80px" className="object-cover" />
              ) : null}
            </Link>
            <div className="flex flex-1 flex-col gap-1">
              <Link href={`/produkt/${item.slug}`} className="text-sm font-semibold text-ink hover:underline">
                {item.name}
              </Link>
              <span className="text-sm text-accent-2">{formatPrice(item.price)} / ks</span>
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="number"
                  min={1}
                  max={item.stock || undefined}
                  value={item.qty}
                  onChange={(e) => setQty(item.productId, Number(e.target.value) || 1)}
                  className="w-16 rounded-sm border border-line px-2 py-1 text-sm text-ink"
                />
                <button
                  type="button"
                  onClick={() => removeItem(item.productId)}
                  className="text-xs text-accent-2 underline hover:text-accent"
                >
                  Odebrat
                </button>
              </div>
            </div>
            <span className="font-bold text-accent">{formatPrice(item.price * item.qty)}</span>
          </li>
        ))}
      </ul>

      <div className="flex items-center justify-between text-lg font-bold text-ink">
        <span>Celkem</span>
        <span>{formatPrice(total)}</span>
      </div>

      <Link
        href="/pokladna"
        className="w-full rounded-sm bg-ink px-5 py-3 text-center text-sm font-semibold text-white hover:bg-accent"
      >
        Pokračovat k objednávce
      </Link>

      <div className="flex justify-center border-t border-line pt-4">
        <TrustBadges />
      </div>
    </main>
  );
}
