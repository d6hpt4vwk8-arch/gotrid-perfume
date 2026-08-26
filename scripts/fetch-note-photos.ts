// Pilot: fetches a real ingredient photo per distinct scent-note NAME (not
// per product — the same note, e.g. "Vanilla", shows up across many
// fragrances, so this is a shared lookup table, ScentNotePhoto) from the
// Unsplash API. Mirrors how mrrizz.cz displays its note pyramid (real
// photos, not flat icons).
//
// Unsplash API guidelines require crediting the photographer wherever a
// photo is shown, and pinging the photo's `download_location` endpoint when
// you "use" it (not just preview it) — both handled here.
//
// Usage:
//   npx tsx scripts/fetch-note-photos.ts --dry-run
//   npx tsx scripts/fetch-note-photos.ts
import { prisma } from "../src/lib/prisma";
import { downloadProductImages } from "../src/lib/import/download-images";

const ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY;
const DRY_RUN = process.argv.includes("--dry-run");

if (!ACCESS_KEY) {
  throw new Error("UNSPLASH_ACCESS_KEY is not set in .env");
}

// Search query overrides for notes whose raw name is a marketing term
// ("Cashmere Wood" isn't a real photographable material) or searches poorly
// verbatim — everything else falls back to `"${note} ingredient"`. Curated
// by hand-reviewing candidate alt_descriptions (see conversation) — plain
// index-0 on the raw note name frequently returned the wrong subject (e.g.
// "Pear" alone matched apples; "Licorice" matched firewood).
const QUERY_OVERRIDES: Record<string, string> = {
  "Cashmere Wood": "sandalwood wood",
  Cedar: "cedar wood",
  Patchouli: "patchouli leaves",
  Licorice: "star anise", // real licorice-root photos are scarce on Unsplash; star anise is the standard visual stand-in for this flavor/scent family
  "Bitter Almond": "almonds",
  "Pink Pepper": "pink peppercorns",
  "Orange Blossom": "neroli flower", // neroli = orange blossom essential oil; searches better than "orange blossom flower"
  Vanilla: "vanilla pod",
  Coffee: "coffee beans",
  Jasmine: "jasmine flower macro",
  Pear: "pear fruit",
};

// Search results aren't always ranked with the best match first — these
// pick a specific result index (0-based) for notes where index 0 was wrong
// per manual review, instead of trusting the API's default ranking.
const RESULT_INDEX_OVERRIDES: Record<string, number> = {
  Jasmine: 1, // index 0 for "jasmine flower macro" was a generic unlabeled close-up; index 1 clearly shows a white flower
};

interface UnsplashPhoto {
  id: string;
  urls: { regular: string };
  alt_description: string | null;
  description: string | null;
  user: { name: string; links: { html: string } };
  links: { download_location: string };
}

async function searchNote(noteName: string): Promise<UnsplashPhoto | null> {
  const query = QUERY_OVERRIDES[noteName] ?? `${noteName} ingredient`;
  // No orientation filter — "squarish" over-narrows several queries to zero
  // results (e.g. "pink peppercorns" 8->0); square framing is handled by
  // CSS object-fit on the frontend instead.
  const res = await fetch(
    `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=5`,
    { headers: { Authorization: `Client-ID ${ACCESS_KEY}` } },
  );
  if (!res.ok) throw new Error(`Unsplash search failed for "${noteName}": HTTP ${res.status}`);
  const data = (await res.json()) as { results: UnsplashPhoto[] };
  const index = RESULT_INDEX_OVERRIDES[noteName] ?? 0;
  return data.results[index] ?? data.results[0] ?? null;
}

// A specific photo pinned directly by ID for notes where search never
// surfaced the right subject even across query variants and result indices
// (verified by hand — see conversation).
const PHOTO_ID_OVERRIDES: Record<string, string> = {
  Vanilla: "LGlvMZxm-Nc", // "Dark vanilla beans with visible seeds" — an exact match found via manual review
};

async function fetchPhotoById(id: string): Promise<UnsplashPhoto> {
  const res = await fetch(`https://api.unsplash.com/photos/${id}`, {
    headers: { Authorization: `Client-ID ${ACCESS_KEY}` },
  });
  if (!res.ok) throw new Error(`Unsplash photo fetch failed for id "${id}": HTTP ${res.status}`);
  return (await res.json()) as UnsplashPhoto;
}

// Registers a "use" of the photo per Unsplash API guidelines — required
// whenever a photo is actually shown to end users, not just previewed.
async function pingDownload(photo: UnsplashPhoto) {
  await fetch(photo.links.download_location, {
    headers: { Authorization: `Client-ID ${ACCESS_KEY}` },
  });
}

async function main() {
  const rows = await prisma.productScentNotes.findMany();
  const names = new Set<string>();
  for (const r of rows) {
    for (const arr of [r.topNotes, r.middleNotes, r.baseNotes]) {
      if (Array.isArray(arr)) {
        for (const n of arr as Array<{ name?: string }>) if (n?.name) names.add(n.name);
      }
    }
  }
  console.log(`Found ${names.size} distinct note names.`);

  const existing = await prisma.scentNotePhoto.findMany({ select: { noteName: true } });
  const existingSet = new Set(existing.map((e) => e.noteName));

  let fetched = 0;
  let skipped = 0;
  let failed = 0;

  for (const name of names) {
    const key = name.toLowerCase();
    if (existingSet.has(key)) {
      skipped++;
      continue;
    }

    try {
      const photo = PHOTO_ID_OVERRIDES[name]
        ? await fetchPhotoById(PHOTO_ID_OVERRIDES[name])
        : await searchNote(name);
      if (!photo) {
        console.warn(`  [no result] "${name}"`);
        failed++;
        continue;
      }
      console.log(`  "${name}" -> query="${QUERY_OVERRIDES[name] ?? name + " ingredient"}" | alt="${photo.alt_description}" | by ${photo.user.name}`);

      if (DRY_RUN) continue;

      await pingDownload(photo);

      const code = `note-${key.replace(/[^a-z0-9]+/g, "-")}`;
      const { urls: imageUrls } = await downloadProductImages(code, photo.urls.regular);
      if (imageUrls.length === 0) {
        console.warn(`  [download failed] "${name}"`);
        failed++;
        continue;
      }

      await prisma.scentNotePhoto.upsert({
        where: { noteName: key },
        update: {
          imageUrl: imageUrls[0],
          sourcePhotoId: photo.id,
          attributionName: photo.user.name,
          attributionUrl: `${photo.user.links.html}?utm_source=gotrid-perfume&utm_medium=referral`,
        },
        create: {
          noteName: key,
          imageUrl: imageUrls[0],
          source: "unsplash",
          sourcePhotoId: photo.id,
          attributionName: photo.user.name,
          attributionUrl: `${photo.user.links.html}?utm_source=gotrid-perfume&utm_medium=referral`,
        },
      });
      fetched++;
    } catch (err) {
      console.error(`  [error] "${name}":`, err instanceof Error ? err.message : err);
      failed++;
    }
  }

  console.log(`\nDone. Fetched: ${fetched}, skipped (already had one): ${skipped}, failed: ${failed}.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
