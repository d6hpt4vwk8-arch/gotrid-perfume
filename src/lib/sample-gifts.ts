// Free "sample" gifts (sachets from brands we stock) offered as a choice in the
// cart/checkout when the cart holds a product from a triggering category — no
// coupon needed, unlike the DAREK gift-coupon flow (gifts.server.ts). The
// sample products are hidden catalog rows whose code starts with GIFT-; which
// carts they are offered to is decided here, in code, rather than in the DB.

export const SAMPLE_GIFT_PREFIX = "GIFT-";

export type GiftTrigger = "kbeauty" | "arabic" | "perfume" | "cosmetics" | "dental";

// Category fullSlugs (Category.fullSlug) that trigger each gift group.
export const TRIGGER_FULL_SLUGS: Record<GiftTrigger, string> = {
  kbeauty: "kosmetika/korejska-kosmetika",
  arabic: "parfemy/arabske-parfemy",
  // Any perfume / any cosmetics (K-beauty and Arabic perfumes fall under these too).
  perfume: "parfemy",
  cosmetics: "kosmetika",
  dental: "zuby",
};

// Which carts a given sample gift is offered to.
export function sampleGiftTriggers(code: string): GiftTrigger[] {
  // Nama Fiji is cosmetics too, so it goes with both K-beauty and Arabic perfumes.
  if (code === "GIFT-NAMA-FIJI") return ["kbeauty", "arabic"];
  // Vials of designer/niche perfume go with any perfume order.
  if (PERFUME_SAMPLES.has(code)) return ["perfume"];
  // Palacio sachets and the Iconique hair care go with any cosmetics order (K-beauty included).
  if (COSMETICS_SAMPLES.has(code)) return ["cosmetics"];
  // Interdental brushes: dental-care orders, and cosmetics orders as a small extra.
  if (code === "GIFT-CURAPROX-CPS115") return ["dental", "cosmetics"];
  // The SKIN1004 / Mizon / vvbetter / Dr. Althea / Village 11 samples are K-beauty only.
  return ["kbeauty"];
}

const PERFUME_SAMPLES = new Set(["GIFT-RABANNE-1M-PARFUM", "GIFT-RABANNE-1M-EDT", "GIFT-SCENT-OF-STARS-LYRA"]);
const COSMETICS_SAMPLES = new Set([
  "GIFT-PALACIO-TIGER-GEL",
  "GIFT-PALACIO-SNAKE-SERUM",
  "GIFT-CANNABELLUM-CANNADREAM",
  "GIFT-PALACIO-CANNAPROTECT",
  "GIFT-ICONIQUE-MASK",
  "GIFT-ICONIQUE-SHAMPOO",
  "GIFT-GARNIER-HYDRA-BOMB",
]);

export function isSampleGiftCode(code: string): boolean {
  return code.startsWith(SAMPLE_GIFT_PREFIX);
}

/** Triggers earned by a set of category fullSlugs (a product's own categories or a whole cart's). */
export function triggersFromFullSlugs(fullSlugs: string[]): GiftTrigger[] {
  return (Object.keys(TRIGGER_FULL_SLUGS) as GiftTrigger[]).filter((t) =>
    fullSlugs.some((s) => s === TRIGGER_FULL_SLUGS[t] || s.startsWith(`${TRIGGER_FULL_SLUGS[t]}/`)),
  );
}

// One-line "what is it" for the gift list, so the customer can tell the samples apart.
const BLURBS: Record<string, { cs: string; sk: string }> = {
  "GIFT-NAMA-FIJI": {
    cs: "6 sáčků: peeling, čisticí mléko, čisticí gel, maska, sérum a krém — celý mini rituál péče o pleť",
    sk: "6 vreciek: peeling, čistiace mlieko, čistiaci gél, maska, sérum a krém — celý mini rituál starostlivosti o pleť",
  },
  "GIFT-SKIN1004-CENTELLA-AMPOULE": {
    cs: "Hydratační sérum pro zklidnění a posílení citlivé pleti",
    sk: "Hydratačné sérum na zklidnenie a posilnenie citlivej pleti",
  },
  "GIFT-SKIN1004-PROBIO-AMPOULE": {
    cs: "Zklidňující sérum pro obnovu kožní bariéry",
    sk: "Zklidňujúce sérum na obnovu kožnej bariéry",
  },
  "GIFT-SKIN1004-PROBIO-CREAM": {
    cs: "Intenzivně hydratační krém pro zklidnění pleti",
    sk: "Intenzívne hydratačný krém na zklidnenie pleti",
  },
  "GIFT-SKIN1004-SUN-SERUM": {
    cs: "Ochranné sérum SPF50+ s hydratačním účinkem",
    sk: "Ochranné sérum SPF50+ s hydratačným účinkom",
  },
  "GIFT-PALACIO-TIGER-GEL": {
    cs: "Masážní gel s konopím pro uvolnění svalů a kloubů",
    sk: "Masážny gél s konopou na uvoľnenie svalov a kĺbov",
  },
  "GIFT-PALACIO-SNAKE-SERUM": {
    cs: "Pleťové hadí sérum proti stárnutí pleti",
    sk: "Pleťové hadie sérum proti starnutiu pleti",
  },
  "GIFT-CANNABELLUM-CANNADREAM": {
    cs: "Noční pleťový krém s CBD pro regeneraci pleti přes noc",
    sk: "Nočný pleťový krém s CBD na regeneráciu pleti cez noc",
  },
  "GIFT-PALACIO-CANNAPROTECT": {
    cs: "Celoroční pleťový krém SPF 50 s konopím a panthenolem",
    sk: "Celoročný pleťový krém SPF 50 s konopou a panthenolom",
  },
  "GIFT-MIZON-COLLAGEN": {
    cs: "Zpevňující krém s mořským kolagenem a peptidy",
    sk: "Spevňujúci krém s morským kolagénom a peptidmi",
  },
  "GIFT-MIZON-HYALUGEN": {
    cs: "Hydratační gelový krém pro zralou pleť",
    sk: "Hydratačný gélový krém pre zrelú pleť",
  },
  "GIFT-VVBETTER-TECA": {
    cs: "Hydratační krém s peptidy, niacinamidem a centellou",
    sk: "Hydratačný krém s peptidmi, niacínamidom a centelou",
  },
  "GIFT-DRALTHEA-AQUA": {
    cs: "Lehký hydratační krém s mořskými extrakty",
    sk: "Ľahký hydratačný krém s morskými extraktmi",
  },
  "GIFT-ICONIQUE-MASK": {
    cs: "Hydratační vlasová maska s olejem babassu",
    sk: "Hydratačná vlasová maska s olejom babassu",
  },
  "GIFT-ICONIQUE-SHAMPOO": {
    cs: "Hydratační šampon s kyselinou hyaluronovou",
    sk: "Hydratačný šampón s kyselinou hyalurónovou",
  },
  "GIFT-VILLAGE11-AHA-LOTION": {
    cs: "Exfoliační tělové mléko s 12 % AHA kyselin",
    sk: "Exfoliačné telové mlieko s 12 % AHA kyselín",
  },
  "GIFT-SCENT-OF-STARS-LYRA": {
    cs: "Parfémovaná voda Scent of Stars Lyra Blossom N°52 (2 ml)",
    sk: "Parfumovaná voda Scent of Stars Lyra Blossom N°52 (2 ml)",
  },
  "GIFT-RABANNE-1M-PARFUM": {
    cs: "Parfém Rabanne 1 Million Parfum (1,5 ml)",
    sk: "Parfum Rabanne 1 Million Parfum (1,5 ml)",
  },
  "GIFT-RABANNE-1M-EDT": {
    cs: "Toaletní voda Rabanne 1 Million (1,5 ml)",
    sk: "Toaletná voda Rabanne 1 Million (1,5 ml)",
  },
  "GIFT-SKIN1004-CENTELLA-OIL": {
    cs: "Lehký čisticí olej s centellou asijskou",
    sk: "Ľahký čistiaci olej s centelou ázijskou",
  },
  "GIFT-VVBETTER-SUN": {
    cs: "Lehký opalovací krém SPF 50+ PA++++",
    sk: "Ľahký opaľovací krém SPF 50+ PA++++",
  },
  "GIFT-VVBETTER-EYE": {
    cs: "Zpevňující oční krém s vitaminem C a bakuchiolem",
    sk: "Spevňujúci očný krém s vitamínom C a bakuchiolom",
  },
  "GIFT-GARNIER-HYDRA-BOMB": {
    cs: "Hydratační textilní pleťová maska s granátovým jablkem a kyselinou hyaluronovou",
    sk: "Hydratačná textilná pleťová maska s granátovým jablkom a kyselinou hyalurónovou",
  },
  "GIFT-CURAPROX-CPS115": {
    cs: "4 mezizubní kartáčky Curaprox CPS 115 handy (střední velikost)",
    sk: "4 medzizubné kefky Curaprox CPS 115 handy (stredná veľkosť)",
  },
};

export function sampleGiftBlurb(code: string): { cs: string; sk: string } | null {
  return BLURBS[code] ?? null;
}
