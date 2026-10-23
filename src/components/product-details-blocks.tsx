import type { ProductDetails } from "@/lib/product-details";
import { getTr } from "@/i18n/tr.server";

/**
 * Structured product-page blocks (Product.details): who it is for, key ingredients as cards, numbered
 * usage steps, what to expect and an FAQ accordion — the pieces competitors' pages use to answer
 * "is this for me, and how do I use it" without the shopper leaving the page.
 */
export async function ProductDetailsBlocks({ details }: { details: ProductDetails }) {
  const tr = await getTr();
  const { forWhom, ingredients, howToUse, expect, faq } = details;

  const heading = "mb-3 text-[11px] font-semibold tracking-wide text-accent-2 uppercase";

  return (
    <section className="flex flex-col gap-8 border-t border-line pt-6" aria-label={tr("O produktu v kostce")}>
      {faq && faq.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "FAQPage",
              mainEntity: faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
            }).replace(/</g, "\\u003c"),
          }}
        />
      )}

      <h2 className="text-lg font-bold text-ink">{tr("O produktu v kostce")}</h2>

      {(forWhom || expect) && (
        <div className="grid gap-4 sm:grid-cols-2">
          {forWhom && (
            <div className="rounded-sm border border-line bg-line/20 p-4">
              <h3 className={heading}>{tr("Pro koho je určen")}</h3>
              <p className="text-sm leading-relaxed text-ink/80">{forWhom}</p>
            </div>
          )}
          {expect && (
            <div className="rounded-sm border border-line bg-line/20 p-4">
              <h3 className={heading}>{tr("Co můžete očekávat")}</h3>
              <p className="text-sm leading-relaxed text-ink/80">{expect}</p>
            </div>
          )}
        </div>
      )}

      {ingredients && ingredients.length > 0 && (
        <div>
          <h3 className={heading}>{tr("Klíčové složky")}</h3>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {ingredients.map((item) => (
              <li key={item.name} className="rounded-sm border border-line p-4">
                <p className="text-sm font-semibold text-ink">{item.name}</p>
                <p className="mt-1 text-sm leading-relaxed text-ink/70">{item.text}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {howToUse && howToUse.length > 0 && (
        <div>
          <h3 className={heading}>{tr("Jak používat")}</h3>
          <ol className="flex flex-col gap-2">
            {howToUse.map((step, i) => (
              <li key={step} className="flex gap-3 text-sm leading-relaxed text-ink/80">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-semibold text-white">
                  {i + 1}
                </span>
                <span className="pt-0.5">{step}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {faq && faq.length > 0 && (
        <div>
          <h3 className={heading}>{tr("Časté otázky k produktu")}</h3>
          <div className="divide-y divide-line border-y border-line">
            {faq.map((item) => (
              <details key={item.q} className="group py-3">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-medium text-ink">
                  {item.q}
                  <span aria-hidden className="text-accent-2 transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="mt-2 text-sm leading-relaxed text-ink/70">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
