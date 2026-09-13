import Link from "next/link";
import { InstagramFeed } from "@/components/instagram-feed";
import { SocialLinks } from "@/components/social-links";
import { ShippingIcon } from "@/components/shipping-icons";
import { PaymentIcons } from "@/components/payment-icons";
import { prisma } from "@/lib/prisma";
import type { ShippingMethod } from "@prisma/client";

const TOP_BRANDS_COUNT = 14;

// Only the two carriers the owner wants highlighted in the footer.
const DELIVERY_METHODS: ShippingMethod[] = ["ZASILKOVNA", "GLS"];

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
  // Highlight the brands with the most in-stock products — a fair proxy for
  // "what we actually carry a lot of" without needing a curated pick list.
  // Full A-Z list lives at /znacky.
  const topBrandsRaw = await prisma.brand.findMany({
    select: {
      name: true,
      slug: true,
      _count: { select: { products: { where: { visible: true, stock: { gt: 0 } } } } },
    },
  });
  const topBrands = topBrandsRaw
    .filter((b) => b._count.products > 0)
    .sort((a, b) => b._count.products - a._count.products)
    .slice(0, TOP_BRANDS_COUNT);

  return (
    <footer className="bg-ink text-white">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <h3 className="text-sm font-semibold text-white">Garance originality</h3>
          <p className="mt-2 text-sm text-white/65">
            Veškeré produkty jsou 100% originální značkové zboží, nakupované přímo od
            distributorů — žádné kopie, žádné padělky.
          </p>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-white">Informace</h3>
          <ul className="mt-2 flex flex-col gap-1.5 text-sm text-white/65">
            {INFO_LINKS.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="hover:text-white hover:underline">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-white">Kontakt</h3>
          <p className="mt-2 text-sm text-white/65">
            Pavlo Hrytsan, IČO 19296037
            <br />
            Na Jarově 2425/4, 130 00 Praha 3
            <br />
            <a href="mailto:info@gotridperfume.cz" className="hover:text-white hover:underline">
              info@gotridperfume.cz
            </a>
            <br />
            +420 735 583 527
          </p>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-white">Sledujte nás</h3>
          <div className="mt-2">
            <SocialLinks />
          </div>
        </div>
      </div>

      {topBrands.length > 0 && (
        <div className="border-t border-white/10 px-4 py-8">
          <div className="mx-auto flex max-w-6xl flex-col gap-3">
            <h3 className="text-sm font-semibold text-white">Značky</h3>
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
                Zobrazit všechny značky →
              </Link>
            </div>
          </div>
        </div>
      )}

      <div className="border-t border-white/10 px-4 py-6">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-6 sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            {DELIVERY_METHODS.map((method) => (
              <span
                key={method}
                className="flex h-9 w-14 items-center justify-center rounded-md bg-white"
              >
                <ShippingIcon method={method} className="max-h-5 w-auto" />
              </span>
            ))}
          </div>
          <PaymentIcons />
        </div>
      </div>

      <InstagramFeed />

      <div className="border-t border-white/10 px-4 py-4 text-center text-xs text-white/40">
        © {new Date().getFullYear()} Gotrid Perfume
      </div>
    </footer>
  );
}
