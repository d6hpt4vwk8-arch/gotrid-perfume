// Free "sample" gifts (sachets from brands we stock) offered as a choice in the
// cart/checkout when the cart holds a product from a triggering category — no
// coupon needed, unlike the DAREK gift-coupon flow (gifts.server.ts). The
// sample products are hidden catalog rows whose code starts with GIFT-; which
// carts they are offered to is decided here, in code, rather than in the DB.

export const SAMPLE_GIFT_PREFIX = "GIFT-";

export type GiftTrigger = "kbeauty" | "arabic";

// Category fullSlugs (Category.fullSlug) that trigger each gift group.
export const TRIGGER_FULL_SLUGS: Record<GiftTrigger, string> = {
  kbeauty: "kosmetika/korejska-kosmetika",
  arabic: "parfemy/arabske-parfemy",
};

// Which carts a given sample gift is offered to.
export function sampleGiftTriggers(code: string): GiftTrigger[] {
  // Nama Fiji is cosmetics too, so it goes with both K-beauty and Arabic perfumes;
  // the SKIN1004 samples are only for K-beauty carts.
  return code === "GIFT-NAMA-FIJI" ? ["kbeauty", "arabic"] : ["kbeauty"];
}

export function isSampleGiftCode(code: string): boolean {
  return code.startsWith(SAMPLE_GIFT_PREFIX);
}

/** Triggers earned by a set of category fullSlugs (a product's own categories or a whole cart's). */
export function triggersFromFullSlugs(fullSlugs: string[]): GiftTrigger[] {
  return (Object.keys(TRIGGER_FULL_SLUGS) as GiftTrigger[]).filter((t) =>
    fullSlugs.some((s) => s === TRIGGER_FULL_SLUGS[t] || s.startsWith(`${TRIGGER_FULL_SLUGS[t]}/`)),
  );
}
