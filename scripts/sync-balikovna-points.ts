// Syncs the BalikovnaPoint table from Česká pošta's own e-shop-integration
// data feed (napostu.ceskaposta.cz/vystupy/balikovny.xml — found in their
// official "Implementační balíček Balíkovna", which explicitly documents
// this XML as the source for e-shop pickup-point pickers). Only actual
// pickup points are kept (kind "balíkovna partner" / "balíkovna-BOX") —
// the feed also lists plain post offices ("pošta") and internal depots
// ("depo"), which belong to a different delivery method (Balík Na poštu).
// Re-runnable: upserts by the feed's own row code, removes points the feed
// no longer lists. Re-run periodically (the network changes gradually) —
// see the "Next step" note this produces at the end for automating that.
import { PrismaClient } from "@prisma/client";
import { XMLParser } from "fast-xml-parser";

const prisma = new PrismaClient();

const FEED_URL = "http://napostu.ceskaposta.cz/vystupy/balikovny.xml";
const PICKUP_KINDS = new Set(["balíkovna partner", "balíkovna-BOX"]);

interface FeedRow {
  PSC: string;
  NAZEV: string;
  ADRESA: string;
  TYP: string;
  SOUR_X_WGS84: string;
  SOUR_Y_WGS84: string;
  OBEC: string;
  C_OBCE: string;
  OTEV_DOBY?: { den?: FeedDay | FeedDay[] };
}

interface FeedDay {
  "@_name": string;
  od_do?: { od: string; do: string } | { od: string; do: string }[];
}

function normalizeHours(row: FeedRow): Record<string, { from: string; to: string }[]> | null {
  const days = row.OTEV_DOBY?.den;
  if (!days) return null;
  const list = Array.isArray(days) ? days : [days];
  const result: Record<string, { from: string; to: string }[]> = {};
  for (const day of list) {
    const name = day["@_name"];
    if (!day.od_do) {
      result[name] = [];
      continue;
    }
    const ranges = Array.isArray(day.od_do) ? day.od_do : [day.od_do];
    result[name] = ranges.map((r) => ({ from: r.od, to: r.do }));
  }
  return result;
}

async function main() {
  console.log(`Fetching ${FEED_URL} ...`);
  const res = await fetch(FEED_URL);
  if (!res.ok) throw new Error(`Feed fetch failed: ${res.status}`);
  const xml = await res.text();

  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", parseTagValue: false });
  const parsed = parser.parse(xml);
  const rows: FeedRow[] = parsed.zv.row;
  console.log(`Feed has ${rows.length} total locations.`);

  const points = rows.filter((r) => PICKUP_KINDS.has(r.TYP));
  console.log(`${points.length} are Balíkovna pickup points (kept), ${rows.length - points.length} skipped (pošta/depo).`);

  const seenIds = new Set<string>();
  let upserted = 0;
  for (const row of points) {
    const lat = Number(row.SOUR_Y_WGS84);
    const lng = Number(row.SOUR_X_WGS84);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    seenIds.add(row.PSC);
    await prisma.balikovnaPoint.upsert({
      where: { id: row.PSC },
      create: {
        id: row.PSC,
        name: row.NAZEV,
        address: row.ADRESA,
        kind: row.TYP,
        lat,
        lng,
        city: row.OBEC,
        cityPart: row.C_OBCE,
        openingHours: normalizeHours(row) ?? undefined,
      },
      update: {
        name: row.NAZEV,
        address: row.ADRESA,
        kind: row.TYP,
        lat,
        lng,
        city: row.OBEC,
        cityPart: row.C_OBCE,
        openingHours: normalizeHours(row) ?? undefined,
      },
    });
    upserted++;
    if (upserted % 500 === 0) console.log(`  ${upserted}/${points.length}...`);
  }

  const existing = await prisma.balikovnaPoint.findMany({ select: { id: true } });
  const staleIds = existing.map((p) => p.id).filter((id) => !seenIds.has(id));
  if (staleIds.length > 0) {
    await prisma.balikovnaPoint.deleteMany({ where: { id: { in: staleIds } } });
  }

  console.log(`Done. Upserted ${upserted}, removed ${staleIds.length} stale.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
