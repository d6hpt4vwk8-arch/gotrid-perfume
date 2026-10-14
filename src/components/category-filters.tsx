"use client";

import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { usePathname, useRouter } from "@/i18n/navigation";
import { useMemo, useState, type ReactNode } from "react";
import type { BrandFacet } from "@/lib/category-brands.server";
import type { ScentFamilyFacet } from "@/lib/category-scent-facets.server";
import type { PerfumeStructureFacets } from "@/lib/perfume-structure-facets.server";
import type { CosmeticsFacets } from "@/lib/category-cosmetics-facets.server";
import { useCurrency } from "@/lib/currency-context";
import type { ProductCardData } from "@/components/product-card";
import { useTr, useIsSk } from "@/i18n/use-tr";

const SORT_LABELS: Record<string, string> = {
  newest: "Doporučené",
  bestsellers: "Nejprodávanější",
  "price-asc": "Cena od nejnižší",
  "price-desc": "Cena od nejvyšší",
};

// The price filter is stored in the URL in CZK (that is what the server
// filters on); EUR shoppers type and see euros, converted at the shop rate.
const czkToDisplay = (czk: string, eur: boolean, rate: number) =>
  czk && eur ? String(Math.round(Number(czk) / rate)) : czk;
const displayToCzk = (value: string, eur: boolean, rate: number) =>
  value && eur ? String(Math.round(Number(value) * rate)) : value;

function FilterSection({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details className="group border-b border-line pb-4" open={defaultOpen}>
      <summary className="flex cursor-pointer list-none items-center justify-between text-[11px] font-semibold tracking-wide text-accent-2 uppercase">
        {title}
        <span className="text-ink transition group-open:rotate-180">⌄</span>
      </summary>
      <div className="mt-2.5">{children}</div>
    </details>
  );
}

export function CategoryFilters({
  brands,
  scentFamilies,
  structure,
  cosmetics,
  topProducts = [],
}: {
  brands: BrandFacet[];
  scentFamilies: ScentFamilyFacet[];
  structure: PerfumeStructureFacets;
  cosmetics: CosmeticsFacets;
  topProducts?: ProductCardData[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { price, currency, czkToEurRate } = useCurrency();
  const tr = useTr();
  const isSk = useIsSk();
  const eur = currency === "EUR";

  const selectedBrands = searchParams.getAll("brand");
  const selectedScents = searchParams.getAll("scent");
  const selectedGenders = searchParams.getAll("gender");
  const selectedConcentrations = searchParams.getAll("concentration");
  const selectedOccasions = searchParams.getAll("occasion");
  const selectedSkinTypes = searchParams.getAll("skinType");
  const selectedConcerns = searchParams.getAll("concern");
  const selectedKinds = searchParams.getAll("kind");
  const selectedIngredients = searchParams.getAll("ingredient");
  const [priceMin, setPriceMin] = useState(() => czkToDisplay(searchParams.get("priceMin") ?? "", eur, czkToEurRate));
  const [priceMax, setPriceMax] = useState(() => czkToDisplay(searchParams.get("priceMax") ?? "", eur, czkToEurRate));
  const [brandQuery, setBrandQuery] = useState("");
  const [showAllBrands, setShowAllBrands] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  function updateParams(mutate: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(searchParams.toString());
    mutate(params);
    params.delete("page"); // any filter change resets pagination
    router.push(`${pathname}?${params.toString()}`);
  }

  function toggleMulti(key: string, current: string[], value: string) {
    const isSelected = current.includes(value);
    updateParams((params) => {
      params.delete(key);
      const next = isSelected ? current.filter((v) => v !== value) : [...current, value];
      next.forEach((v) => params.append(key, v));
    });
  }

  function toggleBoolean(key: string) {
    updateParams((params) => {
      if (params.get(key) === "1") params.delete(key);
      else params.set(key, "1");
    });
  }

  function applyPriceRange() {
    updateParams((params) => {
      if (priceMin) params.set("priceMin", displayToCzk(priceMin, eur, czkToEurRate));
      else params.delete("priceMin");
      if (priceMax) params.set("priceMax", displayToCzk(priceMax, eur, czkToEurRate));
      else params.delete("priceMax");
    });
  }

  function setSort(sort: string) {
    updateParams((params) => params.set("sort", sort));
  }

  const activeChips = useMemo(() => {
    const chips: { key: string; value: string; label: string }[] = [];
    selectedBrands.forEach((v) =>
      chips.push({ key: "brand", value: v, label: brands.find((b) => b.slug === v)?.name ?? v }),
    );
    selectedScents.forEach((v) =>
      chips.push({
        key: "scent",
        value: v,
        label: tr(scentFamilies.find((s) => s.slug === v)?.name ?? v),
      }),
    );
    selectedGenders.forEach((v) =>
      chips.push({
        key: "gender",
        value: v,
        label: tr(structure.genderOptions.find((g) => g.slug === v)?.name ?? v),
      }),
    );
    selectedConcentrations.forEach((v) =>
      chips.push({
        key: "concentration",
        value: v,
        label: tr(structure.concentrationOptions.find((c) => c.slug === v)?.name ?? v),
      }),
    );
    selectedOccasions.forEach((v) =>
      chips.push({
        key: "occasion",
        value: v,
        label: tr(structure.occasionOptions.find((o) => o.slug === v)?.name ?? v),
      }),
    );
    selectedSkinTypes.forEach((v) =>
      chips.push({
        key: "skinType",
        value: v,
        label: tr(cosmetics.skinTypes.find((s) => s.slug === v)?.name ?? v),
      }),
    );
    selectedConcerns.forEach((v) =>
      chips.push({
        key: "concern",
        value: v,
        label: tr(cosmetics.concerns.find((c) => c.slug === v)?.name ?? v),
      }),
    );
    selectedKinds.forEach((v) =>
      chips.push({ key: "kind", value: v, label: tr(cosmetics.productTypes.find((k) => k.slug === v)?.name ?? v) }),
    );
    selectedIngredients.forEach((v) =>
      chips.push({ key: "ingredient", value: v, label: tr(cosmetics.ingredients.find((i) => i.slug === v)?.name ?? v) }),
    );
    if (searchParams.get("vegan") === "1") chips.push({ key: "vegan", value: "1", label: "Vegan" });
    if (searchParams.get("cf") === "1") chips.push({ key: "cf", value: "1", label: "Cruelty-free" });
    if (searchParams.get("sale") === "1") chips.push({ key: "sale", value: "1", label: tr("Ve slevě") });
    return chips;
  }, [
    selectedBrands,
    selectedScents,
    selectedGenders,
    selectedConcentrations,
    selectedOccasions,
    selectedSkinTypes,
    selectedConcerns,
    selectedKinds,
    selectedIngredients,
    searchParams,
    brands,
    scentFamilies,
    structure,
    cosmetics,
    tr,
  ]);

  function removeChip(key: string, value: string) {
    updateParams((params) => {
      if (key === "sale" || key === "vegan" || key === "cf") {
        params.delete(key);
        return;
      }
      const rest = params.getAll(key).filter((v) => v !== value);
      params.delete(key);
      rest.forEach((v) => params.append(key, v));
    });
  }

  function clearAll() {
    const q = searchParams.get("q");
    router.push(q ? `${pathname}?q=${encodeURIComponent(q)}` : pathname);
  }

  const visibleBrands = brands.filter((b) => b.name.toLowerCase().includes(brandQuery.toLowerCase()));
  const brandsToShow = showAllBrands ? visibleBrands : visibleBrands.slice(0, 8);

  return (
    <aside className="flex w-full flex-col gap-4 sm:w-60 sm:shrink-0">
      <button
        type="button"
        onClick={() => setMobileOpen((open) => !open)}
        className="flex items-center justify-between rounded-sm border border-line px-4 py-2.5 text-sm font-semibold text-ink sm:hidden"
      >
        <span>{tr("Filtrovat")}{activeChips.length > 0 && ` (${activeChips.length})`}</span>
        <span className={`text-accent-2 transition ${mobileOpen ? "rotate-180" : ""}`}>⌄</span>
      </button>

      <div className={`${mobileOpen ? "flex" : "hidden"} flex-col gap-4 sm:flex`}>
      {topProducts.length > 0 && (
        <div className="flex flex-col gap-2 border-b border-line pb-4">
          <span className="text-[11px] font-semibold tracking-wide text-accent-2 uppercase">
            {tr("Top prodejů")}
          </span>
          <ul className="flex flex-col gap-2">
            {topProducts.map((product) => {
              const image = product.images[0];
              return (
                <li key={product.slug}>
                  <Link
                    href={`/produkt/${product.slug}`}
                    className="group flex items-center gap-2.5 rounded-sm py-1 text-sm hover:bg-line/30"
                  >
                    <span className="relative h-12 w-12 shrink-0 overflow-hidden bg-line/60">
                      {image ? (
                        <Image src={image.url} alt={isSk && product.nameSk ? product.nameSk : product.name} fill sizes="48px" className="object-cover" />
                      ) : null}
                    </span>
                    <span className="flex flex-col gap-0.5 overflow-hidden">
                      <span className="line-clamp-2 text-ink group-hover:underline">{isSk && product.nameSk ? product.nameSk : product.name}</span>
                      <span className="font-semibold text-accent">{price(product.price)}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div>
        <label className="text-[11px] font-semibold tracking-wide text-accent-2 uppercase">
          {tr("Řazení")}
        </label>
        <select
          value={searchParams.get("sort") ?? "newest"}
          onChange={(e) => setSort(e.target.value)}
          className="mt-1 w-full rounded-sm border border-line px-2 py-1.5 text-sm text-ink"
        >
          {Object.entries(SORT_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {tr(label)}
            </option>
          ))}
        </select>
      </div>

      {activeChips.length > 0 && (
        <div className="flex flex-col gap-2 border-b border-line pb-4">
          <div className="flex flex-wrap gap-1.5">
            {activeChips.map((chip) => (
              <button
                key={`${chip.key}-${chip.value}`}
                type="button"
                onClick={() => removeChip(chip.key, chip.value)}
                className="flex items-center gap-1 rounded-full bg-ink px-2.5 py-1 text-xs font-medium text-white hover:bg-accent"
              >
                {chip.label}
                <span aria-hidden>×</span>
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={clearAll}
            className="w-fit text-xs text-accent-2 underline hover:text-accent"
          >
            {tr("Vymazat vše")}
          </button>
        </div>
      )}

      <div className="flex flex-col gap-2 border-b border-line pb-4">
        <label className="flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={searchParams.get("sale") === "1"}
            onChange={() => toggleBoolean("sale")}
            className="accent-accent"
          />
          {tr("Ve slevě")}
        </label>
      </div>

      <FilterSection title={eur ? tr("Cena (€)") : tr("Cena (Kč)")}>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            value={priceMin}
            onChange={(e) => setPriceMin(e.target.value)}
            onBlur={applyPriceRange}
            placeholder={tr("od")}
            className="w-full rounded-sm border border-line px-2 py-1 text-sm text-ink"
          />
          <input
            type="number"
            min={0}
            value={priceMax}
            onChange={(e) => setPriceMax(e.target.value)}
            onBlur={applyPriceRange}
            placeholder={tr("do")}
            className="w-full rounded-sm border border-line px-2 py-1 text-sm text-ink"
          />
        </div>
      </FilterSection>

      {structure.genderOptions.length > 0 && (
        <FilterSection title={tr("Pro koho")}>
          <ul className="flex flex-col gap-1.5">
            {structure.genderOptions.map((option) => (
              <li key={option.slug}>
                <label className="flex items-center gap-2 text-sm text-ink">
                  <input
                    type="checkbox"
                    checked={selectedGenders.includes(option.slug)}
                    onChange={() => toggleMulti("gender", selectedGenders, option.slug)}
                    className="accent-accent"
                  />
                  {tr(option.name)}
                  <span className="text-xs text-accent-2">({option.count})</span>
                </label>
              </li>
            ))}
          </ul>
        </FilterSection>
      )}

      {structure.concentrationOptions.length > 0 && (
        <FilterSection title={tr("Typ")}>
          <ul className="flex flex-col gap-1.5">
            {structure.concentrationOptions.map((option) => (
              <li key={option.slug}>
                <label className="flex items-center gap-2 text-sm text-ink">
                  <input
                    type="checkbox"
                    checked={selectedConcentrations.includes(option.slug)}
                    onChange={() => toggleMulti("concentration", selectedConcentrations, option.slug)}
                    className="accent-accent"
                  />
                  {tr(option.name)}
                  <span className="text-xs text-accent-2">({option.count})</span>
                </label>
              </li>
            ))}
          </ul>
        </FilterSection>
      )}

      {scentFamilies.length > 0 && (
        <FilterSection title={tr("Charakter vůně")}>
          <ul className="flex flex-col gap-1.5">
            {scentFamilies.map((family) => (
              <li key={family.slug}>
                <label className="flex items-center gap-2 text-sm text-ink">
                  <input
                    type="checkbox"
                    checked={selectedScents.includes(family.slug)}
                    onChange={() => toggleMulti("scent", selectedScents, family.slug)}
                    className="accent-accent"
                  />
                  {tr(family.name)}
                  <span className="text-xs text-accent-2">({family.count})</span>
                </label>
              </li>
            ))}
          </ul>
        </FilterSection>
      )}

      {structure.occasionOptions.length > 0 && (
        <FilterSection title={tr("Příležitost")}>
          <ul className="flex flex-col gap-1.5">
            {structure.occasionOptions.map((option) => (
              <li key={option.slug}>
                <label className="flex items-center gap-2 text-sm text-ink">
                  <input
                    type="checkbox"
                    checked={selectedOccasions.includes(option.slug)}
                    onChange={() => toggleMulti("occasion", selectedOccasions, option.slug)}
                    className="accent-accent"
                  />
                  {tr(option.name)}
                  <span className="text-xs text-accent-2">({option.count})</span>
                </label>
              </li>
            ))}
          </ul>
        </FilterSection>
      )}

      {cosmetics.productTypes.length > 0 && (
        <FilterSection title={tr("Druh produktu")}>
          <ul className="flex flex-col gap-1.5">
            {cosmetics.productTypes.map((option) => (
              <li key={option.slug}>
                <label className="flex items-center gap-2 text-sm text-ink">
                  <input
                    type="checkbox"
                    checked={selectedKinds.includes(option.slug)}
                    onChange={() => toggleMulti("kind", selectedKinds, option.slug)}
                    className="accent-accent"
                  />
                  {tr(option.name)}
                  <span className="text-xs text-accent-2">({option.count})</span>
                </label>
              </li>
            ))}
          </ul>
        </FilterSection>
      )}

      {cosmetics.concerns.length > 0 && (
        <FilterSection title={tr("Účel")}>
          <ul className="flex flex-col gap-1.5">
            {cosmetics.concerns.map((option) => (
              <li key={option.slug}>
                <label className="flex items-center gap-2 text-sm text-ink">
                  <input
                    type="checkbox"
                    checked={selectedConcerns.includes(option.slug)}
                    onChange={() => toggleMulti("concern", selectedConcerns, option.slug)}
                    className="accent-accent"
                  />
                  {tr(option.name)}
                  <span className="text-xs text-accent-2">({option.count})</span>
                </label>
              </li>
            ))}
          </ul>
        </FilterSection>
      )}

      {cosmetics.skinTypes.length > 0 && (
        <FilterSection title={tr("Typ pleti")}>
          <ul className="flex flex-col gap-1.5">
            {cosmetics.skinTypes.map((option) => (
              <li key={option.slug}>
                <label className="flex items-center gap-2 text-sm text-ink">
                  <input
                    type="checkbox"
                    checked={selectedSkinTypes.includes(option.slug)}
                    onChange={() => toggleMulti("skinType", selectedSkinTypes, option.slug)}
                    className="accent-accent"
                  />
                  {tr(option.name)}
                  <span className="text-xs text-accent-2">({option.count})</span>
                </label>
              </li>
            ))}
          </ul>
        </FilterSection>
      )}

      {cosmetics.ingredients.length > 0 && (
        <FilterSection title={tr("Složka")}>
          <ul className="flex flex-col gap-1.5">
            {cosmetics.ingredients.map((option) => (
              <li key={option.slug}>
                <label className="flex items-center gap-2 text-sm text-ink">
                  <input
                    type="checkbox"
                    checked={selectedIngredients.includes(option.slug)}
                    onChange={() => toggleMulti("ingredient", selectedIngredients, option.slug)}
                    className="accent-accent"
                  />
                  {tr(option.name)}
                  <span className="text-xs text-accent-2">({option.count})</span>
                </label>
              </li>
            ))}
          </ul>
        </FilterSection>
      )}

      {(cosmetics.vegan > 0 || cosmetics.crueltyFree > 0) && (
        <FilterSection title={tr("Vlastnosti")}>
          <ul className="flex flex-col gap-1.5">
            {cosmetics.vegan > 0 && (
              <li>
                <label className="flex items-center gap-2 text-sm text-ink">
                  <input
                    type="checkbox"
                    checked={searchParams.get("vegan") === "1"}
                    onChange={() => toggleBoolean("vegan")}
                    className="accent-accent"
                  />
                  Vegan
                  <span className="text-xs text-accent-2">({cosmetics.vegan})</span>
                </label>
              </li>
            )}
            {cosmetics.crueltyFree > 0 && (
              <li>
                <label className="flex items-center gap-2 text-sm text-ink">
                  <input
                    type="checkbox"
                    checked={searchParams.get("cf") === "1"}
                    onChange={() => toggleBoolean("cf")}
                    className="accent-accent"
                  />
                  Cruelty-free
                  <span className="text-xs text-accent-2">({cosmetics.crueltyFree})</span>
                </label>
              </li>
            )}
          </ul>
        </FilterSection>
      )}

      {brands.length > 0 && (
        <FilterSection title={tr("Značka")}>
          <div className="flex flex-col gap-2">
            {brands.length > 8 && (
              <input
                value={brandQuery}
                onChange={(e) => setBrandQuery(e.target.value)}
                placeholder={tr("Hledat značku…")}
                className="rounded-sm border border-line px-2 py-1 text-sm text-ink"
              />
            )}
            <ul className="flex max-h-64 flex-col gap-1.5 overflow-y-auto">
              {brandsToShow.map((brand) => (
                <li key={brand.slug}>
                  <label className="flex items-center gap-2 text-sm text-ink">
                    <input
                      type="checkbox"
                      checked={selectedBrands.includes(brand.slug)}
                      onChange={() => toggleMulti("brand", selectedBrands, brand.slug)}
                      className="accent-accent"
                    />
                    {brand.name}
                    <span className="text-xs text-accent-2">({brand.count})</span>
                  </label>
                </li>
              ))}
            </ul>
            {!showAllBrands && visibleBrands.length > 8 && (
              <button
                type="button"
                onClick={() => setShowAllBrands(true)}
                className="w-fit text-xs text-accent-2 underline hover:text-accent"
              >
                {tr("Zobrazit všechny")} ({visibleBrands.length})
              </button>
            )}
          </div>
        </FilterSection>
      )}
      </div>
    </aside>
  );
}
