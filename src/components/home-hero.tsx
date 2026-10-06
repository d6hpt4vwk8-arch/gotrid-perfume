import { headers } from "next/headers";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import type { Prisma } from "@prisma/client";
import { formatPriceIn } from "@/lib/format";
import { readCurrencyCookie } from "@/lib/currency-cookie";
import { getSettings } from "@/lib/settings.server";
import { getActiveGiftCoupon, getGiftOptions } from "@/lib/gifts.server";
import { HeroSlider } from "@/components/hero-slider";
import { CopyCodeButton } from "@/components/copy-code-button";

export async function HomeHero() {
  const [giftCoupon, giftOptions, settings, headerList] = await Promise.all([
    getActiveGiftCoupon(),
    getGiftOptions(),
    getSettings(),
    headers(),
  ]);
  const currency = readCurrencyCookie(headerList.get("cookie"));
  const price = (czk: Prisma.Decimal | number) => formatPriceIn(czk, currency, settings.czkToEurRate);
  const slides: ReactNode[] = [
    <section key="main" className="relative flex h-full flex-col overflow-hidden rounded-sm bg-sand text-ink lg:min-h-[520px] lg:flex-row lg:items-center">
      {/* 3D brand artwork (amber flacon, jade jar, golden dropper) on a sand→blush
          gradient — the left ~40 % of the image is intentionally empty for the headline. */}
      <Image
        src="/hero/hero-3d.jpg"
        alt=""
        fill
        priority
        sizes="100vw"
        className="hidden object-cover object-right lg:block"
      />
      <div className="relative aspect-[4/3] w-full lg:hidden">
        <Image
          src="/hero/hero-3d.jpg"
          alt="Parfém, korejská péče o pleť a sérum"
          fill
          priority
          sizes="100vw"
          className="object-cover object-[78%_50%]"
        />
      </div>

      <div className="relative z-10 flex flex-col items-start gap-5 px-6 pt-4 pb-14 sm:px-14 lg:w-[55%] lg:px-14 lg:py-14">
        <span className="text-[11px] font-semibold tracking-[0.22em] text-gold uppercase">
          Arabské parfémy &times; Korejská kosmetika
        </span>
        <h1 className="font-display text-[2.8rem] leading-[1.02] font-semibold tracking-tight sm:text-6xl lg:text-[3.9rem]">
          Vůně Orientu.
          <br />
          Péče z Koreje.
        </h1>
        <p className="max-w-md text-[15px] leading-relaxed text-ink/70">
          Pečlivě vybrané parfémy a korejská péče za poctivou cenu — dovážíme od ověřených
          distributorů, bez maloobchodní přirážky.
        </p>
        <div className="flex w-full flex-col gap-3 pt-1 sm:w-auto sm:flex-row">
          <Link
            href="/kategorie/parfemy/arabske-parfemy"
            className="rounded-sm bg-ink px-7 py-3.5 text-center text-sm font-semibold text-white transition hover:bg-accent"
          >
            Objevit parfémy
          </Link>
          <Link
            href="/kategorie/kosmetika"
            className="rounded-sm border border-ink/25 bg-white/40 px-7 py-3.5 text-center text-sm font-semibold text-ink transition hover:border-ink hover:bg-white/70"
          >
            Korejská kosmetika
          </Link>
        </div>
        <ul className="flex flex-wrap gap-x-5 gap-y-1 pt-2 text-xs text-ink/60">
          <li>✓ Originální zboží</li>
          <li>✓ Doprava od 59 Kč</li>
          <li>✓ Vrácení do 14 dnů</li>
        </ul>
      </div>
    </section>,
  ];

  // Second slide only exists while a GIFT-type coupon is actually active —
  // see benefits-bar.tsx for the other place this same promo gets announced.
  if (giftCoupon) {
    const gifts = giftOptions.slice(0, 3);
    slides.push(
      <section
        key="gift"
        className="relative flex h-full items-center overflow-hidden rounded-sm bg-ink px-14 py-12 text-white sm:px-20 sm:py-14"
      >
        <div className="flex w-full flex-col gap-10 lg:flex-row lg:items-center lg:gap-14">
          <div className="flex flex-col items-start gap-5 lg:w-[45%]">
            <span className="rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-[10px] tracking-widest uppercase sm:text-[11px]">
              Dárek zdarma
            </span>
            <h2 className="text-3xl leading-[1.15] font-bold sm:text-4xl lg:text-[2.6rem]">
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
          </div>

          {gifts.length > 0 && (
            <div className="grid grid-cols-3 gap-3 sm:gap-4 lg:flex-1">
              {gifts.map((gift) => (
                <div key={gift.productId} className="flex flex-col overflow-hidden rounded-sm bg-white/95">
                  <div className="relative aspect-square w-full">
                    {gift.image ? (
                      <Image
                        src={gift.image}
                        alt={gift.name}
                        fill
                        sizes="(min-width: 1024px) 18vw, 30vw"
                        className="object-contain p-3"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-accent-2">
                        Bez obrázku
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-1 border-t border-line/70 px-3 py-2.5">
                    <span className="line-clamp-2 text-[11px] leading-snug font-semibold text-ink sm:text-xs">
                      {gift.name}
                    </span>
                    <span className="text-sm font-bold text-ok">Zdarma</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>,
    );
  }

  return <HeroSlider slides={slides} />;
}
