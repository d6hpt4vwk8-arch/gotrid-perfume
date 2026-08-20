// Pilot batch: fetches fragrance note-pyramid data (top/middle/base notes +
// main accords) from the Fragella API (api.fragella.com) for 20 well-known
// designer perfumes already in the catalog, and stores it in
// ProductScentNotes. NOT a full-catalog import — free tier is 20 requests/
// month, and this uses the /brands/{Brand} endpoint (returns every fragrance
// for a brand in one call) to cover 20 products across 10 brands in 10
// requests, leaving headroom in the monthly quota.
//
// Usage:
//   npx tsx scripts/fetch-scent-notes.ts --dry-run
//   npx tsx scripts/fetch-scent-notes.ts
import type { Prisma } from "@prisma/client";
import { prisma } from "../src/lib/prisma";

const API_KEY = process.env.FRAGELLA_API_KEY;
const DRY_RUN = process.argv.includes("--dry-run");

if (!API_KEY) {
  throw new Error("FRAGELLA_API_KEY is not set in .env");
}

interface FragellaNote {
  name: string;
  imageUrl: string;
}

interface FragellaFragrance {
  Name: string;
  Brand: string;
  Notes?: { Top?: FragellaNote[]; Middle?: FragellaNote[]; Base?: FragellaNote[] };
  "Main Accords"?: string[];
  "Main Accords Percentage"?: Record<string, string>;
  "Purchase URL"?: string;
}

interface Target {
  productId: string;
  brand: string; // Fragella's brand slug/name, used in the /brands/{Brand} URL
  fragranceName: string; // exact "Name" to match within that brand's fragrance list
}

const TARGETS: Target[] = [
  { productId: "cmsdbth9r04r2urt42x4iid1u", brand: "Dior", fragranceName: "Sauvage" },
  { productId: "cmsdbt6y804jourt4ftncl7jw", brand: "Dior", fragranceName: "Fahrenheit" },
  { productId: "cmsodjxbb00imurg5lanh830s", brand: "Chanel", fragranceName: "Coco Mademoiselle" },
  { productId: "cmsdbt77904jvurt42uw0xh21", brand: "Chanel", fragranceName: "Coco" },
  { productId: "cmsodjwpp00g3urg5byx381cz", brand: "Versace", fragranceName: "Crystal Noir" },
  { productId: "cmsodkn6o02uzurg50rg6c6dq", brand: "Versace", fragranceName: "Dylan Turquoise" },
  { productId: "cmsodkhqn02ewurg5zblk9rem", brand: "Carolina Herrera", fragranceName: "Bad Boy" },
  { productId: "cmsodkvr503szurg56x1pbew9", brand: "Carolina Herrera", fragranceName: "212 Heroes" },
  { productId: "cmsodkvuq03tfurg52kvrnk57", brand: "Jean Paul Gaultier", fragranceName: "Scandal Pour Homme" },
  { productId: "cmsodku4303lkurg5rl0t5jm5", brand: "Jean Paul Gaultier", fragranceName: "La Belle" },
  { productId: "cmsdbt93804l8urt4s90zvqy5", brand: "Jean Paul Gaultier", fragranceName: "Ultra Male" },
  { productId: "cmsodk08q00tuurg5lqzrczul", brand: "Giorgio Armani", fragranceName: "Si" },
  { productId: "cmsodkn6u02v1urg5p29g3h2s", brand: "Giorgio Armani", fragranceName: "My Way" },
  { productId: "cmsodjvwm00cyurg5svzay2ag", brand: "Giorgio Armani", fragranceName: "Emporio Armani She" },
  { productId: "cmsdbt8k104kuurt4yoelq9z5", brand: "Giorgio Armani", fragranceName: "Emporio Armani He" },
  { productId: "cmsodk41k018purg5ndlhilmb", brand: "Yves Saint Laurent", fragranceName: "Black Opium" },
  { productId: "cmsodkhny02eiurg5xu166al7", brand: "Calvin Klein", fragranceName: "Eternity For Men" },
  { productId: "cmsodjxik00jxurg5eii7icy0", brand: "Calvin Klein", fragranceName: "CK One Shock For Her" },
  { productId: "cmsodkw4n03uxurg5bd02bdl8", brand: "Gucci", fragranceName: "Guilty Pour Femme" },
  { productId: "cmsodkvlc03s7urg5bjfcpys4", brand: "Hugo Boss", fragranceName: "Alive" },
];

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

async function fetchBrand(brand: string): Promise<FragellaFragrance[]> {
  const res = await fetch(`https://api.fragella.com/api/v1/brands/${encodeURIComponent(brand)}`, {
    headers: { "x-api-key": API_KEY! },
  });
  if (!res.ok) {
    throw new Error(`Fragella /brands/${brand} failed: HTTP ${res.status}`);
  }
  const data = await res.json();
  return Array.isArray(data) ? data : (data.results ?? data.fragrances ?? []);
}

async function main() {
  const byBrand = new Map<string, Target[]>();
  for (const t of TARGETS) {
    if (!byBrand.has(t.brand)) byBrand.set(t.brand, []);
    byBrand.get(t.brand)!.push(t);
  }
  console.log(`${TARGETS.length} target fragrances across ${byBrand.size} brands (${byBrand.size} API calls).`);

  let matched = 0;
  let unmatched = 0;
  let stored = 0;

  for (const [brand, targets] of byBrand) {
    console.log(`\nFetching brand "${brand}" (${targets.length} target(s))…`);
    let fragrances: FragellaFragrance[];
    try {
      fragrances = await fetchBrand(brand);
    } catch (err) {
      console.error(`  [error] ${err instanceof Error ? err.message : err}`);
      unmatched += targets.length;
      continue;
    }
    console.log(`  Got ${fragrances.length} fragrances for this brand.`);

    for (const target of targets) {
      const match = fragrances.find((f) => normalize(f.Name) === normalize(target.fragranceName));
      if (!match) {
        console.warn(`  [no match] "${target.fragranceName}" not found in Fragella's ${brand} list`);
        unmatched++;
        continue;
      }
      const top = match.Notes?.Top ?? [];
      const middle = match.Notes?.Middle ?? [];
      const base = match.Notes?.Base ?? [];
      if (top.length === 0 && middle.length === 0 && base.length === 0) {
        console.warn(`  [no notes] "${match.Name}" matched but has no note pyramid data`);
        unmatched++;
        continue;
      }
      matched++;
      console.log(`  [match] "${target.fragranceName}" -> "${match.Name}" (top=${top.length} mid=${middle.length} base=${base.length})`);

      if (DRY_RUN) continue;

      const mainAccords = (match["Main Accords"] ?? []).map((name) => ({
        name,
        intensity: match["Main Accords Percentage"]?.[name] ?? null,
      }));

      await prisma.productScentNotes.upsert({
        where: { productId: target.productId },
        update: {
          topNotes: top as unknown as Prisma.InputJsonValue,
          middleNotes: middle as unknown as Prisma.InputJsonValue,
          baseNotes: base as unknown as Prisma.InputJsonValue,
          mainAccords: mainAccords as unknown as Prisma.InputJsonValue,
          sourceName: match.Name,
          sourceUrl: match["Purchase URL"] ?? null,
        },
        create: {
          productId: target.productId,
          topNotes: top as unknown as Prisma.InputJsonValue,
          middleNotes: middle as unknown as Prisma.InputJsonValue,
          baseNotes: base as unknown as Prisma.InputJsonValue,
          mainAccords: mainAccords as unknown as Prisma.InputJsonValue,
          source: "fragella",
          sourceName: match.Name,
          sourceUrl: match["Purchase URL"] ?? null,
        },
      });
      stored++;
    }
  }

  console.log(`\nDone. Matched: ${matched}, unmatched: ${unmatched}${DRY_RUN ? " (dry run — nothing stored)" : `, stored: ${stored}`}.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
