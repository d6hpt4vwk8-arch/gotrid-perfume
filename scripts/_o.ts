import { PrismaClient } from "@prisma/client";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import sharp from "sharp";
import path from "node:path";
const p = new PrismaClient();
const norm = (s: string) => s.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
const STOP = new Set("edp edt eau de parfum parfumovana voda unisex pansk dmsk damska panska pour ml extrakt olej perfume oil for men women homme femme spray the of by extrait toaletn".split());
const toks = (s: string, b = "") => new Set(norm(s).split(" ").filter((t) => t.length > 1 && !STOP.has(t) && !/^\d+(ml)?$/.test(t))) ;
async function dhash(buf: Buffer) { const d = await sharp(buf).greyscale().resize(9, 8, { fit: "fill" }).raw().toBuffer(); let b = ""; for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) b += d[y * 9 + x] > d[y * 9 + x + 1] ? "1" : "0"; return b; }
const ham = (a: string, b: string) => { let n = 0; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) n++; return n; };
async function dl(url: string) { try { const r = await fetch(url, { signal: AbortSignal.timeout(30000) }); if (!r.ok) return null; return Buffer.from(await r.arrayBuffer()); } catch { return null; } }
(async () => {
  const mps: any[] = JSON.parse(readFileSync("ops/gallery-cache/mps-body.json", "utf8"));
  const arm: any[] = JSON.parse(readFileSync("ops/gallery-cache/armaf-body.json", "utf8"));
  const root = await p.category.findUnique({ where: { fullSlug: "parfemy" } });
  const all = await p.category.findMany({ where: { OR: [{ id: root!.id }, { fullSlug: { startsWith: "parfemy/" } }] }, select: { id: true, fullSlug: true } });
  const ids = all.filter((c) => !c.fullSlug.startsWith("parfemy/arabske-parfemy")).map((c) => c.id);
  const arIds = all.filter((c) => c.fullSlug.startsWith("parfemy/arabske-parfemy")).map((c) => c.id);
  const ps = await p.product.findMany({ where: { visible: true, AND: [{ categories: { some: { categoryId: { in: ids } } } }, { categories: { none: { categoryId: { in: arIds } } } }] }, select: { code: true, name: true, brand: { select: { name: true } }, images: { orderBy: { sortOrder: "asc" }, select: { url: true } } } });
  const todo = ps.filter((x) => x.images.length <= 1 && !/travalo|\bset\b|dárková|sada|STR8|tester/i.test(x.name));
  console.log("w/o gallery", todo.length);
  const out: any[] = []; let k0 = 0;
  for (const x of todo) {
    const brand = x.brand?.name ?? ""; const b0 = norm(brand).split(" ")[0];
    const nm = x.name.replace(/ – .*$/, "").replace(/ \d+ ml$/, "");
    const q = toks(nm); for (const w of norm(brand).split(" ")) q.delete(w);
    let best: any = null;
    const pool = [...mps.map((m) => ({ ...m, src: "mps" })), ...(b0 === "armaf" ? arm.map((m) => ({ ...m, src: "armaf" })) : [])];
    for (const sp of pool) {
      if (!norm((sp.vendor ?? "") + " " + sp.title).includes(b0)) continue;
      if (/body spray|gift set|set |deodorant|hair mist/i.test(sp.title)) continue;
      const conc = (n: string) => { const m = norm(n); if (/\bedp\b|parfemovana voda|eau de parfum/.test(m)) return "edp"; if (/\bedt\b|toaletni voda|eau de toilette/.test(m)) return "edt"; if (/\bedc\b|kolinska|cologne/.test(m)) return "edc"; if (/extrait|extrakt/.test(m)) return "ext"; if (/parfum|parfem/.test(m)) return "parfum"; return ""; };
      const gen = (n: string) => { const m = norm(n); if (/danska|damska|women|woman|pour femme|for her|femme|lady/.test(m)) return "w"; if (/panska|for men|pour homme|\bmen\b|\bman\b|for him|homme/.test(m)) return "m"; if (/unisex/.test(m)) return "u"; return ""; };
      const c1 = conc(x.name), c2 = conc(sp.title); if (c1 && c2 && c1 !== c2) continue;
      const g1 = gen(x.name), g2 = gen(sp.title); if (g1 && g2 && g1 !== g2 && g1 !== "u" && g2 !== "u") continue;
      const t = toks(sp.title); for (const w of norm(brand).split(" ")) t.delete(w);
      if (!t.size) continue; let i = 0; for (const w of q) if (t.has(w)) i++;
      const sc = (i / Math.max(q.size, 1)) * 0.6 + (i / Math.max(t.size, 1)) * 0.4;
      if (!best || sc > best.score || (sc === best.score && sp.images.length > best.sp.images.length)) best = { score: sc, sp };
    }
    if (!best || best.score < 0.85 || best.sp.images.length < 2) { out.push({ code: x.code, name: x.name, matched: best?.sp.title ?? null, score: best?.score ?? 0, cands: [] }); continue; }
    const mainBuf = readFileSync(path.join("public", x.images[0].url)); const hashes = [await dhash(mainBuf)];
    const dir = `ops/gallery-cache/imgO/${x.code}`; mkdirSync(dir, { recursive: true });
    const cands: any[] = []; let k = 0;
    for (const src of best.sp.images.slice(0, 8)) {
      const f = `${dir}/${k}.jpg`; let buf = existsSync(f) ? readFileSync(f) : null;
      if (!buf) { const raw = await dl(src.split("?")[0] + "?width=1400"); if (!raw) continue; try { buf = await sharp(raw).rotate().flatten({ background: "#fff" }).resize({ width: 1400, height: 1400, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 88 }).toBuffer(); } catch { continue; } writeFileSync(f, buf); }
      const meta = await sharp(buf).metadata(); if (Math.max(meta.width!, meta.height!) < 700) { k++; continue; }
      const h = await dhash(buf); if (hashes.some((y) => ham(y, h) <= 8)) { k++; continue; }
      hashes.push(h); cands.push({ idx: k, file: f }); k++;
    }
    out.push({ code: x.code, name: x.name, matched: `[${best.sp.src}] ${best.sp.title}`, score: best.score, cands });
    if (++k0 % 25 === 0) console.log(k0);
  }
  writeFileSync("ops/gallery-cache/o-candidates.json", JSON.stringify(out, null, 1));
  const wc = out.filter((o) => o.cands.length);
  console.log("matched with cands:", wc.length, "of", out.length, "total cands", wc.reduce((a, b) => a + b.cands.length, 0));
  const by: Record<string, number> = {}; for (const o of wc) { const b = ps.find((x) => x.code === o.code)?.brand?.name ?? "?"; by[b] = (by[b] ?? 0) + 1; }
  console.log(JSON.stringify(by));
  await p.$disconnect();
})();