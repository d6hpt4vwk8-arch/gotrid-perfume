import { headers } from "next/headers";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import type { Prisma } from "@prisma/client";
import { formatPriceIn } from "@/lib/format";
import { readCurrencyCookie } from "@/lib/currency-cookie";
import { getSettings } from "@/lib/settings.server";
import { getActiveGiftCoupon, getGiftOptions } from "@/lib/gifts.server";
import { prisma } from "@/lib/prisma";
import { HeroSlider } from "@/components/hero-slider";
import { CopyCodeButton } from "@/components/copy-code-button";

// The four real products shown in the hero artwork (public/hero/hero-products.jpg),
// left to right — the artwork was generated from these exact product photos.
const HERO_PRODUCTS = [
  { slug: "lattafa-eclaire-pistache-edp-u-100ml-spv-0239469", label: "Lattafa Eclaire Pistache" },
  { slug: "lattafa-khamrah-qahwa-edp-u-100ml-spv-0226409", label: "Lattafa Khamrah Qahwa" },
  { slug: "dr-althea-aqua-marine-deep-serum-gvs-256191", label: "Dr.Althea Aqua Marine Serum" },
  { slug: "dr-althea-345-relief-cream-15ml-gvs-256429", label: "Dr.Althea 345 Relief Cream" },
] as const;

export async function HomeHero() {
  const [shown, giftCoupon, giftOptions, settings, headerList] = await Promise.all([
    prisma.product.findMany({
      where: { slug: { in: HERO_PRODUCTS.map((p) => p.slug) }, visible: true, stock: { gt: 0 } },
      select: { slug: true, price: true },
    }),
    getActiveGiftCoupon(),
    getGiftOptions(),
    getSettings(),
    headers(),
  ]);
  const currency = readCurrencyCookie(headerList.get("cookie"));
  const price = (czk: Prisma.Decimal | number) => formatPriceIn(czk, currency, settings.czkToEurRate);
  const priceBySlug = new Map(shown.map((p) => [p.slug, p.price]));

  const slides: ReactNode[] = [
    <section
      key="main"
      className="relative flex h-full flex-col overflow-hidden rounded-sm bg-ink text-white lg:min-h-[560px] lg:flex-row lg:items-center"
    >
      {/* Artwork built from the real product photos (Lattafa Eclaire Pistache + Khamrah Qahwa,
          Dr.Althea serum + 345 Relief Cream) on graphite plinths — dark like the rest of the site;
          the left ~45 % is intentionally empty for the headline. */}
      <div className="absolute inset-y-0 right-0 hidden w-[92%] lg:block">
        <Image
          src="/hero/hero-products.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-right"
        />
        {/* Blends the artwork's left edge into the slide background. */}
        <div className="absolute inset-y-0 left-0 w-1/4 bg-gradient-to-r from-ink to-transparent" />
      </div>
      <div className="relative aspect-[16/10] w-full lg:hidden">
        <Image
          src="/hero/hero-products.jpg"
          alt="Lattafa Eclaire Pistache, Lattafa Khamrah Qahwa, Dr.Althea Aqua Marine serum a 345 Relief Cream"
          fill
          priority
          sizes="100vw"
          className="object-cover object-[78%_50%]"
        />
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-ink to-transparent" />
      </div>

      <div className="relative z-10 flex flex-col items-start gap-5 px-6 pt-2 pb-14 sm:px-14 lg:w-[50%] lg:px-14 lg:py-14">
        <span className="rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-[10px] tracking-widest uppercase sm:text-[11px]">
          Arabské parfémy &times; Korejská kosmetika
        </span>
        <h1 className="text-3xl leading-[1.12] font-bold sm:text-4xl lg:text-[2.7rem]">
          Vůně z Orientu a péče z Koreje za poctivou cenu.
        </h1>
        <p className="max-w-md text-sm leading-relaxed text-white/70">
          Pečlivě vybrané parfémy a korejská péče, které v běžném e-shopu nenajdete. Dovážíme od
          ověřených distributorů a posíláme z Prahy.
        </p>
        <div className="flex w-full flex-col gap-3 pt-1 sm:w-auto sm:flex-row sm:flex-wrap">
          <Link
            href="/kategorie/parfemy/arabske-parfemy"
            className="rounded-sm bg-white px-5 py-3 text-center text-sm font-semibold text-ink transition hover:bg-white/85"
          >
            Arabské parfémy
          </Link>
          <Link
            href="/kategorie/kosmetika"
            className="rounded-sm border border-white/30 px-5 py-3 text-center text-sm font-semibold text-white transition hover:border-white/60 hover:bg-white/10"
          >
            Korejská kosmetika
          </Link>
        </div>
        <ul className="flex flex-wrap gap-x-5 gap-y-1 pt-1 text-xs text-white/60">
          <li>✓ Originální zboží od distributorů</li>
          <li>✓ Doprava od 59 Kč</li>
          <li>✓ Vrácení do 14 dnů</li>
        </ul>
        <div className="flex flex-col gap-1.5 border-t border-white/15 pt-4 text-xs text-white/60">
          <span className="font-semibold tracking-wider text-white/80 uppercase">Na obrázku</span>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {HERO_PRODUCTS.map((item) => {
              const itemPrice = priceBySlug.get(item.slug);
              return (
                <Link
                  key={item.slug}
                  href={`/produkt/${item.slug}`}
                  className="underline decoration-white/30 underline-offset-2 transition hover:text-white hover:decoration-white"
                >
                  {item.label}
                  {itemPrice !== undefined && <span className="text-white/90"> · {price(itemPrice)}</span>}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </section>,
  ];

  // Second slide only exists while a GIFT-type coupon is actually active —
  // see benefits-bar.tsx for the other place this same promo gets announced.
  if (giftCoupon) {
    const gifts = giftOptions.slice(0, 4);
    const moreGifts = giftOptions.length - gifts.length;
    slides.push(
      <section
        key="gift"
        className="relative flex h-full flex-col overflow-hidden rounded-sm bg-ink text-white lg:min-h-[560px] lg:flex-row lg:items-center"
      >
        {/* Same dark 3D look as the main slide — the artwork was generated from the real gift
            products (Freeman masks and dry shampoo, Humble floss and toothbrushes); the full live
            list of gifts is shown as text on the left. */}
        <div className="absolute inset-y-0 right-0 hidden w-[92%] lg:block">
          <Image
            src="/hero/hero-gifts.jpg"
            alt=""
            fill
            sizes="100vw"
            className="object-cover object-right"
          />
          <div className="absolute inset-y-0 left-0 w-1/4 bg-gradient-to-r from-ink to-transparent" />
        </div>
        <div className="relative aspect-[16/10] w-full lg:hidden">
          <Image
            src="/hero/hero-gifts.jpg"
            alt="Dárky zdarma k objednávce"
            fill
            sizes="100vw"
            className="object-cover object-[78%_50%]"
          />
          <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-ink to-transparent" />
        </div>

        <div className="relative z-10 flex flex-col items-start gap-5 px-6 pt-2 pb-14 sm:px-14 lg:w-[50%] lg:px-14 lg:py-14">
          <span className="rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-[10px] tracking-widest uppercase sm:text-[11px]">
            Dárek zdarma
          </span>
          <h2 className="text-3xl leading-[1.12] font-bold sm:text-4xl lg:text-[2.7rem]">
            {giftCoupon.minOrderValue
              ? `Nákup nad ${price(Number(giftCoupon.minOrderValue))}? Dárek zdarma!`
              : "Vyberte si dárek zdarma!"}
          </h2>
          <p className="max-w-md text-sm leading-relaxed text-white/70">
            Zadejte kód v košíku nebo na pokladně a vyberte si jeden z dárků z naší nabídky —
            zdarma k vaší objednávce.
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <CopyCodeButton code={giftCoupon.code} />
            <Link
              href="/kosik"
              className="rounded-sm border border-white/30 px-5 py-3 text-center text-sm font-semibold text-white transition hover:border-white/60 hover:bg-white/10"
            >
              Do košíku
            </Link>
          </div>
          {gifts.length > 0 && (
            <div className="flex w-full max-w-md flex-col gap-2 border-t border-white/15 pt-4 text-xs text-white/60">
              <span className="font-semibold tracking-wider text-white/80 uppercase">Na výběr</span>
              <ul className="flex flex-col gap-2">
                {gifts.map((gift) => (
                  <li key={gift.productId} className="flex items-center gap-3">
                    <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-sm bg-white">
                      {gift.image && (
                        <Image src={gift.image} alt="" fill sizes="40px" className="object-contain p-1" />
                      )}
                    </span>
                    <span className="line-clamp-1 flex-1 text-white/85">{gift.name}</span>
                    <span className="font-semibold text-white">Zdarma</span>
                  </li>
                ))}
              </ul>
              {moreGifts > 0 && <span>… a dalších {moreGifts} dárků k výběru v košíku</span>}
            </div>
          )}
        </div>
      </section>,
    );
  }

  return <HeroSlider slides={slides} />;
}
