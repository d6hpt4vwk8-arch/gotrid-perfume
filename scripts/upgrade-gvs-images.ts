// One-off: replace low-resolution GVS Cosmetics product photos (sourced
// from tiny images pasted into the supplier's spreadsheet, some as small
// as 87x268px) with higher-resolution photos from official brand catalog
// sites, matched by normalized product name. Only applies a replacement
// when the name match is unambiguous — anything uncertain is left alone
// rather than risking another wrong-photo mismatch.
//
// Usage: npx tsx scripts/upgrade-gvs-images.ts --dry-run | (no flag = apply)
import { prisma } from "../src/lib/prisma";
import { downloadProductImages } from "../src/lib/import/download-images";

const DRY_RUN = process.argv.includes("--dry-run");

// Brand-name tokens are present in ~every product and so don't help tell
// two different products apart — stripped before scoring so the score
// reflects only the distinctive part of the name.
const STOPWORDS = new Set(["dr", "althea", "cp1", "esthetic", "house", "vvbetter", "polatam", "dralthea"]);

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/cp-1/g, "cp1")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(ml|g|pcs|pc)\b/g, "")
    .split(" ")
    .filter((t) => t && !STOPWORDS.has(t))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

// Drop stray single-char tokens (punctuation-splitting debris) but keep
// single-digit ones — they're meaningful size markers ("2 ml", "1 ml"),
// and silently dropping them made those sample-size variants score a false
// perfect match against their full-size sibling's unrelated candidate.
function tokenOverlapScore(a: string, b: string): number {
  const ta = new Set(normalize(a).split(" ").filter((t) => t.length > 1 || /^\d$/.test(t)));
  const tb = new Set(normalize(b).split(" ").filter((t) => t.length > 1 || /^\d$/.test(t)));
  if (ta.size === 0 || tb.size === 0) return 0;
  let common = 0;
  for (const t of ta) if (tb.has(t)) common++;
  return common / Math.max(ta.size, tb.size);
}

interface Candidate {
  slugOrLabel: string;
  imageUrl: string;
}

async function matchAndApply(brandSlug: string, candidates: Candidate[], minScore: number) {
  const brand = await prisma.brand.findUnique({ where: { slug: brandSlug } });
  if (!brand) {
    console.log(`  [skip] brand ${brandSlug} not found`);
    return;
  }
  const products = await prisma.product.findMany({ where: { brandId: brand.id }, select: { id: true, code: true, name: true } });

  let matched = 0;
  let applied = 0;
  for (const product of products) {
    let best: { cand: Candidate; score: number } | null = null;
    for (const cand of candidates) {
      const score = tokenOverlapScore(product.name, cand.slugOrLabel);
      if (!best || score > best.score) best = { cand, score };
    }
    if (!best || best.score < minScore) {
      console.log(`  [no match] ${product.name} (best score ${best?.score.toFixed(2) ?? "n/a"})`);
      continue;
    }
    matched++;
    console.log(`  [match ${best.score.toFixed(2)}] ${product.name} <- ${best.cand.slugOrLabel}`);
    if (DRY_RUN) continue;

    const { urls, errors } = await downloadProductImages(product.code, best.cand.imageUrl);
    if (urls.length === 0) {
      console.log(`    [error] download failed: ${errors.join("; ")}`);
      continue;
    }
    await prisma.productImage.deleteMany({ where: { productId: product.id } });
    await prisma.productImage.create({ data: { productId: product.id, url: urls[0], sortOrder: 0 } });
    applied++;
  }
  console.log(`${brandSlug}: ${matched}/${products.length} matched, ${applied} images replaced`);
}

async function main() {
  // Esthetic House / CP-1 — official min8852.cafe24.com catalog, extracted
  // by hand via browser (English URL slugs match our product names closely).
  const estheticHouseCandidates: Candidate[] = [
    { slugOrLabel: "cp-1 aqua protein treatment 250ml", imageUrl: "https://min8852.cafe24.com/web/product/medium/202607/01734b40d86e48e679fb0f25112b4ce6.jpg" },
    { slugOrLabel: "cp-1 keratin intensive fill-up hair mask", imageUrl: "https://min8852.cafe24.com/web/product/medium/202601/f2d82bfe0c44877c5e4e924eb3487d3e.jpg" },
    { slugOrLabel: "cp-1 keratin intensive fill-up hair conditioner", imageUrl: "https://min8852.cafe24.com/web/product/medium/202601/cef4b735cbea22d714c27aa9448004f7.jpg" },
    { slugOrLabel: "cp-1 keratin intensive fill-up hair shampoo", imageUrl: "https://min8852.cafe24.com/web/product/medium/202601/d304c6db5e6e172f09594b144b92bdf6.jpg" },
    { slugOrLabel: "cp-1 keratin intensive fill-up no-wash treatment", imageUrl: "https://min8852.cafe24.com/web/product/medium/202601/cb719e5601c4696026d4921e1ae5d03d.jpg" },
    { slugOrLabel: "cp-1 pink salt scaler 230ml head spa scalp scaler", imageUrl: "https://min8852.cafe24.com/web/product/medium/202408/5409dd36a13a95883e347a21e8baa60a.jpg" },
    { slugOrLabel: "cp-1 lpp collagen repair hair mask 210ml", imageUrl: "https://min8852.cafe24.com/web/product/medium/202606/c13d07e3882c5b327e3830f422b873a1.jpg" },
    { slugOrLabel: "cp-1 volume booster conditioner 500ml", imageUrl: "https://min8852.cafe24.com/web/product/medium/202402/70e72bcb6d17f35ea699e10f52af6091.jpg" },
    { slugOrLabel: "cp-1 volume booster shampoo 500ml", imageUrl: "https://min8852.cafe24.com/web/product/medium/202402/17040c020132791d0b7f65758374ba35.jpg" },
    { slugOrLabel: "cp-1 tea tree mint shampoo 500ml", imageUrl: "https://min8852.cafe24.com/web/product/medium/202402/0c25be0733d75508cb1b70859cbfbd95.jpg" },
    { slugOrLabel: "cp-1 aquaxyl complex intense moisture conditioner 100ml", imageUrl: "https://min8852.cafe24.com/web/product/medium/202304/7a0a3493004abd3113f9817cae482ef4.jpg" },
    { slugOrLabel: "cp-1 aquaxyl complex intense moisture shampoo 100ml", imageUrl: "https://min8852.cafe24.com/web/product/medium/202304/e4de166b7ff409dd12eba7e942648310.jpg" },
  ];

  await matchAndApply("esthetic-house", estheticHouseCandidates, 0.95);

  // Dr. Althea — official doctoraltheaglobal.com (Shopify) catalog, slugs
  // extracted by hand via browser fetch across all 4 catalog pages.
  const drAltheaCandidates: Candidate[] = [
    { slugOrLabel: "345-relief-cream", imageUrl: "https://doctoraltheaglobal.com/cdn/shop/files/345_ac454af4-b078-4619-a63a-1201465548e9.jpg?v=1786083592&width=700" },
    { slugOrLabel: "dralthea 147 barrier cream", imageUrl: "https://doctoraltheaglobal.com/cdn/shop/files/147.jpg?v=1786083592&width=700" },
    { slugOrLabel: "vitamin c boosting serum", imageUrl: "https://doctoraltheaglobal.com/cdn/shop/files/1a1996553c21e3da711f2f949009c205.jpg?v=1786083592&width=700" },
    { slugOrLabel: "345 relief cream mist", imageUrl: "https://doctoraltheaglobal.com/cdn/shop/files/345_100ml.jpg?v=1786083592&width=700" },
    { slugOrLabel: "green tea fresh sunscreen", imageUrl: "https://doctoraltheaglobal.com/cdn/shop/files/752cef310ce02974454bdc9cc89e28f9.jpg?v=1786083592&width=700" },
    { slugOrLabel: "pdrn reju 5000 cream", imageUrl: "https://doctoraltheaglobal.com/cdn/shop/files/5000.jpg?v=1786083592&width=700" },
    { slugOrLabel: "pure grinding cleansing balm", imageUrl: "https://doctoraltheaglobal.com/cdn/shop/files/878d144d3f124a3f91ff5f5cf13501c3.jpg?v=1786083592&width=700" },
    { slugOrLabel: "abc glow whipped serum", imageUrl: "https://doctoraltheaglobal.com/cdn/shop/files/ABC.jpg?v=1786083592&width=700" },
    { slugOrLabel: "gentle vitamin c serum", imageUrl: "https://doctoraltheaglobal.com/cdn/shop/files/0df1b081ff822ce1144855350ab2e9ac.jpg?v=1786083592&width=700" },
    { slugOrLabel: "retinol flat iron eye roller", imageUrl: "https://doctoraltheaglobal.com/cdn/shop/files/93b17f9bdd8afe7e84f62fe18243112f.jpg?v=1786083592&width=700" },
    { slugOrLabel: "stretchfit calming pad", imageUrl: "https://doctoraltheaglobal.com/cdn/shop/files/ee35ae96bed76ffad6461b35db2700b9.jpg?v=1786083592&width=700" },
    { slugOrLabel: "melaclear cream", imageUrl: "https://doctoraltheaglobal.com/cdn/shop/files/59bfccbe46affc7b11872713930fd807.jpg?v=1786083592&width=700" },
    { slugOrLabel: "aqua marine watery cream", imageUrl: "https://doctoraltheaglobal.com/cdn/shop/files/58b77213f54ca4e87270df838130b479.jpg?v=1786083592&width=700" },
    { slugOrLabel: "aqua marine jelly mist", imageUrl: "https://doctoraltheaglobal.com/cdn/shop/files/a6e6155e8eae6ef8d883cebcc69bed8c.jpg?v=1786083592&width=700" },
    { slugOrLabel: "aqua marine deep serum", imageUrl: "https://doctoraltheaglobal.com/cdn/shop/files/96204d86ca6d59a298bba98c5274001d.jpg?v=1786083592&width=700" },
    { slugOrLabel: "15% niacinamide purity serum", imageUrl: "https://doctoraltheaglobal.com/cdn/shop/files/15_02a671b9-62e7-459d-ba55-6bb5b0bc2722.jpg?v=1786083592&width=700" },
    { slugOrLabel: "pore refresh grinding cleansing balm", imageUrl: "https://doctoraltheaglobal.com/cdn/shop/files/e4a48409e86c966cf12a608391940024.jpg?v=1786083592&width=700" },
    { slugOrLabel: "premium quick step sebum cleanser", imageUrl: "https://doctoraltheaglobal.com/cdn/shop/files/7ab7a1639ad64b5910ba3c36baa7c369.jpg?v=1786083592&width=700" },
    { slugOrLabel: "0.1% gentle retinol serum", imageUrl: "https://doctoraltheaglobal.com/cdn/shop/files/0.1.jpg?v=1786083592&width=700" },
    { slugOrLabel: "15% calamine spot powder", imageUrl: "https://doctoraltheaglobal.com/cdn/shop/files/15_f702a9e0-c950-4726-b9cf-8e7b5bf40a97.jpg?v=1786083592&width=700" },
    { slugOrLabel: "rapid firm sculpting cream", imageUrl: "https://doctoraltheaglobal.com/cdn/shop/files/bb98d9119cf290a61c539129b9af5c5b.jpg?v=1786083592&width=700" },
    { slugOrLabel: "cushion veil calming mask", imageUrl: "https://doctoraltheaglobal.com/cdn/shop/files/caa29b6f151fb89722b94b9e3562bf74.jpg?v=1786083592&width=700" },
    { slugOrLabel: "dr althea aqua blue hydration mask", imageUrl: "https://doctoraltheaglobal.com/cdn/shop/files/30fc662146331812b327a92745fc80a6.jpg?v=1786083592&width=700" },
    { slugOrLabel: "green relief amino gel cleanser", imageUrl: "https://doctoraltheaglobal.com/cdn/shop/files/8fe8069a68318ab8183485e035452e0b.jpg?v=1786083592&width=700" },
    { slugOrLabel: "amino acid gentle bubble cleanser", imageUrl: "https://doctoraltheaglobal.com/cdn/shop/files/3fb153611484062c72b5646543d573b4.jpg?v=1786083592&width=700" },
  ];
  await matchAndApply("dr-althea", drAltheaCandidates, 0.95);

  // VVBETTER — official vvbetter.com (Shopify) store.
  const vvbetterCandidates: Candidate[] = [
    { slugOrLabel: "5.5 soothing cleansing foam", imageUrl: "https://vvbetter.com/cdn/shop/files/33.png?v=1728007278&width=1000" },
    { slugOrLabel: "aha boosting toner", imageUrl: "https://vvbetter.com/cdn/shop/files/41.webp?v=1739779111&width=1000" },
    { slugOrLabel: "daily airfit sunscreen", imageUrl: "https://vvbetter.com/cdn/shop/files/12_dfa32163-5b5d-4867-82a4-b9a084ebb578.png?v=1739778970&width=1000" },
    { slugOrLabel: "dark spot solution vita c trx serum", imageUrl: "https://vvbetter.com/cdn/shop/files/tranexamic_vita_c.webp?v=1764138648&width=1000" },
    { slugOrLabel: "firming bakuchiol pdrn serum", imageUrl: "https://vvbetter.com/cdn/shop/files/firmingbakuchiolandpdrnserum.webp?v=1764128856&width=1000" },
    { slugOrLabel: "firming eye cream", imageUrl: "https://vvbetter.com/cdn/shop/files/31_173d80d0-1138-4d78-b4d2-f08777b90ddd.png?v=1728007278&width=1000" },
    { slugOrLabel: "gentle deep cleansing oil", imageUrl: "https://vvbetter.com/cdn/shop/files/17_48eba26b-4d03-4176-afab-be1a23e83c84.png?v=1739779018&width=1000" },
    { slugOrLabel: "gentle purifying mud mask", imageUrl: "https://vvbetter.com/cdn/shop/files/22_c9eaac44-7ea2-4a86-8d3a-2412835e7b9f.png?v=1728007278&width=1000" },
    { slugOrLabel: "jeju yuja balancing bubble cleanser", imageUrl: "https://vvbetter.com/cdn/shop/files/Untitled_300_x_300_px.png?v=1739343731&width=1000" },
    { slugOrLabel: "jeju yuja balancing pad", imageUrl: "https://vvbetter.com/cdn/shop/files/Untitled_300_x_300_px_-6.png?v=1751506372&width=1000" },
    { slugOrLabel: "jeju yuja cera balancing cream", imageUrl: "https://vvbetter.com/cdn/shop/files/1_7a3b7ecb-c6f2-4675-9b9e-7b12e659b2a1.png?v=1728007278&width=1000" },
    { slugOrLabel: "jeju yuja succinic balancing serum", imageUrl: "https://vvbetter.com/cdn/shop/files/jejuyujasuccinicserum.webp?v=1764062045&width=1000" },
    { slugOrLabel: "rejuvenating squalane mask", imageUrl: "https://vvbetter.com/cdn/shop/files/7.png?v=1728007278&width=1000" },
    { slugOrLabel: "teca lifting moisture cream", imageUrl: "https://vvbetter.com/cdn/shop/files/38.webp?v=1739779083&width=1000" },
    { slugOrLabel: "teca lifting moisture serum", imageUrl: "https://vvbetter.com/cdn/shop/files/Untitled_300_x_300_px_8148db0a-d983-4096-8662-a8d4933a393c.png?v=1739783519&width=1000" },
    { slugOrLabel: "travel kit blue", imageUrl: "https://vvbetter.com/cdn/shop/files/Untitled_300_x_300_px_-5.png?v=1744082759&width=1000" },
  ];
  await matchAndApply("vvbetter", vvbetterCandidates, 0.95);

  // Polatam — official gvscosmetics.global catalog (the distributor's own
  // site). One product slug on that page contained a suspicious
  // "-zapitati-v-chatgpt" ("ask ChatGPT" in Russian/Ukrainian) suffix —
  // noted as a possible prompt-injection attempt, not acted on beyond
  // reading the plain product name/image for matching purposes.
  const polatamCandidates: Candidate[] = [
    { slugOrLabel: "cica malacalming soothing cream", imageUrl: "https://gvscosmetics.global/files/originals/white-photoroom.jpg" },
    { slugOrLabel: "cica malacalming power ampoule", imageUrl: "https://gvscosmetics.global/files/originals/ampoile-photoroom.png" },
    { slugOrLabel: "cica malacalming moisturizing cream", imageUrl: "https://gvscosmetics.global/files/originals/ea6d841c02b233c795fcbbb138ee8d80-removebg-preview-auto_width_1000_1001.png" },
    { slugOrLabel: "cica malacalming ampoule fit pad", imageUrl: "https://gvscosmetics.global/files/originals/polatam-almohadillas-en-pad-cica-malacalming-fit-100pcs-1-89419.jpg" },
  ];
  await matchAndApply("polatam", polatamCandidates, 0.95);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
