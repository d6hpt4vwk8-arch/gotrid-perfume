"use client";

import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { usePathname, useRouter } from "@/i18n/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
      <summary className="flex cursor-pointer list-none items-center justify-between text-base font-bold text-ink sm:text-[13px] sm:font-bold sm:tracking-wide sm:text-ink sm:uppercase">
        {title}
        <span className="text-ink transition group-open:rotate-180">⌄</span>
      </summary>
      <div className="mt-3 sm:mt-2.5">{children}</div>
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
  const urlParams = useSearchParams();
  const { price, currency, czkToEurRate } = useCurrency();
  const tr = useTr();
  const isSk = useIsSk();
  const eur = currency === "EUR";

  const [priceMin, setPriceMin] = useState(() => czkToDisplay(urlParams.get("priceMin") ?? "", eur, czkToEurRate));
  const [priceMax, setPriceMax] = useState(() => czkToDisplay(urlParams.get("priceMax") ?? "", eur, czkToEurRate));
  const [brandQuery, setBrandQuery] = useState("");
  const [showAllBrands, setShowAllBrands] = useState(false);
  // Mobile: the filters open as a bottom sheet that works on a DRAFT of the URL params — ticking several filters
  // doesn't reload the page each time; "Zobrazit N produktů" applies them all at once. Desktop (sheet never opens)
  // keeps applying each change immediately.
  const [mobileOpen, setMobileOpen] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);
  const [draftCount, setDraftCount] = useState<number | null>(null);
  const [showFloating, setShowFloating] = useState(false);
  const draftRef = useRef<string | null>(null);
  const barRef = useRef<HTMLDivElement>(null);
  draftRef.current = draft;
  // Every read below goes through `searchParams`: the draft while the sheet is open, the real URL otherwise.
  const searchParams = useMemo(
    () => new URLSearchParams(mobileOpen && draft !== null ? draft : urlParams.toString()),
    [mobileOpen, draft, urlParams],
  );

  const selectedBrands = searchParams.getAll("brand");
  const selectedScents = searchParams.getAll("scent");
  const selectedGenders = searchParams.getAll("gender");
  const selectedConcentrations = searchParams.getAll("concentration");
  const selectedOccasions = searchParams.getAll("occasion");
  const selectedSkinTypes = searchParams.getAll("skinType");
  const selectedConcerns = searchParams.getAll("concern");
  const selectedKinds = searchParams.getAll("kind");
  const selectedIngredients = searchParams.getAll("ingredient");

  function updateParams(mutate: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(searchParams.toString());
    mutate(params);
    params.delete("page"); // any filter change resets pagination
    if (mobileOpen) setDraft(params.toString());
    else router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }

  const openSheet = useCallback(() => {
    setDraft(urlParams.toString());
    setDraftCount(null);
    setMobileOpen(true);
  }, [urlParams]);

  function closeSheet() {
    setMobileOpen(false);
    setDraft(null);
  }

  function applySheet() {
    const qs = draftRef.current ?? urlParams.toString();
    setMobileOpen(false);
    setDraft(null);
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    // Land on the filter bar (so the results start right below), not at the page top and not deep in the old list.
    setTimeout(() => barRef.current?.scrollIntoView({ block: "start" }), 60);
  }

  // Lock the page behind the sheet.
  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  // Floating "Filtry" button once the visitor has scrolled past the top bar.
  useEffect(() => {
    const onScroll = () => setShowFloating(window.scrollY > 450);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Live result count for the draft ("Zobrazit 357 produktů") — category pages only (the search page has tiered fallbacks).
  const categorySlug = pathname.match(/\/kategorie\/(.+)$/)?.[1] ?? null;
  useEffect(() => {
    if (!mobileOpen || draft === null || !categorySlug) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      const params = new URLSearchParams(draft);
      params.delete("page");
      params.set("count", "1");
      if (isSk) params.set("lang", "sk");
      fetch(`/api/category-products/${categorySlug}?${params.toString()}`, { signal: controller.signal })
        .then((res) => res.json())
        .then((data: { total?: number }) => setDraftCount(typeof data.total === "number" ? data.total : null))
        .catch(() => {});
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [mobileOpen, draft, categorySlug, isSk]);

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

  // The mobile bar's sort select lives outside the sheet, so it always applies immediately to the real URL.
  function setSortNow(sort: string) {
    const params = new URLSearchParams(urlParams.toString());
    params.set("sort", sort);
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
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
    if (mobileOpen) {
      setDraft(q ? `q=${encodeURIComponent(q)}` : "");
      return;
    }
    router.push(q ? `${pathname}?q=${encodeURIComponent(q)}` : pathname, { scroll: false });
  }

  function productsLabel(n: number) {
    const word = n === 1 ? tr("produkt") : n >= 2 && n <= 4 ? tr("produkty") : tr("produktů");
    return `${tr("Zobrazit")} ${n} ${word}`;
  }

  // Biggest brands first (alphabetical put "4711, Acqua Di Parma, Adam Levine…" — one product each — ahead of Lattafa
  // and Armaf, and only 8 show before "Zobrazit všechny"); selected brands stay on top.
  const visibleBrands = brands
    .filter((b) => b.name.toLowerCase().includes(brandQuery.toLowerCase()))
    .sort(
      (a, b) =>
        Number(selectedBrands.includes(b.slug)) - Number(selectedBrands.includes(a.slug)) ||
        b.count - a.count ||
        a.name.localeCompare(b.name, "cs"),
    );
  const brandsToShow = showAllBrands ? visibleBrands : visibleBrands.slice(0, 8);

  const activeCountUrl = activeChips.length;
  return (
    <aside className="flex w-full flex-col gap-4 sm:w-60 sm:shrink-0 xl:w-64">
      {/* Mobile: top bar (filters + sort) and the active filters as removable chips — always visible, no panel to open first. */}
      <div ref={barRef} className="flex scroll-mt-2 flex-col gap-2 sm:hidden">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={openSheet}
            className="flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-sm border border-ink px-4 py-2.5 text-sm font-semibold text-ink"
          >
            <span aria-hidden>☰</span>
            <span>{tr("Filtry")}{activeCountUrl > 0 && ` (${activeCountUrl})`}</span>
          </button>
          <select
            aria-label={tr("Řazení")}
            value={urlParams.get("sort") ?? "newest"}
            onChange={(e) => setSortNow(e.target.value)}
            className="min-w-0 flex-1 rounded-sm border border-line px-2 py-2.5 text-sm text-ink"
          >
            {Object.entries(SORT_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {tr(label)}
              </option>
            ))}
          </select>
        </div>
        {!mobileOpen && activeChips.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            {activeChips.map((chip) => (
              <button
                key={`m-${chip.key}-${chip.value}`}
                type="button"
                onClick={() => removeChip(chip.key, chip.value)}
                className="flex items-center gap-1 rounded-full bg-ink px-3 py-1.5 text-sm font-medium text-white"
              >
                {chip.label}
                <span aria-hidden>×</span>
              </button>
            ))}
            <button type="button" onClick={clearAll} className="text-sm text-accent-2 underline">
              {tr("Vymazat vše")}
            </button>
          </div>
        )}
      </div>

      {showFloating && !mobileOpen && (
        <button
          type="button"
          onClick={openSheet}
          className="fixed bottom-4 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white shadow-lg sm:hidden"
        >
          <span aria-hidden>☰</span>
          {tr("Filtry")}{activeCountUrl > 0 && ` (${activeCountUrl})`}
        </button>
      )}

      <div
        className={`${mobileOpen ? "fixed inset-0 z-50 flex flex-col justify-end bg-ink/50" : "hidden"} sm:static sm:z-auto sm:block sm:bg-transparent`}
        onClick={(e) => {
          if (mobileOpen && e.target === e.currentTarget) closeSheet();
        }}
      >
        <div className="flex max-h-[88vh] flex-col rounded-t-2xl bg-white sm:max-h-none sm:rounded-none sm:bg-transparent">
          <div className="flex items-center justify-between border-b border-line px-4 py-3 sm:hidden">
            <span className="text-base font-bold text-ink">{tr("Filtry")}</span>
            <div className="flex items-center gap-4">
              {activeChips.length > 0 && (
                <button type="button" onClick={clearAll} className="text-sm text-accent-2 underline">
                  {tr("Zrušit vše")}
                </button>
              )}
              <button type="button" onClick={closeSheet} aria-label={tr("Zavřít")} className="text-2xl leading-none text-ink">
                ×
              </button>
            </div>
          </div>
          <div className="flex flex-col gap-4 overflow-y-auto px-4 pb-4 pt-3 sm:overflow-visible sm:p-0">
      {topProducts.length > 0 && (
        <div className="hidden flex-col gap-2 border-b border-line pb-4 sm:flex">
          <span className="text-[13px] font-bold tracking-wide text-ink uppercase">
            {tr("Top prodejů")}
          </span>
          <ul className="flex flex-col gap-2">
            {topProducts.map((product) => {
              const image = product.images[0];
              return (
                <li key={product.slug}>
                  <Link
                    href={`/produkt/${product.slug}`}
                    className="group flex items-center gap-3 rounded-sm py-1 text-[15px] hover:bg-line/30"
                  >
                    <span className="relative h-14 w-14 shrink-0 overflow-hidden bg-line/60">
                      {image ? (
                        <Image src={image.url} alt={isSk && product.nameSk ? product.nameSk : product.name} fill sizes="56px" className="object-cover" />
                      ) : null}
                    </span>
                    <span className="flex flex-col gap-0.5 overflow-hidden">
                      <span className="line-clamp-2 text-ink group-hover:underline">{isSk && product.nameSk ? product.nameSk : product.name}</span>
                      <span className="font-bold text-ink">{price(product.price)}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="hidden sm:block">
        <label className="text-[13px] font-bold tracking-wide text-ink uppercase">
          {tr("Řazení")}
        </label>
        <select
          value={searchParams.get("sort") ?? "newest"}
          onChange={(e) => setSort(e.target.value)}
          className="mt-1.5 w-full rounded-sm border border-line px-2.5 py-2 text-[15px] text-ink"
        >
          {Object.entries(SORT_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {tr(label)}
            </option>
          ))}
        </select>
      </div>

      {activeChips.length > 0 && (
        <div className="flex flex-col gap-2 border-b border-line pb-4 sm:flex">
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
        <label className="flex items-center gap-2.5 text-base text-ink sm:text-[15px]">
          <input
            type="checkbox"
            checked={searchParams.get("sale") === "1"}
            onChange={() => toggleBoolean("sale")}
            className="filter-check"
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
            className="w-full rounded-sm border border-line px-3 py-2 text-base text-ink sm:px-2 sm:py-1 sm:text-sm"
          />
          <input
            type="number"
            min={0}
            value={priceMax}
            onChange={(e) => setPriceMax(e.target.value)}
            onBlur={applyPriceRange}
            placeholder={tr("do")}
            className="w-full rounded-sm border border-line px-3 py-2 text-base text-ink sm:px-2 sm:py-1 sm:text-sm"
          />
        </div>
      </FilterSection>

      {structure.genderOptions.length > 0 && (
        <FilterSection title={tr("Pro koho")}>
          <ul className="flex flex-col gap-3 sm:gap-2.5">
            {structure.genderOptions.map((option) => (
              <li key={option.slug}>
                <label className="flex items-center gap-2.5 text-base text-ink sm:text-[15px]">
                  <input
                    type="checkbox"
                    checked={selectedGenders.includes(option.slug)}
                    onChange={() => toggleMulti("gender", selectedGenders, option.slug)}
                    className="filter-check"
                  />
                  {tr(option.name)}
                  <span className="text-sm text-accent-2 sm:text-[13px]">({option.count})</span>
                </label>
              </li>
            ))}
          </ul>
        </FilterSection>
      )}

      {structure.concentrationOptions.length > 0 && (
        <FilterSection title={tr("Typ")}>
          <ul className="flex flex-col gap-3 sm:gap-2.5">
            {structure.concentrationOptions.map((option) => (
              <li key={option.slug}>
                <label className="flex items-center gap-2.5 text-base text-ink sm:text-[15px]">
                  <input
                    type="checkbox"
                    checked={selectedConcentrations.includes(option.slug)}
                    onChange={() => toggleMulti("concentration", selectedConcentrations, option.slug)}
                    className="filter-check"
                  />
                  {tr(option.name)}
                  <span className="text-sm text-accent-2 sm:text-[13px]">({option.count})</span>
                </label>
              </li>
            ))}
          </ul>
        </FilterSection>
      )}

      {scentFamilies.length > 0 && (
        <FilterSection title={tr("Charakter vůně")}>
          <ul className="flex flex-col gap-3 sm:gap-2.5">
            {scentFamilies.map((family) => (
              <li key={family.slug}>
                <label className="flex items-center gap-2.5 text-base text-ink sm:text-[15px]">
                  <input
                    type="checkbox"
                    checked={selectedScents.includes(family.slug)}
                    onChange={() => toggleMulti("scent", selectedScents, family.slug)}
                    className="filter-check"
                  />
                  {tr(family.name)}
                  <span className="text-sm text-accent-2 sm:text-[13px]">({family.count})</span>
                </label>
              </li>
            ))}
          </ul>
        </FilterSection>
      )}

      {structure.occasionOptions.length > 0 && (
        <FilterSection title={tr("Příležitost")}>
          <ul className="flex flex-col gap-3 sm:gap-2.5">
            {structure.occasionOptions.map((option) => (
              <li key={option.slug}>
                <label className="flex items-center gap-2.5 text-base text-ink sm:text-[15px]">
                  <input
                    type="checkbox"
                    checked={selectedOccasions.includes(option.slug)}
                    onChange={() => toggleMulti("occasion", selectedOccasions, option.slug)}
                    className="filter-check"
                  />
                  {tr(option.name)}
                  <span className="text-sm text-accent-2 sm:text-[13px]">({option.count})</span>
                </label>
              </li>
            ))}
          </ul>
        </FilterSection>
      )}

      {cosmetics.productTypes.length > 0 && (
        <FilterSection title={tr("Druh produktu")}>
          <ul className="flex flex-col gap-3 sm:gap-2.5">
            {cosmetics.productTypes.map((option) => (
              <li key={option.slug}>
                <label className="flex items-center gap-2.5 text-base text-ink sm:text-[15px]">
                  <input
                    type="checkbox"
                    checked={selectedKinds.includes(option.slug)}
                    onChange={() => toggleMulti("kind", selectedKinds, option.slug)}
                    className="filter-check"
                  />
                  {tr(option.name)}
                  <span className="text-sm text-accent-2 sm:text-[13px]">({option.count})</span>
                </label>
              </li>
            ))}
          </ul>
        </FilterSection>
      )}

      {cosmetics.concerns.length > 0 && (
        <FilterSection title={tr("Účel")}>
          <ul className="flex flex-col gap-3 sm:gap-2.5">
            {cosmetics.concerns.map((option) => (
              <li key={option.slug}>
                <label className="flex items-center gap-2.5 text-base text-ink sm:text-[15px]">
                  <input
                    type="checkbox"
                    checked={selectedConcerns.includes(option.slug)}
                    onChange={() => toggleMulti("concern", selectedConcerns, option.slug)}
                    className="filter-check"
                  />
                  {tr(option.name)}
                  <span className="text-sm text-accent-2 sm:text-[13px]">({option.count})</span>
                </label>
              </li>
            ))}
          </ul>
        </FilterSection>
      )}

      {cosmetics.skinTypes.length > 0 && (
        <FilterSection title={tr("Typ pleti")}>
          <ul className="flex flex-col gap-3 sm:gap-2.5">
            {cosmetics.skinTypes.map((option) => (
              <li key={option.slug}>
                <label className="flex items-center gap-2.5 text-base text-ink sm:text-[15px]">
                  <input
                    type="checkbox"
                    checked={selectedSkinTypes.includes(option.slug)}
                    onChange={() => toggleMulti("skinType", selectedSkinTypes, option.slug)}
                    className="filter-check"
                  />
                  {tr(option.name)}
                  <span className="text-sm text-accent-2 sm:text-[13px]">({option.count})</span>
                </label>
              </li>
            ))}
          </ul>
        </FilterSection>
      )}

      {cosmetics.ingredients.length > 0 && (
        <FilterSection title={tr("Složka")}>
          <ul className="flex flex-col gap-3 sm:gap-2.5">
            {cosmetics.ingredients.map((option) => (
              <li key={option.slug}>
                <label className="flex items-center gap-2.5 text-base text-ink sm:text-[15px]">
                  <input
                    type="checkbox"
                    checked={selectedIngredients.includes(option.slug)}
                    onChange={() => toggleMulti("ingredient", selectedIngredients, option.slug)}
                    className="filter-check"
                  />
                  {tr(option.name)}
                  <span className="text-sm text-accent-2 sm:text-[13px]">({option.count})</span>
                </label>
              </li>
            ))}
          </ul>
        </FilterSection>
      )}

      {(cosmetics.vegan > 0 || cosmetics.crueltyFree > 0) && (
        <FilterSection title={tr("Vlastnosti")}>
          <ul className="flex flex-col gap-3 sm:gap-2.5">
            {cosmetics.vegan > 0 && (
              <li>
                <label className="flex items-center gap-2.5 text-base text-ink sm:text-[15px]">
                  <input
                    type="checkbox"
                    checked={searchParams.get("vegan") === "1"}
                    onChange={() => toggleBoolean("vegan")}
                    className="filter-check"
                  />
                  Vegan
                  <span className="text-sm text-accent-2 sm:text-[13px]">({cosmetics.vegan})</span>
                </label>
              </li>
            )}
            {cosmetics.crueltyFree > 0 && (
              <li>
                <label className="flex items-center gap-2.5 text-base text-ink sm:text-[15px]">
                  <input
                    type="checkbox"
                    checked={searchParams.get("cf") === "1"}
                    onChange={() => toggleBoolean("cf")}
                    className="filter-check"
                  />
                  Cruelty-free
                  <span className="text-sm text-accent-2 sm:text-[13px]">({cosmetics.crueltyFree})</span>
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
                className="rounded-sm border border-line px-3 py-2 text-base text-ink sm:px-2 sm:py-1 sm:text-sm"
              />
            )}
            <ul className="flex max-h-64 flex-col gap-1.5 overflow-y-auto">
              {brandsToShow.map((brand) => (
                <li key={brand.slug}>
                  <label className="flex items-center gap-2.5 text-base text-ink sm:text-[15px]">
                    <input
                      type="checkbox"
                      checked={selectedBrands.includes(brand.slug)}
                      onChange={() => toggleMulti("brand", selectedBrands, brand.slug)}
                      className="filter-check"
                    />
                    {brand.name}
                    <span className="text-sm text-accent-2 sm:text-[13px]">({brand.count})</span>
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
          <div className="border-t border-line bg-white px-4 py-3 sm:hidden">
            <button
              type="button"
              onClick={applySheet}
              className="w-full rounded-sm bg-ink px-4 py-3 text-sm font-semibold text-white"
            >
              {draftCount !== null ? productsLabel(draftCount) : tr("Zobrazit výsledky")}
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
