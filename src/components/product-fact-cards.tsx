import type { CSSProperties, ReactNode } from "react";
import type { DescriptionFacts, ScentFacts, ScentTime, Season, SkinKey } from "@/lib/description-facts";
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

const DROP = "M12 3s6 6.2 6 10.5A6 6 0 0 1 6 13.5C6 9.2 12 3 12 3Z";

/** Line icons (24px grid, 1.5 stroke) shared by the benefit tiles and the skin-type tags. */
const ICONS = {
  drop: <path d={DROP} />,
  leaf: (
    <>
      <path d="M5 19c0-8 5-14 14-14 0 9-6 14-14 14Z" />
      <path d="M5 19c3-4 6-6.5 9-8" />
    </>
  ),
  sparkle: (
    <>
      <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z" />
      <path d="M19 16l.7 1.8 1.8.7-1.8.7L19 21l-.7-1.8-1.8-.7 1.8-.7L19 16Z" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
  moon: <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z" />,
  bubbles: (
    <>
      <circle cx="9" cy="14" r="4.5" />
      <circle cx="17" cy="7.5" r="2.5" />
      <circle cx="17.5" cy="16.5" r="1.5" />
    </>
  ),
  shield: <path d="M12 3l7 3v5.5c0 4.2-2.9 7.6-7 9.5-4.1-1.9-7-5.3-7-9.5V6l7-3Z" />,
  fresh: <path d="M12 3v18M4.2 7.5l15.6 9M19.8 7.5l-15.6 9" />,
  hair: (
    <>
      <path d="M8 4c3 3-3 5 0 8s-3 5 0 8" />
      <path d="M15 4c3 3-3 5 0 8s-3 5 0 8" />
    </>
  ),
  tooth: <path d="M7.5 4C5 4 3.8 6 4 8.5c.3 3.2 1.7 4.7 2.2 7.5.3 2 .9 4 2.2 4 1.6 0 1.4-3.5 3.6-3.5s2 3.5 3.6 3.5c1.3 0 1.9-2 2.2-4 .5-2.8 1.9-4.3 2.2-7.5C20.2 6 19 4 16.5 4c-1.8 0-2.6.9-4.5.9S9.3 4 7.5 4Z" />,
  bottle: (
    <>
      <path d="M10 3h4v3h-4z" />
      <path d="M9 6h6l2 3v11a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V9l2-3Z" />
    </>
  ),
  feather: (
    <>
      <path d="M20 4c-8 0-13 4-13 11l-2 5" />
      <path d="M20 4c0 8-4 12-11 12" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  lift: <path d="M12 19V5M6 11l6-6 6 6" />,
  grid: (
    <>
      <rect x="4" y="4" width="6.5" height="6.5" rx="1" />
      <rect x="13.5" y="4" width="6.5" height="6.5" rx="1" />
      <rect x="4" y="13.5" width="6.5" height="6.5" rx="1" />
      <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1" />
    </>
  ),
  oily: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M8.5 9.5a4.5 4.5 0 0 1 3-2" />
    </>
  ),
  half: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 4v16" />
    </>
  ),
  spots: (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="9.5" cy="10" r="1" />
      <circle cx="14.5" cy="13.5" r="1" />
      <circle cx="10.5" cy="15" r=".8" />
    </>
  ),
  tick: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12.5 3 3 5-6" />
    </>
  ),
  flower: (
    <>
      <circle cx="12" cy="12" r="2" />
      {[0, 72, 144, 216, 288].map((deg) => (
        <path key={deg} d="M12 9.6c-1.1-2.4-.9-4.8 0-6.6.9 1.8 1.1 4.2 0 6.6Z" transform={`rotate(${deg} 12 12)`} />
      ))}
    </>
  ),
  citrus: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="5.5" />
      <path d="M12 6.5v11M7.2 9.2l9.6 5.6M16.8 9.2l-9.6 5.6" />
    </>
  ),
  wood: <path d="M12 21v-5M12 3l5.5 7h-3L18 16H6l3.5-6h-3L12 3Z" />,
  heart: <path d="M12 20s-7-4.4-7-9.6A3.9 3.9 0 0 1 12 8a3.9 3.9 0 0 1 7 2.4C19 15.6 12 20 12 20Z" />,
  apple: (
    <>
      <path d="M12 8c-1.5-1.3-6-1.3-6 3.8 0 4 2.6 8.2 6 8.2s6-4.2 6-8.2C18 6.7 13.5 6.7 12 8Z" />
      <path d="M12 8c0-2 .8-3.5 2.5-4.5" />
    </>
  ),
  flame: <path d="M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 .2 1.5 1 2 1.5 2C10.5 8 11 5.5 12 3Z" />,
  cloud: <path d="M7 18h10a4 4 0 0 0 .5-8A5.5 5.5 0 0 0 7 8.5 4.8 4.8 0 0 0 7 18Z" />,
  cup: (
    <>
      <path d="M5 9h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5V9Z" />
      <path d="M16 10.5h1.5a2.5 2.5 0 0 1 0 5H15.5" />
      <path d="M9 3.5c-.8 1 .8 2 0 3M12.5 3.5c-.8 1 .8 2 0 3" />
    </>
  ),
  bean: (
    <>
      <path d="M12 3.5c4.2 0 6.5 4 6.5 8.5s-2.6 8.5-6.5 8.5S5.5 16.5 5.5 12 7.8 3.5 12 3.5Z" />
      <path d="M12 3.5c-2 3-2 5.5 0 8.5s2 5.5 0 8.5" />
    </>
  ),
  smoke: <path d="M4 9c2-2 4 2 6 0s4 2 6 0 4 2 4 0M4 15c2-2 4 2 6 0s4 2 6 0 4 2 4 0" />,
  user: (
    <>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c0-3.9 3.1-7 7-7s7 3.1 7 7" />
    </>
  ),
} satisfies Record<string, ReactNode>;

type IconName = keyof typeof ICONS;

/** First match wins; the pattern is run on the lower-cased benefit phrase (Czech and Slovak stems). */
const BENEFIT_ICON_RULES: [RegExp, IconName][] = [
  [/spf|uv\b|uv-|slunce|sluneč|slnečn/, "sun"],
  [/hydrat|vlh|zvlh|vody|vodu|voda|suchost|sucho/, "drop"],
  [/zklid|podráž|podraz|začerven|zacerven|citliv|alerg|svěd|svrb/, "leaf"],
  [/přírodn|prirodn|vegan|bio\b|extrakt|bylin|rostlin|čajovn|cajovn|tea tree|aloe|centell|heřmán|hermán|kopřiv/, "leaf"],
  [/vrásk|vrask|vrások|liftin|zpevň|zpevn|elasti|kolagen|anti-?age|omlaz|stárnut|starnut/, "lift"],
  [/rozjas|pigment|skvrn|vybělí|vybeli|jas\b|jasn|záře|zare|sjednoc|tón|ton pleti/, "sparkle"],
  [/čist|cist|odstraň|odstran|make-?up|pór|por[uy]|sebum|mastn|lesk|peeling|exfol/, "bubbles"],
  [/bariér|barier|posil|regener|obnov|výživ|vyziv|ochran|chrán|chran/, "shield"],
  [/osvěž|osvez|chlad|máta|mata|mint|mentol|svěž|svez/, "fresh"],
  [/vlas|šampon|sampon|pokožk[ay] hlavy|pokožka hlavy|lupy|kondicion/, "hair"],
  [/zub|zubn|dech|ústní|ustni|dásn|dasn|zubní/, "tooth"],
  [/vůn|vun|parfém|parfem|aroma|svíč|svic/, "bottle"],
  [/lehk|vstřeb|vstreb|nemast|nelepiv|jemn/, "feather"],
  [/dlouh|trvan|celodenn|až \d+ hod|24 ?h/, "clock"],
];

/** Perfume / candle note → icon, first match wins (Czech and Slovak stems). */
const NOTE_ICON_RULES: [RegExp, IconName][] = [
  [/citr|bergamot|pomeran|mandarink|grep|limet|limon|yuzu|neroli|pomelo|cedrát|pomaranč/, "citrus"],
  [/růž|ruz|jasmín|jazmín|květ|kvet|pivoň|pivon|lili|fialk|orchid|gardén|tuberóz|heliotrop|levandul|iris|kosatec|magnól|magnol|ylang|frézi|konvalin|mimóz|pelargón|lotos|lotus|santolin/, "flower"],
  [/dřev|drev|cedr|santal|vetiver|pačul|pacul|\bdub|mech|\boud|agar|cypřiš|cyprus|borovic|jedl/, "wood"],
  [/kadidl|kouř|kour|dým|dym|myrh|pryskyř|pryskyr|balzám|labdan|benzoin|tabák|tabak/, "smoke"],
  [/pistác|kokos|ořech|orech|mandl|lískov|kakao|kakaov|tonka|burák/, "bean"],
  [/mléko|mlieko|smetan|krém|krem|máslo|maslo/, "drop"],
  [/vanil|karamel|\bmed\b|čokolád|cokolad|cukr|bonbon|prali|sladk|marcipán|zmrzlin|dezert/, "heart"],
  [/jablk|hrušk|hrusk|broskv|malin|jahod|třešn|tresn|čerešn|ostružin|rybíz|rybez|liči|fík|fik|ananas|mango|meloun|melón|švestk|slivk|borůvk|čučoriedk|ovoc|ovocn|kiwi|marhul|meruňk|granátov/, "apple"],
  [/pepř|pepr|skořic|skoric|škorica|kardamom|hřebíč|hrebíč|šafrán|safran|zázvor|zazvor|muškát|muskat|koření|korenie|badyán|kmín|chilli|kořen|koren/, "flame"],
  [/pižm|pizm|ambr|mošus|musk|ambroxan|kůž|kuz|kož|zamat|semišov/, "cloud"],
  [/káv|kav|likér|liker|\brum|whisk|koňak|konak|alkohol|víno|vino|šampaň|champag/, "cup"],
  [/máta|mata|mint|bazalk|šalvěj|šalvia|salvej|tymián|rozmar|zelen|tráv|trav|list|bylin|čaj|caj|eukalypt|aloe|okurk|uhork/, "leaf"],
  [/vod[aěyu]|vodn|moř|mor[sš]k|oceán|ozón|ozon|aqua|mineráln|sůl|soľ|déšť|dážď|led\b|ľad/, "drop"],
];

function noteIcon(text: string): IconName {
  const lower = text.toLowerCase();
  for (const [re, name] of NOTE_ICON_RULES) if (re.test(lower)) return name;
  return "sparkle";
}

function benefitIcon(text: string): IconName {
  const lower = text.toLowerCase();
  for (const [re, name] of BENEFIT_ICON_RULES) if (re.test(lower)) return name;
  return "tick";
}

const SKIN_ICONS: Record<SkinKey, IconName> = {
  all: "grid",
  dry: "drop",
  oily: "oily",
  combo: "half",
  sensitive: "shield",
  blemish: "spots",
  normal: "tick",
  mature: "clock",
};

function Svg({ name, size, className, strokeWidth = 1.5 }: { name: IconName; size: number; className?: string; strokeWidth?: number }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONS[name]}
    </svg>
  );
}

const heading = "text-[11px] font-semibold tracking-[0.08em] text-accent-2 uppercase";
/** Soft sage badge behind a line icon — the site's green at 10 %, so it reads as natural rather than UI. */
const badge = "flex shrink-0 items-center justify-center rounded-full bg-ok/10 text-ok";

/**
 * The labelled facts of a description (see description-facts.ts). The benefits lead — they are what sells — as large
 * icons over short captions (icon picked from the wording); who it is for and how to use it follow in two columns.
 */
export async function ProductFactCards({ facts }: { facts: DescriptionFacts }) {
  const tr = await getTr();
  const hasBenefits = facts.benefits.length > 0;
  // "všechny typy pleti" repeated under its own chip says nothing more
  const showForWhom = !(facts.skin.length === 1 && facts.skin[0] === "all" && facts.forWhom.length <= 28);
  // One or two benefits read better as icon + text side by side; three or more as a row of captioned icons.
  const few = facts.benefits.length <= 2;

  return (
    <div className="mt-6 flex flex-col gap-7">
      {hasBenefits && (
        <section>
          <h3 className={heading}>{tr("Hlavní přínosy")}</h3>
          <ul
            className={
              few
                ? "mt-4 flex flex-wrap gap-x-10 gap-y-4"
                : "mt-5 grid grid-cols-2 gap-x-4 gap-y-7 sm:[grid-template-columns:repeat(auto-fit,minmax(9.5rem,1fr))]"
            }
          >
            {facts.benefits.map((benefit) => (
              <li key={benefit} className={few ? "flex items-center gap-3.5" : "flex flex-col items-center gap-3 text-center"}>
                <span className={`${badge} ${few ? "h-12 w-12" : "h-16 w-16"}`}>
                  <Svg name={benefitIcon(benefit)} size={few ? 24 : 28} strokeWidth={1.4} />
                </span>
                <span className={`text-sm font-medium leading-snug text-ink ${few ? "" : "max-w-[11rem]"}`}>{benefit}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className={`grid gap-x-8 gap-y-6 sm:grid-cols-2 ${hasBenefits ? "border-t border-line pt-6" : ""}`}>
        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex items-center gap-2.5">
            <span className={`${badge} h-8 w-8`}>
              <Svg name="user" size={16} />
            </span>
            <h3 className={heading}>{tr("Pro koho")}</h3>
          </div>
          {facts.skin.length > 0 && (
            <ul className="flex flex-wrap gap-1.5">
              {facts.skin.map((key) => (
                <li key={key} className="flex items-center gap-1.5 rounded-full bg-ok/10 py-1 pr-3 pl-2 text-xs font-medium text-ink">
                  <Svg name={SKIN_ICONS[key]} size={14} className="text-ok" />
                  {tr(SKIN_LABELS[key])}
                </li>
              ))}
            </ul>
          )}
          {showForWhom && <p className="text-sm leading-relaxed text-ink/80">{facts.forWhom}</p>}
        </div>

        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex items-center gap-2.5">
            <span className={`${badge} h-8 w-8`}>
              <Svg name="bottle" size={16} />
            </span>
            <h3 className={heading}>{tr("Použití")}</h3>
          </div>
          {facts.dayTimes.length > 0 && (
            <ul className="flex flex-wrap gap-1.5">
              {facts.dayTimes.includes("am") && (
                <li className="flex items-center gap-1.5 rounded-full bg-ok/10 py-1 pr-3 pl-2 text-xs font-medium text-ink">
                  <Svg name="sun" size={14} className="text-ok" />
                  {tr("Ráno")}
                </li>
              )}
              {facts.dayTimes.includes("pm") && (
                <li className="flex items-center gap-1.5 rounded-full bg-ok/10 py-1 pr-3 pl-2 text-xs font-medium text-ink">
                  <Svg name="moon" size={14} className="text-ok" />
                  {tr("Večer")}
                </li>
              )}
            </ul>
          )}
          <p className="text-sm leading-relaxed text-ink/80">{facts.usage}</p>
        </div>
      </div>
    </div>
  );
}

const SEASON_META: Record<Season, { label: string; icon: IconName }> = {
  spring: { label: "Jaro", icon: "flower" },
  summer: { label: "Léto", icon: "sun" },
  autumn: { label: "Podzim", icon: "leaf" },
  winter: { label: "Zima", icon: "fresh" },
};

const TIME_META: Record<ScentTime, { label: string; icon: IconName }> = {
  day: { label: "Přes den", icon: "sun" },
  evening: { label: "Večer", icon: "moon" },
};

const chip = "flex items-center gap-1.5 rounded-full bg-ok/10 py-1 pr-3 pl-2 text-xs font-medium text-ink";
const tag = "rounded-full border border-line px-3 py-1 text-xs font-medium text-ink";

/**
 * Scent facts (see parseScentFacts): the notes lead as large icon tiles (icon picked from the wording),
 * then when to wear it (season / time-of-day chips) and its character as tags — or, for candles and car
 * fresheners, burn time, who it is for and how to use it.
 */
export async function ProductScentCards({ facts }: { facts: ScentFacts }) {
  const tr = await getTr();
  const hasNotes = facts.notes.length > 0;
  const few = facts.notes.length <= 2;
  const hasWhen = facts.seasons.length > 0 || facts.times.length > 0 || !!facts.when;
  const hasCharacter = facts.character.length > 0 || !!facts.characterText;
  const hasForWhom = facts.forWhom.length > 0 || !!facts.forWhomText;
  // The chips already say it; the sentence is only worth repeating when it carries more ("na odpoledne i příjemný večer, kdy chcete vonět útulně")
  const whenText = facts.seasons.length + facts.times.length > 0 && facts.when.length <= 48 ? "" : facts.when;

  const columns: ReactNode[] = [];
  if (hasWhen) {
    columns.push(
      <div key="when" className="flex min-w-0 flex-col gap-3">
        <div className="flex items-center gap-2.5">
          <span className={`${badge} h-8 w-8`}>
            <Svg name="clock" size={16} />
          </span>
          <h3 className={heading}>{tr("Kdy ji nosit")}</h3>
        </div>
        {(facts.seasons.length > 0 || facts.times.length > 0) && (
          <ul className="flex flex-wrap gap-1.5">
            {facts.seasons.length === 4 ? (
              <li className={chip}>
                <Svg name="sparkle" size={14} className="text-ok" />
                {tr("Celý rok")}
              </li>
            ) : (
              facts.seasons.map((key) => (
                <li key={key} className={chip}>
                  <Svg name={SEASON_META[key].icon} size={14} className="text-ok" />
                  {tr(SEASON_META[key].label)}
                </li>
              ))
            )}
            {facts.times.map((key) => (
              <li key={key} className={chip}>
                <Svg name={TIME_META[key].icon} size={14} className="text-ok" />
                {tr(TIME_META[key].label)}
              </li>
            ))}
          </ul>
        )}
        {whenText && <p className="text-sm leading-relaxed text-ink/80">{whenText}</p>}
      </div>,
    );
  }
  if (hasCharacter) {
    columns.push(
      <div key="character" className="flex min-w-0 flex-col gap-3">
        <div className="flex items-center gap-2.5">
          <span className={`${badge} h-8 w-8`}>
            <Svg name="sparkle" size={16} />
          </span>
          <h3 className={heading}>{tr("Charakter")}</h3>
        </div>
        {facts.character.length > 0 ? (
          <ul className="flex flex-wrap gap-1.5">
            {facts.character.map((c) => (
              <li key={c} className={tag}>
                {c}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm leading-relaxed text-ink/80">{facts.characterText}</p>
        )}
      </div>,
    );
  }
  if (facts.burn) {
    columns.push(
      <div key="burn" className="flex min-w-0 flex-col gap-3">
        <div className="flex items-center gap-2.5">
          <span className={`${badge} h-8 w-8`}>
            <Svg name="flame" size={16} />
          </span>
          <h3 className={heading}>{tr("Doba hoření")}</h3>
        </div>
        <p className="text-sm leading-relaxed text-ink/80">{facts.burn}</p>
      </div>,
    );
  }
  if (hasForWhom) {
    columns.push(
      <div key="forWhom" className="flex min-w-0 flex-col gap-3">
        <div className="flex items-center gap-2.5">
          <span className={`${badge} h-8 w-8`}>
            <Svg name="user" size={16} />
          </span>
          <h3 className={heading}>{tr("Pro koho")}</h3>
        </div>
        {facts.forWhom.length > 0 ? (
          <ul className="flex flex-wrap gap-1.5">
            {facts.forWhom.map((c) => (
              <li key={c} className={tag}>
                {c}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm leading-relaxed text-ink/80">{facts.forWhomText}</p>
        )}
      </div>,
    );
  }
  if (facts.usage) {
    columns.push(
      <div key="usage" className="flex min-w-0 flex-col gap-3">
        <div className="flex items-center gap-2.5">
          <span className={`${badge} h-8 w-8`}>
            <Svg name="bottle" size={16} />
          </span>
          <h3 className={heading}>{tr("Použití")}</h3>
        </div>
        <p className="text-sm leading-relaxed text-ink/80">{facts.usage}</p>
      </div>,
    );
  }

  return (
    <div className="mt-6 flex flex-col gap-7">
      {hasNotes && (
        <section>
          <h3 className={heading}>{facts.notesKind === "tones" ? tr("Hlavní tóny") : tr("Vůně")}</h3>
          <ul
            className={
              few
                ? "mt-4 flex flex-wrap gap-x-10 gap-y-4"
                : "mt-5 grid gap-x-3 gap-y-6 [grid-template-columns:repeat(var(--m),minmax(0,1fr))] sm:[grid-template-columns:repeat(var(--d),minmax(0,1fr))]"
            }
            // Balanced rows (6 → 3×2, 7–8 → 4 per row) instead of a lone tile on the last line
            style={{ "--m": facts.notes.length === 4 ? 2 : 3, "--d": facts.notes.length <= 5 ? facts.notes.length : facts.notes.length === 6 ? 3 : 4 } as CSSProperties}
          >
            {facts.notes.map((note) => (
              <li key={note} className={few ? "flex items-center gap-3.5" : "flex flex-col items-center gap-2.5 text-center"}>
                <span className={`${badge} ${few ? "h-12 w-12" : "h-14 w-14"}`}>
                  <Svg name={noteIcon(note)} size={few ? 24 : 26} strokeWidth={1.4} />
                </span>
                <span className={`text-sm leading-snug font-medium text-ink ${few ? "" : "max-w-[8.5rem]"}`}>{note}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {columns.length > 0 && (
        <div className={`grid gap-x-8 gap-y-6 sm:grid-cols-2 ${hasNotes ? "border-t border-line pt-6" : ""}`}>{columns}</div>
      )}
    </div>
  );
}
