"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import type { BrandFacet } from "@/lib/category-brands.server";
import type { ScentFamilyFacet } from "@/lib/category-scent-facets.server";
import type { PerfumeStructureFacets } from "@/lib/perfume-structure-facets.server";
import type { CosmeticsFacets } from "@/lib/category-cosmetics-facets.server";

const SORT_LABELS: Record<string, string> = {
  newest: "Novinky",
  "price-asc": "Cena od nejnižší",
  "price-desc": "Cena od nejvyšší",
};

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
}: {
  brands: BrandFacet[];
  scentFamilies: ScentFamilyFacet[];
  structure: PerfumeStructureFacets;
  cosmetics: CosmeticsFacets;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const selectedBrands = searchParams.getAll("brand");
  const selectedScents = searchParams.getAll("scent");
  const selectedGenders = searchParams.getAll("gender");
  const selectedConcentrations = searchParams.getAll("concentration");
  const selectedSkinTypes = searchParams.getAll("skinType");
  const selectedConcerns = searchParams.getAll("concern");
  const [priceMin, setPriceMin] = useState(searchParams.get("priceMin") ?? "");
  const [priceMax, setPriceMax] = useState(searchParams.get("priceMax") ?? "");
  const [brandQuery, setBrandQuery] = useState("");
  const [showAllBrands, setShowAllBrands] = useState(false);

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
      if (priceMin) params.set("priceMin", priceMin);
      else params.delete("priceMin");
      if (priceMax) params.set("priceMax", priceMax);
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
        label: scentFamilies.find((s) => s.slug === v)?.name ?? v,
      }),
    );
    selectedGenders.forEach((v) =>
      chips.push({
        key: "gender",
        value: v,
        label: structure.genderOptions.find((g) => g.slug === v)?.name ?? v,
      }),
    );
    selectedConcentrations.forEach((v) =>
      chips.push({
        key: "concentration",
        value: v,
        label: structure.concentrationOptions.find((c) => c.slug === v)?.name ?? v,
      }),
    );
    selectedSkinTypes.forEach((v) =>
      chips.push({
        key: "skinType",
        value: v,
        label: cosmetics.skinTypes.find((s) => s.slug === v)?.name ?? v,
      }),
    );
    selectedConcerns.forEach((v) =>
      chips.push({
        key: "concern",
        value: v,
        label: cosmetics.concerns.find((c) => c.slug === v)?.name ?? v,
      }),
    );
    if (searchParams.get("inStock") === "1") chips.push({ key: "inStock", value: "1", label: "Skladem" });
    if (searchParams.get("sale") === "1") chips.push({ key: "sale", value: "1", label: "Ve slevě" });
    return chips;
  }, [
    selectedBrands,
    selectedScents,
    selectedGenders,
    selectedConcentrations,
    selectedSkinTypes,
    selectedConcerns,
    searchParams,
    brands,
    scentFamilies,
    structure,
    cosmetics,
  ]);

  function removeChip(key: string, value: string) {
    updateParams((params) => {
      if (key === "inStock" || key === "sale") {
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
      <div>
        <label className="text-[11px] font-semibold tracking-wide text-accent-2 uppercase">
          Řazení
        </label>
        <select
          value={searchParams.get("sort") ?? "newest"}
          onChange={(e) => setSort(e.target.value)}
          className="mt-1 w-full rounded-sm border border-line px-2 py-1.5 text-sm text-ink"
        >
          {Object.entries(SORT_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
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
            Vymazat vše
          </button>
        </div>
      )}

      <div className="flex flex-col gap-2 border-b border-line pb-4">
        <label className="flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={searchParams.get("inStock") === "1"}
            onChange={() => toggleBoolean("inStock")}
            className="accent-accent"
          />
          Pouze skladem
        </label>
        <label className="flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={searchParams.get("sale") === "1"}
            onChange={() => toggleBoolean("sale")}
            className="accent-accent"
          />
          Ve slevě
        </label>
      </div>

      <FilterSection title="Cena (Kč)">
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            value={priceMin}
            onChange={(e) => setPriceMin(e.target.value)}
            onBlur={applyPriceRange}
            placeholder="od"
            className="w-full rounded-sm border border-line px-2 py-1 text-sm text-ink"
          />
          <input
            type="number"
            min={0}
            value={priceMax}
            onChange={(e) => setPriceMax(e.target.value)}
            onBlur={applyPriceRange}
            placeholder="do"
            className="w-full rounded-sm border border-line px-2 py-1 text-sm text-ink"
          />
        </div>
      </FilterSection>

      {structure.genderOptions.length > 0 && (
        <FilterSection title="Pro koho">
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
                  {option.name}
                  <span className="text-xs text-accent-2">({option.count})</span>
                </label>
              </li>
            ))}
          </ul>
        </FilterSection>
      )}

      {structure.concentrationOptions.length > 0 && (
        <FilterSection title="Typ">
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
                  {option.name}
                  <span className="text-xs text-accent-2">({option.count})</span>
                </label>
              </li>
            ))}
          </ul>
        </FilterSection>
      )}

      {scentFamilies.length > 0 && (
        <FilterSection title="Charakter vůně">
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
                  {family.name}
                  <span className="text-xs text-accent-2">({family.count})</span>
                </label>
              </li>
            ))}
          </ul>
        </FilterSection>
      )}

      {cosmetics.skinTypes.length > 0 && (
        <FilterSection title="Typ pleti">
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
                  {option.name}
                  <span className="text-xs text-accent-2">({option.count})</span>
                </label>
              </li>
            ))}
          </ul>
        </FilterSection>
      )}

      {cosmetics.concerns.length > 0 && (
        <FilterSection title="Účel">
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
                  {option.name}
                  <span className="text-xs text-accent-2">({option.count})</span>
                </label>
              </li>
            ))}
          </ul>
        </FilterSection>
      )}

      {brands.length > 0 && (
        <FilterSection title="Značka">
          <div className="flex flex-col gap-2">
            {brands.length > 8 && (
              <input
                value={brandQuery}
                onChange={(e) => setBrandQuery(e.target.value)}
                placeholder="Hledat značku…"
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
                Zobrazit všechny ({visibleBrands.length})
              </button>
            )}
          </div>
        </FilterSection>
      )}
    </aside>
  );
}
