import Link from "next/link";
import type { BrandFacet } from "@/lib/category-brands.server";
import type { ScentFamilyFacet } from "@/lib/category-scent-facets.server";
import type { PerfumeStructureFacets } from "@/lib/perfume-structure-facets.server";

const GENDER_LABEL: Record<string, string> = {
  "damske-parfemy": "Dámské",
  "panske-parfemy": "Pánské",
  "unisex-parfemy": "Unisex",
};

const GENDER_ORDER = ["damske-parfemy", "panske-parfemy", "unisex-parfemy"];

function Row({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-4">
      <p className="shrink-0 pt-1.5 text-[11px] font-semibold tracking-wide text-accent-2 uppercase sm:w-28">{title}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function Chip({ href, label, count }: { href: string; label: string; count: number }) {
  return (
    <Link
      href={href}
      className="rounded-sm border border-line px-3 py-1.5 text-sm text-ink transition hover:border-accent hover:text-accent"
    >
      {label} <span className="text-xs text-accent-2">{count}</span>
    </Link>
  );
}

/**
 * Quick links into the filters that already exist on the category page (they are plain query-string
 * filters: ?gender= / ?scent= / ?brand=), so a visitor can start from a scent family or a brand
 * without opening the sidebar. Built from the page's live facets: nothing is listed that has no products.
 */
export function CategoryQuickTiles({
  basePath,
  scentFamilies,
  brands,
  structure,
}: {
  basePath: string;
  scentFamilies: ScentFamilyFacet[];
  brands: BrandFacet[];
  structure: PerfumeStructureFacets;
}) {
  const topScents = [...scentFamilies].sort((a, b) => b.count - a.count).slice(0, 8);
  const topBrands = [...brands].sort((a, b) => b.count - a.count).slice(0, 8);
  if (topScents.length === 0 && topBrands.length === 0) return null;

  return (
    <section aria-label="Rychlý výběr" className="flex flex-col gap-3 border-y border-line py-4">
      {structure.genderOptions.length > 0 && (
        <Row title="Pro koho">
          {[...structure.genderOptions]
            .sort((a, b) => GENDER_ORDER.indexOf(a.slug) - GENDER_ORDER.indexOf(b.slug))
            .map((g) => (
              <Chip key={g.slug} href={`${basePath}?gender=${g.slug}`} label={GENDER_LABEL[g.slug] ?? g.name} count={g.count} />
            ))}
        </Row>
      )}
      {topScents.length > 0 && (
        <Row title="Podle vůně">
          {topScents.map((s) => (
            <Chip key={s.slug} href={`${basePath}?scent=${s.slug}`} label={s.name} count={s.count} />
          ))}
        </Row>
      )}
      {topBrands.length > 0 && (
        <Row title="Značky">
          {topBrands.map((b) => (
            <Chip key={b.slug} href={`${basePath}?brand=${b.slug}`} label={b.name} count={b.count} />
          ))}
        </Row>
      )}
    </section>
  );
}
