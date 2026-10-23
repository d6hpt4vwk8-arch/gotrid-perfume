import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { InstagramFeed } from "@/components/instagram-feed";
import { SocialLinks } from "@/components/social-links";
import { PaymentIcons } from "@/components/payment-icons";
import { ComgateBadges } from "@/components/comgate-badges";
import { isComgateConfigured } from "@/lib/payments/comgate";
import { prisma } from "@/lib/prisma";
import { currentSeller, sellerLine, CONTACT } from "@/lib/business-identity";
import type { ShippingMethod } from "@prisma/client";
import { getCurrentLocale, getTr } from "@/i18n/tr.server";
import { SK_ONLY_WHERE } from "@/lib/sk-visibility";

const TOP_BRANDS_COUNT = 14;

// Only the two carriers the owner wants highlighted in the footer.
const DELIVERY_METHODS: ShippingMethod[] = ["ZASILKOVNA", "GLS"];
const FOOTER_CARRIER_LOGOS: Record<string, { src: string; alt: string; className: string }> = {
  ZASILKOVNA: { src: "/shipping-logos/zasilkovna.svg", alt: "Zásilkovna", className: "h-8" },
  GLS: { src: "/shipping-logos/gls.svg", alt: "GLS", className: "h-6" },
};

const INFO_LINKS = [
  { href: "/o-nas", label: "O nás" },
  { href: "/magazin", label: "Magazín" },
  { href: "/garance-originality-produktu", label: "Garance originality produktů" },
  { href: "/doprava-a-platba", label: "Doprava a platba" },
  { href: "/obchodni-podminky", label: "Obchodní podmínky" },
  { href: "/podminky-vraceni-zbozi", label: "Podmínky vrácení zboží" },
  { href: "/podminky-ochrany-osobnich-udaju", label: "Ochrana osobních údajů" },
  { href: "/kontakty", label: "Kontakty" },
];

export async function SiteFooter() {
  const seller = currentSeller();
  const [tr, locale] = await Promise.all([getTr(), getCurrentLocale()]);
  const isSk = locale === "sk";
  // Highlight the brands with the most in-stock products — a fair proxy for
  // "what we actually carry a lot of" without needing a curated pick list.
  // Full A-Z list lives at /znacky.
  const topBrandsRaw = await prisma.brand.findMany({
    select: {
      name: true,
      slug: true,
      _count: { select: { products: { where: { visible: true, stock: { gt: 0 }, ...(isSk ? SK_ONLY_WHERE : {}) } } } },
    },
  });
  const topBrands = topBrandsRaw
    .filter((b) => b._count.products > 0)
    .sort((a, b) => b._count.products - a._count.products)
    .slice(0, TOP_BRANDS_COUNT);

  return (
    <footer className="bg-ink text-white">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-5">
        <div>
          <Link href="/" className="flex items-center gap-3">
            <Image src="/logo-mark.svg" alt="" width={48} height={48} className="brightness-0 invert" />
            <span className="flex flex-col leading-tight">
              <span className="text-lg font-semibold tracking-tight text-white">Gotrid Perfume</span>
              <span className="mt-0.5 text-xs text-white/55">{tr("Originální značková parfumerie")}</span>
            </span>
          </Link>
          <h3 className="mt-6 text-sm font-semibold text-white">{tr("Doprava")}</h3>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {DELIVERY_METHODS.map((method) => {
              const logo = FOOTER_CARRIER_LOGOS[method];
              return (
                <span key={method} className="flex h-11 items-center justify-center rounded-md bg-white px-3.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={logo.src} alt={logo.alt} className={`${logo.className} w-auto`} />
                </span>
              );
            })}
            <Link
              href="/doprava-a-platba"
              className="flex h-11 items-center gap-2 rounded-md bg-white px-3.5 text-xs font-semibold leading-tight text-ink"
            >
              <svg width="16" height="20" viewBox="0 0 16 20" aria-hidden="true" className="shrink-0">
                <path d="M8 1C4.7 1 2 3.7 2 7c0 4.5 6 11 6 11s6-6.5 6-11c0-3.3-2.7-6-6-6Z" fill="none" stroke="currentColor" strokeWidth="1.6" />
                <circle cx="8" cy="7" r="2.2" fill="currentColor" />
              </svg>
              <span>
                {tr("Osobní odběr")}
                <br />
                {tr("v Praze")}
              </span>
            </Link>
          </div>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-white">{tr("Nákup s jistotou")}</h3>
          <ul className="mt-2 flex flex-col gap-1.5 text-sm text-white/65">
            <li>{tr("Zboží nakupujeme přímo od evropských distributorů")}</li>
            <li>{tr("14 dní na vrácení zboží")}</li>
          </ul>
          {/* Heureka's own badge, served from their CDN — it disappears on its
              own if the shop ever drops below the certificate threshold. */}
          {!isSk && (
          <a
            href="https://obchody.heureka.cz/gotridperfume-cz/recenze/"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-block"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://im9.cz/cb/98437-4.svg"
              alt="Ověřeno zákazníky – Heureka"
              width={96}
              height={96}
              loading="lazy"
            />
          </a>
          )}
        </div>
        <div>
          <h3 className="text-sm font-semibold text-white">{tr("Informace")}</h3>
          <ul className="mt-2 flex flex-col gap-1.5 text-sm text-white/65">
            {INFO_LINKS.filter((l) => !isSk || l.href !== "/magazin").map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="hover:text-white hover:underline">
                  {tr(link.label)}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-white">{tr("Kontakt")}</h3>
          <p className="mt-2 text-sm text-white/65">
            {sellerLine(seller)}
            <br />
            {seller.street}, {seller.city}
            {seller.commercialRegister && (
              <>
                <br />
                {tr(seller.commercialRegister)}
              </>
            )}
            <br />
            <a href={`mailto:${CONTACT.email}`} className="hover:text-white hover:underline">
              {CONTACT.email}
            </a>
            <br />
            {CONTACT.phone}
          </p>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-white">{tr("Sledujte nás")}</h3>
          <div className="mt-2">
            <SocialLinks />
          </div>
          <h3 className="mt-8 text-sm font-semibold text-white">{tr("Platby")}</h3>
          <div className="mt-3">{isComgateConfigured() ? <ComgateBadges /> : <PaymentIcons />}</div>
        </div>
      </div>

      {topBrands.length > 0 && (
        <div className="border-t border-white/10 px-4 py-8">
          <div className="mx-auto flex max-w-6xl flex-col gap-3">
            <h3 className="text-sm font-semibold text-white">{tr("Značky")}</h3>
            <div className="flex flex-wrap gap-2">
              {topBrands.map((brand) => (
                <Link
                  key={brand.slug}
                  href={`/znacka/${brand.slug}`}
                  className="rounded-full border border-white/20 px-3.5 py-1.5 text-xs text-white/70 transition-colors hover:border-white hover:text-white"
                >
                  {brand.name}
                </Link>
              ))}
              <Link
                href="/znacky"
                className="rounded-full border border-white/40 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-white hover:text-ink"
              >
                {tr("Zobrazit všechny značky →")}
              </Link>
            </div>
          </div>
        </div>
      )}

      <InstagramFeed />

      <div className="border-t border-white/10 px-4 py-4 text-center text-xs text-white/40">
        © {new Date().getFullYear()} Gotrid Perfume
      </div>
    </footer>
  );
}
