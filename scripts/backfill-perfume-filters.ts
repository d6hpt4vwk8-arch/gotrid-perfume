// Fills Product.concentration (the exact perfume type for the "Typ" filter) and Product.occasions (the
// "Příležitost" filter) for every perfume. Idempotent — re-run after importing new perfumes.
//   concentration: parsed from the product name (works on both the new "– parfémovaná voda dámská –" names
//                  and raw supplier names); falls back to the old leaf category (Parfémované vody / Toaletní vody / oleje).
//   occasions:     rule-based from the scent families (data is approximate; families are tagged from description keywords):
//                    heavy = orientální a kořeněná / sladká a gurmánská / kožená a kouřová
//                    fresh = citrusová / svěží a vodní / zelená a bylinná
//                    vecer     "Na večer a rande"  — has any heavy family
//                    zima      "Na zimu"           — heavy and not fresh
//                    leto      "Na léto"           — fresh and not heavy
//                    kazdy-den "Na každý den"      — (fresh or pižmová or květinová) and not heavy
//                    do-prace  "Do práce"          — (fresh or pižmová) and not heavy
//   npx tsx scripts/backfill-perfume-filters.ts          dry run (distribution only)
//   npx tsx scripts/backfill-perfume-filters.ts --apply
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

const CONCENTRATION: [RegExp, string][] = [
  [/\b(?:concentrated perfum(?:e|ed) oil|perfum(?:e|ed) oil|CPO|attar|parfémový olej|parfémovaný olej)\b/i, "parfemovy-olej"],
  [/\b(?:extrait de parfum|parfum extrait|perfume extract|ExDP|extrait|parfémový extrakt)\b/i, "parfemovy-extrakt"],
  [/\b(?:eau de parfum|aqua parfum|perfumed water|EDP|parfémovaná voda|parfémová voda)\b/i, "parfemovana-voda"],
  [/\b(?:eau de toilette|EDT|toaletní voda)\b/i, "toaletni-voda"],
  [/\b(?:eau de cologne|EDC|kolínská voda)\b/i, "kolinska-voda"],
];
const HEAVY = new Set(["orientalni-korenita", "sladka-gurmanska", "kozena-koureova"]);
const FRESH = new Set(["citrusova", "svezi-vodni", "zelena-bylinna"]);

function concentrationOf(name: string, slugs: string[]): string | null {
  if (/\b(?:hair|body) mist\b|air freshener|osvěžovač|\bset\b|gift ?set|coffret/i.test(name)) return null;
  for (const [re, slug] of CONCENTRATION) if (re.test(name)) return slug;
  if (/\bParfum\b(?=\s*(?:[WMU])?\s*(?:\d|$))/.test(name) || /\bperfume for (?:men|women)\b|\bparfém\b/i.test(name)) return "parfem";
  if (slugs.some((s) => s.endsWith("/toaletni-vody"))) return "toaletni-voda";
  if (slugs.some((s) => s.endsWith("/parfemovane-vody"))) return "parfemovana-voda";
  if (slugs.some((s) => s.endsWith("/parfemovane-oleje"))) return "parfemovy-olej";
  return null;
}

function occasionsOf(families: string[]): string[] {
  const f = new Set(families);
  if (f.size === 0) return [];
  const heavy = families.some((x) => HEAVY.has(x));
  const fresh = families.some((x) => FRESH.has(x));
  const soft = f.has("pizmova") || f.has("kvetinova");
  const out: string[] = [];
  if (heavy) out.push("vecer");
  if (heavy && !fresh) out.push("zima");
  if (fresh && !heavy) out.push("leto");
  if ((fresh || soft) && !heavy) out.push("kazdy-den");
  if ((fresh || f.has("pizmova")) && !heavy) out.push("do-prace");
  return out;
}

async function main() {
  const ps = await prisma.product.findMany({
    where: { categories: { some: { category: { fullSlug: { startsWith: "parfemy" } } } } },
    select: {
      id: true, name: true, concentration: true, occasions: true,
      categories: { select: { category: { select: { fullSlug: true } } } },
      scentFamilies: { select: { scentFamily: { select: { slug: true } } } },
    },
  });
  const conc = new Map<string, number>(), occ = new Map<string, number>();
  let none = 0, changed = 0;
  const updates: { id: string; concentration: string | null; occasions: string[] }[] = [];
  for (const p of ps) {
    const c = concentrationOf(p.name, p.categories.map((x) => x.category.fullSlug));
    const o = occasionsOf(p.scentFamilies.map((x) => x.scentFamily.slug));
    conc.set(c ?? "(none)", (conc.get(c ?? "(none)") ?? 0) + 1);
    if (!c) none++;
    o.forEach((x) => occ.set(x, (occ.get(x) ?? 0) + 1));
    if (c !== p.concentration || o.join() !== [...p.occasions].join()) { changed++; updates.push({ id: p.id, concentration: c, occasions: o }); }
  }
  console.log(`perfume products ${ps.length}; to update ${changed}; without a concentration ${none}`);
  console.log("concentration:", [...conc.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(", "));
  console.log("occasions:", [...occ.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(", "));
  if (!APPLY) return console.log("DRY RUN");
  for (const u of updates) await prisma.product.update({ where: { id: u.id }, data: { concentration: u.concentration, occasions: u.occasions } });
  console.log("APPLIED", updates.length);
}
main().finally(() => prisma.$disconnect());
