// Perfume category restructure (owner decision 2026-10-09):
//   Parfémy → Arabské parfémy (every Arabic-house brand, not just the 209 that happened to be filed there),
//             Značkové parfémy (new: everything else that is a proper perfume), Dárkové sady, Doplňky.
//   Gender (Dámské/Pánské/Unisex) stops being a tile/menu branch and stays only as the existing "Pro koho"
//   filter — the facet reads membership of the gender categories, so products keep (or get) their gender leaf;
//   the three gender categories are just flagged hidden (nav/tiles/sitemap). Nišové parfémy are hidden
//   (category flag + their products visible=false) — nothing is deleted.
//
//   npx tsx scripts/restructure-perfume-categories.ts                 dry run, writes the plan CSV
//   npx tsx scripts/restructure-perfume-categories.ts --apply         writes to the DB + snapshot
//   npx tsx scripts/restructure-perfume-categories.ts --revert=PATH   undo using the snapshot
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");
const REVERT = process.argv.find((a) => a.startsWith("--revert="))?.slice(9);
const CSV = "ops/perfume-restructure-plan.csv";
const SNAPSHOT_DIR = "ops/snapshots";

// Arabic-house brands: the paid-ads list plus the ones found filed under gender categories on 2026-10-09.
const ARABIC = new Set(
  [
    "Fragrance World", "French Avenue", "Gulf Orchid", "Khadlaj", "Emir", "Arabiyat Prestige", "Maison Asrar",
    "Auraa Desire", "Rayhaan", "Arabiyat Sugar", "Matin Martin", "Al Haramain", "Ministry Of Oud", "Nylaa", "Afnan",
    "Anfar 1950", "Anfar London", "La Fede", "North Stag", "Armaf", "Armaf Beauté", "Lattafa", "Lattafa Pride",
    "Swiss Arabian", "Zimaya", "Hamidi", "Grandeur", "Al Wataniah", "Risala", "Paris Corner", "Dark Stag",
    "Maison Alhambra", "Ajmal", "Rasasi", "Naseem", "Delroba", "Just Jack",
  ].map((b) => b.toLowerCase()),
);
const SET_RE = /\bSET\b|gift ?set|giftset|coffret|\d\s?ml\s*\+\s*\S/i;

const GENDER_PARENT = { damske: "parfemy/damske-parfemy", panske: "parfemy/panske-parfemy", unisex: "parfemy/unisex-parfemy" } as const;
type Gender = keyof typeof GENDER_PARENT;

function genderFromName(name: string): Gender | null {
  if (/\bpour homme\b|\bfor men\b|\bmen\b|\bhomme\b/i.test(name) || /(^|\s)M(\s|$)/.test(name)) return "panske";
  if (/\bpour femme\b|\bfor women\b|\bwomen\b|\bfemme\b/i.test(name) || /(^|\s)[WF](\s|$)/.test(name)) return "damske";
  if (/(^|\s)U(\s|$)|\bunisex\b/i.test(name)) return "unisex";
  return null;
}
function leafFromName(name: string, gender: Gender): string {
  if (/\bEDT\b|toaletní|eau de toilette/i.test(name)) return "toaletni-vody";
  if (/\b(oil|olej|attar)\b/i.test(name) && gender !== "panske") return "parfemovane-oleje";
  return "parfemovane-vody";
}

async function revert(path: string) {
  const snap = JSON.parse(readFileSync(path, "utf8"));
  await prisma.productCategory.deleteMany({ where: { OR: snap.added.map((a: { productId: string; categoryId: string }) => ({ productId: a.productId, categoryId: a.categoryId })) } });
  if (snap.removed.length) await prisma.productCategory.createMany({ data: snap.removed, skipDuplicates: true });
  await prisma.product.updateMany({ where: { id: { in: snap.hiddenProducts } }, data: { visible: true } });
  for (const c of snap.categoryBefore) await prisma.category.update({ where: { id: c.id }, data: { hidden: c.hidden, description: c.description, sortOrder: c.sortOrder } });
  if (snap.createdCategoryId) await prisma.category.deleteMany({ where: { id: snap.createdCategoryId } });
  console.log("Reverted from", path);
}

async function main() {
  if (REVERT) return revert(REVERT);

  const cats = await prisma.category.findMany();
  const bySlug = new Map(cats.map((c) => [c.fullSlug, c]));
  const need = (s: string) => bySlug.get(s) ?? (() => { throw new Error("missing category " + s); })();
  const parfemy = need("parfemy"), arabske = need("parfemy/arabske-parfemy"), sady = need("parfemy/darkove-sady"), niche = need("nisove-parfemy");
  const znackove = bySlug.get("parfemy/znackove-parfemy") ?? null;

  const products = await prisma.product.findMany({
    where: { visible: true, categories: { some: { category: { OR: [{ fullSlug: { startsWith: "parfemy" } }, { fullSlug: "nisove-parfemy" }] } } } },
    select: { id: true, code: true, name: true, price: true, stock: true, brand: { select: { name: true } }, categories: { select: { categoryId: true, category: { select: { fullSlug: true } } } } },
  });

  type Row = { id: string; code: string; name: string; brand: string; price: number; group: string; actions: string[] };
  const rows: Row[] = [];
  const add: { productId: string; categoryId: string }[] = [];
  const remove: { productId: string; categoryId: string }[] = [];
  const hide: string[] = [];
  let genderAssigned = 0, genderUnknown = 0;

  for (const p of products) {
    const slugs = p.categories.map((c) => c.category.fullSlug);
    const has = (s: string) => slugs.includes(s);
    const brand = p.brand?.name ?? "";
    const row: Row = { id: p.id, code: p.code, name: p.name, brand, price: Math.round(Number(p.price)), group: "", actions: [] };
    rows.push(row);

    if (has("nisove-parfemy")) { row.group = "NICHE"; row.actions.push("hide product"); hide.push(p.id); continue; }
    if (slugs.some((s) => s.startsWith("parfemy/doplnky"))) { row.group = "ACCESSORY"; continue; }
    const isSet = has("parfemy/darkove-sady") || SET_RE.test(p.name);
    if (isSet) {
      row.group = "SET";
      if (!has("parfemy/darkove-sady")) { add.push({ productId: p.id, categoryId: sady.id }); row.actions.push("+ Dárkové sady"); }
      if (has("parfemy/arabske-parfemy")) { remove.push({ productId: p.id, categoryId: arabske.id }); row.actions.push("- Arabské"); }
      continue;
    }
    const arabic = ARABIC.has(brand.toLowerCase()) || has("parfemy/arabske-parfemy");
    if (arabic) {
      row.group = "ARABIC";
      if (!has("parfemy/arabske-parfemy")) { add.push({ productId: p.id, categoryId: arabske.id }); row.actions.push("+ Arabské"); }
      if (!slugs.some((s) => /^parfemy\/(damske|panske|unisex)-parfemy/.test(s))) {
        const g = genderFromName(p.name);
        if (g) {
          const leaf = bySlug.get(`${GENDER_PARENT[g]}/${leafFromName(p.name, g)}`) ?? bySlug.get(GENDER_PARENT[g])!;
          add.push({ productId: p.id, categoryId: leaf.id }); row.actions.push(`+ ${leaf.fullSlug}`); genderAssigned++;
        } else genderUnknown++;
      }
    } else {
      row.group = "BRANDED";
      if (znackove && has("parfemy/znackove-parfemy")) continue;
      row.actions.push("+ Značkové"); // category id resolved at apply time when it doesn't exist yet
      add.push({ productId: p.id, categoryId: znackove?.id ?? "__ZNACKOVE__" });
    }
  }

  const g = (k: string) => rows.filter((r) => r.group === k).length;
  console.log(`Perfume products (visible): ${products.length}`);
  console.log(`  ARABIC ${g("ARABIC")}  (already in Arabské: ${rows.filter((r) => r.group === "ARABIC" && !r.actions.includes("+ Arabské")).length}, to add: ${rows.filter((r) => r.actions.includes("+ Arabské")).length})`);
  console.log(`  BRANDED ${g("BRANDED")} -> new Značkové parfémy`);
  console.log(`  SET ${g("SET")} (to Dárkové sady: ${rows.filter((r) => r.actions.includes("+ Dárkové sady")).length}, removed from Arabské: ${rows.filter((r) => r.actions.includes("- Arabské")).length})`);
  console.log(`  ACCESSORY ${g("ACCESSORY")}   NICHE (hide) ${g("NICHE")}`);
  console.log(`  Arabic gender leaf assigned from name: ${genderAssigned}, unknown (left without gender): ${genderUnknown}`);
  const brandCount = (grp: string) => { const m = new Map<string, number>(); rows.filter((r) => r.group === grp).forEach((r) => m.set(r.brand || "?", (m.get(r.brand || "?") ?? 0) + 1)); return [...m.entries()].sort((a, b) => b[1] - a[1]); };
  console.log("\nBRANDED top brands:", brandCount("BRANDED").slice(0, 45).map(([b, n]) => `${b} ${n}`).join(", "));
  console.log("\nSets moved:", rows.filter((r) => r.group === "SET" && r.actions.length).slice(0, 25).map((r) => `${r.name.slice(0, 60)} (${r.price})`).join("\n  "));

  mkdirSync("ops", { recursive: true });
  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
  writeFileSync(CSV, "code,group,brand,price,name,actions\n" + rows.map((r) => [r.code, r.group, esc(r.brand), r.price, esc(r.name), esc(r.actions.join("; "))].join(",")).join("\n"));
  console.log(`\nPlan written to ${CSV}`);

  if (!APPLY) return console.log("\nDRY RUN — nothing changed. Re-run with --apply.");

  // ---- apply ----
  const snapshot = { when: new Date().toISOString(), added: [] as typeof add, removed: [] as typeof remove, hiddenProducts: hide, categoryBefore: [] as { id: string; hidden: boolean; description: string | null; sortOrder: number }[], createdCategoryId: null as string | null };
  let znackoveCat = znackove;
  if (!znackoveCat) {
    znackoveCat = await prisma.category.create({ data: { name: "Značkové parfémy", slug: "znackove-parfemy", fullSlug: "parfemy/znackove-parfemy", parentId: parfemy.id, sortOrder: -2 } });
    snapshot.createdCategoryId = znackoveCat.id;
  }
  const addFinal = add.map((a) => (a.categoryId === "__ZNACKOVE__" ? { ...a, categoryId: znackoveCat!.id } : a));
  // snapshot only the rows that don't exist yet
  const existing = new Set((await prisma.productCategory.findMany({ select: { productId: true, categoryId: true } })).map((x) => x.productId + "|" + x.categoryId));
  snapshot.added = addFinal.filter((a) => !existing.has(a.productId + "|" + a.categoryId));
  snapshot.removed = remove.filter((r) => existing.has(r.productId + "|" + r.categoryId));
  for (const c of [niche, bySlug.get("parfemy/damske-parfemy")!, bySlug.get("parfemy/panske-parfemy")!, bySlug.get("parfemy/unisex-parfemy")!, parfemy, arabske]) snapshot.categoryBefore.push({ id: c.id, hidden: c.hidden, description: c.description, sortOrder: c.sortOrder });
  mkdirSync(SNAPSHOT_DIR, { recursive: true });
  const snapPath = `${SNAPSHOT_DIR}/perfume-restructure-${Date.now()}.json`;
  writeFileSync(snapPath, JSON.stringify(snapshot));

  await prisma.productCategory.createMany({ data: snapshot.added, skipDuplicates: true });
  for (const r of snapshot.removed) await prisma.productCategory.delete({ where: { productId_categoryId: r } });
  await prisma.product.updateMany({ where: { id: { in: hide } }, data: { visible: false } });
  await prisma.category.updateMany({ where: { id: { in: [niche.id, bySlug.get("parfemy/damske-parfemy")!.id, bySlug.get("parfemy/panske-parfemy")!.id, bySlug.get("parfemy/unisex-parfemy")!.id] } }, data: { hidden: true } });
  await prisma.category.update({ where: { id: arabske.id }, data: { sortOrder: -3 } });
  await prisma.category.update({ where: { id: znackoveCat.id }, data: { sortOrder: -2 } });
  await prisma.category.update({
    where: { id: parfemy.id },
    data: {
      description:
        '<p>Ať hledáte parfém pro sebe nebo jako dárek, začněte u <a href="/kategorie/parfemy/arabske-parfemy"><b><u>arabských parfémů</u></b></a> — výrazné, dlouhotrvající vůně s oudem, ambrou a vanilkou — nebo u <a href="/kategorie/parfemy/znackove-parfemy"><b><u>značkových parfémů</u></b></a> známých domů. V každé kategorii si filtrem „Pro koho“ vyberete dámské, pánské nebo unisex vůně.</p><p>Hledáte dárek? Podívejte se na naše <a href="/kategorie/parfemy/darkove-sady"><b><u>dárkové sady</u></b></a> nebo praktické <a href="/kategorie/parfemy/doplnky"><b><u>doplňky</u></b></a> k parfémům.</p>',
    },
  });
  console.log(`\nAPPLIED. +${snapshot.added.length} memberships, -${snapshot.removed.length}, hidden products ${hide.length}. Snapshot: ${snapPath}`);
}
main().finally(() => prisma.$disconnect());
