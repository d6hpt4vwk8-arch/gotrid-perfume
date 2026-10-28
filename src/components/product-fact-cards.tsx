import type { ReactNode } from "react";
import type { DescriptionFacts, SkinKey } from "@/lib/description-facts";
import { getTr } from "@/i18n/tr.server";

const SKIN_LABELS: Record<SkinKey, string> = {
  all: "Všechny typy pleti",
  dry: "Suchá pleť",
  oily: "Mastná pleť",
  combo: "Smíšená pleť",
  sensitive: "Citlivá pleť",
  blemish: "Problematická pleť",
  normal: "Normální pleť",
  mature: "Zralá pleť",
};

function Icon({ children }: { children: ReactNode }) {
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink/5 text-ink">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {children}
      </svg>
    </span>
  );
}

const heading = "text-[11px] font-semibold tracking-wide text-accent-2 uppercase";

/**
 * The labelled facts of a K-beauty description (see description-facts.ts) as icon cards: skin type chips,
 * how to use it (with morning/evening badges) and the main benefits as a tick list.
 */
export async function ProductFactCards({ facts }: { facts: DescriptionFacts }) {
  const tr = await getTr();

  return (
    <div className="mt-4 flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex gap-3 rounded-sm border border-line p-4">
          <Icon>
            <circle cx="12" cy="8" r="3.5" />
            <path d="M5 20c0-3.9 3.1-7 7-7s7 3.1 7 7" />
          </Icon>
          <div className="min-w-0">
            <h3 className={heading}>{tr("Pro koho")}</h3>
            {facts.skin.length > 0 && (
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {facts.skin.map((key) => (
                  <li key={key} className="rounded-full bg-ink px-2.5 py-0.5 text-xs font-medium text-white">
                    {tr(SKIN_LABELS[key])}
                  </li>
                ))}
              </ul>
            )}
            {/* "všechny typy pleti" repeated under its own chip says nothing more */}
            {!(facts.skin.length === 1 && facts.skin[0] === "all" && facts.forWhom.length <= 28) && (
              <p className="mt-2 text-sm leading-relaxed text-ink/80">{facts.forWhom}</p>
            )}
          </div>
        </div>

        <div className="flex gap-3 rounded-sm border border-line p-4">
          <Icon>
            <path d="M12 3s6 6.2 6 10.5A6 6 0 0 1 6 13.5C6 9.2 12 3 12 3Z" />
          </Icon>
          <div className="min-w-0">
            <h3 className={heading}>{tr("Použití")}</h3>
            {facts.dayTimes.length > 0 && (
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {facts.dayTimes.includes("am") && (
                  <li className="flex items-center gap-1 rounded-full border border-line px-2.5 py-0.5 text-xs font-medium text-ink">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                      <circle cx="12" cy="12" r="4" />
                      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
                    </svg>
                    {tr("Ráno")}
                  </li>
                )}
                {facts.dayTimes.includes("pm") && (
                  <li className="flex items-center gap-1 rounded-full border border-line px-2.5 py-0.5 text-xs font-medium text-ink">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z" />
                    </svg>
                    {tr("Večer")}
                  </li>
                )}
              </ul>
            )}
            <p className="mt-2 text-sm leading-relaxed text-ink/80">{facts.usage}</p>
          </div>
        </div>
      </div>

      <div className="flex gap-3 rounded-sm border border-line bg-line/20 p-4">
        <Icon>
          <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z" />
          <path d="M19 16l.7 1.8L21.5 18.5l-1.8.7L19 21l-.7-1.8-1.8-.7 1.8-.7L19 16Z" />
        </Icon>
        <div className="min-w-0 flex-1">
          <h3 className={heading}>{tr("Hlavní přínosy")}</h3>
          <ul className="mt-2 grid gap-x-4 gap-y-1.5 sm:grid-cols-2">
            {facts.benefits.map((benefit) => (
              <li key={benefit} className="flex items-start gap-2 text-sm leading-snug text-ink">
                <svg className="mt-0.5 shrink-0 text-ok" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="m5 12.5 4.5 4.5L19 7.5" />
                </svg>
                <span>{benefit}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
