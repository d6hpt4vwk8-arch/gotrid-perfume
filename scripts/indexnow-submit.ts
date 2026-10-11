// Tells Seznam (IndexNow protocol) that pages are new or changed, so SeznamBot
// re-crawls them within hours instead of weeks. The key file lives at
// public/<key>.txt and the same key is hard-wired here (it is public by design).
//   npx tsx scripts/indexnow-submit.ts                 every URL in the live sitemap
//   npx tsx scripts/indexnow-submit.ts --only=/produkt   only URLs containing the text
//   npx tsx scripts/indexnow-submit.ts --dry           count only, nothing sent
import { readFileSync, readdirSync } from "node:fs";

const HOST = "www.gotridperfume.cz";
const KEY = readdirSync("public").find((f) => /^[0-9a-f]{32}\.txt$/.test(f))!.replace(".txt", "");
const ENDPOINT = "https://search.seznam.cz/indexnow";
const ONLY = process.argv.find((a) => a.startsWith("--only="))?.split("=")[1];
const DRY = process.argv.includes("--dry");

(async () => {
  const xml = await (await fetch(`https://${HOST}/sitemap.xml`)).text();
  let urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  if (ONLY) urls = urls.filter((u) => u.includes(ONLY));
  console.log(`${urls.length} URLs, key ${KEY.slice(0, 6)}…`);
  if (DRY) return;
  const CHUNK = 2000;
  for (let i = 0; i < urls.length; i += CHUNK) {
    const body = { host: HOST, key: KEY, keyLocation: `https://${HOST}/${KEY}.txt`, urlList: urls.slice(i, i + CHUNK) };
    const res = await fetch(ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json; charset=utf-8" }, body: JSON.stringify(body) });
    console.log(`batch ${i / CHUNK + 1}: HTTP ${res.status} ${(await res.text()).slice(0, 120)}`);
  }
})();
