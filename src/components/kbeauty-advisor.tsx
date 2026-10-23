"use client";

import { useState } from "react";
import { Link } from "@/i18n/navigation";
import { useTr, useIsSk } from "@/i18n/use-tr";
import { ProductCard, type ProductCardData } from "@/components/product-card";
import { PRODUCT_TYPE_LABELS } from "@/lib/cosmetics-taxonomy";

export interface AdvisorConcern {
  slug: string;
  /** Concern name from the DB (Czech) — translated with tr(). */
  name: string;
  count: number;
}

const CATEGORY_PATH = "/kategorie/kosmetika/korejska-kosmetika";

const SKIN_OPTIONS = [
  { value: "sucha", label: "Suchá pleť" },
  { value: "mastna", label: "Mastná pleť" },
  { value: "citliva", label: "Citlivá pleť" },
  { value: "", label: "Smíšená nebo normální" },
  { value: "", label: "Nevím" },
];

const KIND_OPTIONS = [
  { value: "cisteni", label: PRODUCT_TYPE_LABELS.cisteni! },
  { value: "tonika", label: PRODUCT_TYPE_LABELS.tonika! },
  { value: "sera", label: PRODUCT_TYPE_LABELS.sera! },
  { value: "kremy", label: PRODUCT_TYPE_LABELS.kremy! },
  { value: "slunce", label: PRODUCT_TYPE_LABELS.slunce! },
  { value: "masky", label: PRODUCT_TYPE_LABELS.masky! },
  { value: "", label: "Cokoliv" },
];

interface Result {
  total: number;
  dropped: string[];
  path: string;
  products: ProductCardData[];
}

/**
 * K-beauty category entry point, modelled on how Czech K-beauty shops lead with the shopper's problem rather
 * than the catalogue: concern tiles ("Řekni, co řešíš") that link into the existing filters, and a three-question
 * quiz that ends in a shortlist (API: /api/kbeauty-advisor).
 */
export function KbeautyAdvisor({
  concerns,
  freeShippingThreshold,
}: {
  concerns: AdvisorConcern[];
  freeShippingThreshold?: number;
}) {
  const tr = useTr();
  const isSk = useIsSk();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({ skinType: "", concern: "", concernLabel: "", kind: "" });
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);

  function reset() {
    setStep(0);
    setAnswers({ skinType: "", concern: "", concernLabel: "", kind: "" });
    setResult(null);
  }

  async function finish(next: typeof answers) {
    setLoading(true);
    setStep(3);
    try {
      const qs = new URLSearchParams();
      if (next.skinType) qs.set("skinType", next.skinType);
      if (next.concern) qs.set("concern", next.concern);
      if (next.kind) qs.set("kind", next.kind);
      if (isSk) qs.set("lang", "sk");
      const res = await fetch(`/api/kbeauty-advisor?${qs.toString()}`);
      setResult((await res.json()) as Result);
    } catch {
      setResult({ total: 0, dropped: [], path: CATEGORY_PATH, products: [] });
    } finally {
      setLoading(false);
    }
  }

  const optionClass =
    "rounded-sm border border-line px-3 py-2.5 text-left text-sm text-ink transition hover:border-accent hover:text-accent";

  return (
    <section className="flex flex-col gap-4 border-b border-line pb-8" aria-label={tr("Řekni, co řešíš")}>
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-bold text-ink">{tr("Řekni, co řešíš")}</h2>
        <p className="text-sm text-accent-2">
          {tr("Vyberte, co vám dělá největší starosti, a ukážeme produkty, které na to míří.")}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {concerns.map((c) => (
          <Link
            key={c.slug}
            href={`${CATEGORY_PATH}?concern=${c.slug}`}
            className="flex flex-col gap-0.5 rounded-sm border border-line p-3 transition hover:border-accent"
          >
            <span className="text-sm font-semibold text-ink">{tr(c.name)}</span>
            <span className="text-xs text-accent-2">
              {c.count} {c.count === 1 ? tr("produkt") : c.count < 5 ? tr("produkty") : tr("produktů")}
            </span>
          </Link>
        ))}
        <button
          type="button"
          onClick={() => {
            setOpen((v) => !v);
            if (!open) reset();
          }}
          className="flex flex-col gap-0.5 rounded-sm bg-ink p-3 text-left text-white transition hover:bg-accent"
        >
          <span className="text-sm font-semibold">{tr("Nevím, poraďte mi")}</span>
          <span className="text-xs text-white/70">{tr("Test na 3 otázky")}</span>
        </button>
      </div>

      {open && (
        <div className="flex flex-col gap-4 rounded-sm border border-line bg-line/20 p-4 sm:p-6">
          {step < 3 && (
            <>
              <div className="flex items-center justify-between text-xs text-accent-2">
                <span>{tr("Krok {n} ze 3", { n: step + 1 })}</span>
                {step > 0 && (
                  <button type="button" onClick={() => setStep(step - 1)} className="underline hover:text-accent">
                    {tr("Zpět")}
                  </button>
                )}
              </div>
              <h3 className="text-base font-bold text-ink">
                {step === 0 && tr("Jakou máte pleť?")}
                {step === 1 && tr("Co chcete řešit nejvíc?")}
                {step === 2 && tr("Co právě hledáte?")}
              </h3>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {step === 0 &&
                  SKIN_OPTIONS.map((o) => (
                    <button
                      key={o.label}
                      type="button"
                      className={optionClass}
                      onClick={() => {
                        setAnswers((a) => ({ ...a, skinType: o.value }));
                        setStep(1);
                      }}
                    >
                      {tr(o.label)}
                    </button>
                  ))}
                {step === 1 && (
                  <>
                    {concerns.map((c) => (
                      <button
                        key={c.slug}
                        type="button"
                        className={optionClass}
                        onClick={() => {
                          setAnswers((a) => ({ ...a, concern: c.slug, concernLabel: c.name }));
                          setStep(2);
                        }}
                      >
                        {tr(c.name)}
                      </button>
                    ))}
                    <button
                      type="button"
                      className={optionClass}
                      onClick={() => {
                        setAnswers((a) => ({ ...a, concern: "", concernLabel: "" }));
                        setStep(2);
                      }}
                    >
                      {tr("Nic konkrétního, základní péče")}
                    </button>
                  </>
                )}
                {step === 2 &&
                  KIND_OPTIONS.map((o) => (
                    <button
                      key={o.label}
                      type="button"
                      className={optionClass}
                      onClick={() => {
                        const next = { ...answers, kind: o.value };
                        setAnswers(next);
                        void finish(next);
                      }}
                    >
                      {tr(o.label)}
                    </button>
                  ))}
              </div>
            </>
          )}

          {step === 3 && (
            <div className="flex flex-col gap-4">
              {loading || !result ? (
                <p className="text-sm text-accent-2">{tr("Hledáme vhodné produkty…")}</p>
              ) : (
                <>
                  <h3 className="text-base font-bold text-ink">
                    {result.total > 0 ? tr("Doporučujeme vám:") : tr("Nic přesného jsme nenašli.")}
                  </h3>
                  {result.dropped.length > 0 && result.total > 0 && (
                    <p className="text-sm text-accent-2">
                      {tr("Přesně tuto kombinaci jsme nenašli, tady jsou nejbližší produkty.")}
                    </p>
                  )}
                  {result.products.length > 0 && (
                    <div className="grid grid-cols-2 gap-x-4 gap-y-8 lg:grid-cols-4">
                      {result.products.map((p) => (
                        <ProductCard key={p.id} product={p} freeShippingThreshold={freeShippingThreshold} />
                      ))}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-3">
                    <Link
                      href={result.path}
                      className="rounded-sm bg-ink px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-accent"
                    >
                      {tr("Zobrazit všech {n} produktů", { n: result.total })}
                    </Link>
                    <button type="button" onClick={reset} className="rounded-sm border border-line px-4 py-2.5 text-sm text-ink hover:border-accent hover:text-accent">
                      {tr("Začít znovu")}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
