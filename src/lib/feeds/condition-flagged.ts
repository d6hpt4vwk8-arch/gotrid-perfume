// Listings that state an unusual condition — testers, vintage stock, an
// opened bottle, damaged packaging. The goods are genuine and sell fine
// on-site, but "designer brand + far below retail + unusual condition +
// non-official photo" is the exact fingerprint Google's counterfeit
// classifier acts on: the previous gotridperfume.shop store was suspended
// under that policy while its whole catalogue looked like this. These are
// therefore kept out of every ad/shopping feed — on-site listings and the
// storefront are untouched.
//
// "(vintage)" is matched with its parentheses on purpose: that's how the
// genuinely-old stock is written, whereas "Vintage Edition" is part of an
// official product name (Armaf Odyssey Mandarin Sky) and isn't a condition.
const CONDITION_PATTERN =
  /\btester\b|\(vintage\)|otevřen|rozbalen|%\s*plná|bez krabič|bez obalu/i;

export function isConditionFlagged(
  name: string,
  isDefective: boolean,
): boolean {
  return isDefective || CONDITION_PATTERN.test(name);
}
