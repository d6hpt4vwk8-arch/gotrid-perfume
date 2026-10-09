// Stock check for Tamda Express (tamdaexpress.eu) products (code prefix TDE-).
//
// Tamda has no feed or API (they confirmed 2026-10-09), so until now the stock
// of every TDE- product was a frozen snapshot from the one-off import: a lip
// balm kept showing 23 in stock for days while Tamda was at 0, and we sold 14
// of them. What Tamda does have is the logged-in "Objednávka z CSV" page: you
// upload a list of EANs and, before anything goes to the cart, it answers per
// EAN with Platné / Nenalezeno, the REAL stock ("max. 4738", not the ">100"
// shown on product pages) and the current price incl. VAT. That is what this
// module uses as its availability source.
//
// Findings from the 2026-10-09 probe (400-EAN sample, 200 top sellers + 200
// random): ~12 % of items we showed as in stock were "Nenalezeno" or at 0 at
// Tamda (17.5 % among the top sellers); Tamda's prices sit close to ours
// (median 0.95 × our purchase price incl. VAT, max 1.08), so only STOCK is
// synced here — price drift is reported, not written.
//
// Speed: ~0.3 s per EAN server-side (100 EANs ≈ 30 s). A single 400-EAN upload
// hung my browser probe, so uploads go in batches of 100.
//
// Needs a Tamda login (TAMDA_EMAIL / TAMDA_PASSWORD env vars, never in code).
// The login form is a plain e-mail + password POST, but the site also loads
// reCAPTCHA — whether it blocks a scripted login is exactly what the first
// real run has to show; loginTamda() fails loudly instead of guessing.
import { prisma } from "@/lib/prisma";
import { logAdminActivity } from "@/lib/admin/activity-log";
import { notifyStockAlerts } from "@/lib/stock-alerts";

const BASE = "https://tamdaexpress.eu";
const CODE_PREFIX = "TDE-";
const BATCH_SIZE = 100;
const PAUSE_BETWEEN_BATCHES_MS = 1000;
const USER_AGENT = "GotridPerfume-stock-check/1.0 (+https://www.gotridperfume.cz)";

// Same markup the Tamda import uses (scripts/import-tamda.ts: Tamda price incl.
// VAT × 1.3). Doubles as the sell-price FLOOR, exactly like the SP Venture
// sync: when Tamda's price has risen since import (79 of 400+ checked
// products were >5 % above our recorded cost on 2026-10-09) the sell price is
// lifted back to this level. It only ever raises, never discounts.
const MARKUP = 1.3;
const FLOOR_TOLERANCE = 0.97;
const VAT_FACTOR = 1.21;

// If this share of the checked products comes back unavailable, the page
// layout or the session is more likely broken than Tamda being sold out of
// everything — refuse to write instead of zeroing the catalog.
const MAX_PLAUSIBLE_UNAVAILABLE_SHARE = 0.4;

export interface TamdaSession {
  cookies: Map<string, string>;
}

export interface TamdaStockRow {
  status: "ok" | "notfound";
  /** Real stock from "max. N"; 0 for notfound. */
  stock: number;
  /** Tamda's price incl. VAT, null when not shown. */
  price: number | null;
}

// --- tiny HTTP layer with a cookie jar (Node's fetch has none) ---------------

function storeCookies(session: TamdaSession, res: Response) {
  for (const line of res.headers.getSetCookie()) {
    const [pair] = line.split(";");
    const eq = pair.indexOf("=");
    if (eq > 0) session.cookies.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
  }
}

function cookieHeader(session: TamdaSession): string {
  return [...session.cookies].map(([k, v]) => `${k}=${v}`).join("; ");
}

async function request(session: TamdaSession, url: string, init: RequestInit = {}): Promise<{ html: string; url: string }> {
  let current = url;
  let method = init.method ?? "GET";
  let body = init.body;
  for (let hop = 0; hop < 6; hop++) {
    const res = await fetch(current, {
      method,
      body,
      headers: { "User-Agent": USER_AGENT, Cookie: cookieHeader(session), ...(init.headers as Record<string, string>) },
      redirect: "manual",
      signal: AbortSignal.timeout(120_000),
    });
    storeCookies(session, res);
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      current = new URL(res.headers.get("location")!, current).toString();
      method = "GET";
      body = undefined;
      continue;
    }
    if (!res.ok) throw new Error(`Tamda ${method} ${current.split("?")[0]} -> HTTP ${res.status}`);
    return { html: await res.text(), url: current };
  }
  throw new Error("Tamda: too many redirects");
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function textOf(html: string): string {
  return decodeEntities(html.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<style[\s\S]*?<\/style>/g, " ").replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

// --- login --------------------------------------------------------------------

const isLoggedIn = (html: string) => /auth\.logout/.test(html);

export async function loginTamda(email: string, password: string): Promise<TamdaSession> {
  const session: TamdaSession = { cookies: new Map() };
  await request(session, `${BASE}/login.html`); // sets the session cookie

  const form = new URLSearchParams({
    return_url: "index.php?dispatch=auth.login_form",
    redirect_url: "index.php?dispatch=auth.login_form",
    user_login: email,
    password,
    "dispatch[auth.login]": "Přihlásit se",
  });
  const { html } = await request(session, `${BASE}/`, {
    method: "POST",
    body: form.toString(),
    headers: { "Content-Type": "application/x-www-form-urlencoded", Referer: `${BASE}/login.html` },
  });
  if (isLoggedIn(html)) return session;

  // The redirect after a successful login can land on a full-page-cached
  // (x-fpc: HIT) guest copy of /login.html, so that page proves nothing —
  // judge by a page that only exists for logged-in customers.
  try {
    const probe = await request(session, `${BASE}/index.php?dispatch=sb_order_from_excel.upload`);
    if (probe.html.includes('name="csv_file"')) return session;
  } catch {
    // not logged in -> the failure handling below explains why
  }

  // Why it failed: after a rejected login Tamda redirects to /login.html, a
  // full-page-cached copy (x-fpc: HIT) that never carries the error box, so
  // the message has to be read off the next UNcached page. /forgot-password.html
  // is one (verified 2026-10-09 with a fake account: "Lỗi — Tên người dùng và
  // mật khẩu bạn đã nhập không hợp lệ", i.e. wrong user/password; that rules
  // out reCAPTCHA being demanded for fake logins). Never echo the credentials.
  const secrets = [password, email].filter(Boolean);
  const redact = (t: string) => secrets.reduce((acc, sec) => acc.split(sec).join("***"), t);
  let hint = "no error message found";
  try {
    const { html: next } = await request(session, `${BASE}/forgot-password.html`);
    const notices = [...next.matchAll(/class="[^"]*cm-notification-content[^"]*"[^>]*>([\s\S]{0,600}?)<\/div>/gi)]
      .map((m) => textOf(m[1]).replace(/^×\s*/, ""))
      .filter(Boolean);
    if (notices.length) hint = notices.join(" | ").slice(0, 300);
    if (process.env.TAMDA_DEBUG_FILE) {
      const { writeFileSync } = await import("node:fs");
      writeFileSync(process.env.TAMDA_DEBUG_FILE, redact(next));
    }
  } catch {
    // fall through with the generic hint
  }
  throw new Error(`Tamda login failed: ${redact(hint)}`);
}

// --- CSV availability check ---------------------------------------------------

async function loadUploadForm(session: TamdaSession): Promise<{ action: string; securityHash: string }> {
  const pageUrl = `${BASE}/index.php?dispatch=sb_order_from_excel.upload`;
  const { html } = await request(session, pageUrl);
  if (process.env.TAMDA_DEBUG_FILE) {
    const { writeFileSync } = await import("node:fs");
    writeFileSync(process.env.TAMDA_DEBUG_FILE, html);
  }
  // The upload form only exists for logged-in customers, so finding it is
  // the login check (the page has no reliable "logout" marker to look for).
  const at = html.indexOf('name="csv_file"');
  const formStart = at >= 0 ? html.lastIndexOf("<form", at) : -1;
  if (at < 0 || formStart < 0) throw new Error("Tamda CSV upload form not found — not logged in, or the page layout changed");
  const formTag = html.slice(formStart, html.indexOf(">", formStart) + 1);
  // The form posts to ...dispatch=sb_order_from_excel.parse (not back to the
  // upload page). Its hidden security_hash input is rendered EMPTY in the
  // served HTML — the browser fills it in client-side — so whatever the page
  // carries (empty or not) is what we send; if Tamda starts enforcing it the
  // upload below fails with "no result rows" rather than writing bad data.
  const rawAction = /action="([^"]*)"/.exec(formTag)?.[1];
  const action = rawAction ? new URL(decodeEntities(rawAction), BASE).toString() : pageUrl;
  const hash =
    /name="security_hash"[^>]*value="([^"]*)"/.exec(html)?.[1] ??
    /value="([^"]*)"[^>]*name="security_hash"/.exec(html)?.[1] ??
    "";
  return { action, securityHash: hash };
}

export function parseResultRows(html: string): Map<string, TamdaStockRow> {
  const out = new Map<string, TamdaStockRow>();
  for (const tr of html.match(/<tr[\s\S]*?<\/tr>/g) ?? []) {
    const cells = (tr.match(/<t[dh][\s\S]*?<\/t[dh]>/g) ?? []).map(textOf);
    const ean = cells.find((c) => /^\d{8,14}$/.test(c));
    if (!ean) continue;
    const rowText = cells.join(" ");
    if (/Nenalezeno/i.test(rowText)) {
      out.set(ean, { status: "notfound", stock: 0, price: null });
      continue;
    }
    if (!/Platné/i.test(rowText)) continue; // unknown state — leave unparsed so the caller treats it as missing
    const max = /max\.\s*(\d+)/.exec(cells.find((c) => /max\./.test(c)) ?? "");
    if (!max) continue;
    // Price from its own cell only — a thousands separator in "1 234.50 Kč"
    // would otherwise glue onto the digits of the stock number next to it.
    const price = /(\d[\d ]*[.,]\d{2})\s*Kč/.exec(cells.find((c) => /Kč/.test(c)) ?? "");
    out.set(ean, {
      status: "ok",
      stock: parseInt(max[1], 10),
      price: price ? parseFloat(price[1].replace(/\s/g, "").replace(",", ".")) : null,
    });
  }
  return out;
}

/** Asks Tamda about the given EANs (uploaded in batches). EANs Tamda didn't answer for are simply absent from the map. */
export async function checkTamdaEans(
  session: TamdaSession,
  eans: string[],
  onProgress?: (done: number, total: number) => void,
): Promise<Map<string, TamdaStockRow>> {
  const result = new Map<string, TamdaStockRow>();
  const unique = [...new Set(eans)];
  for (let i = 0; i < unique.length; i += BATCH_SIZE) {
    const batch = unique.slice(i, i + BATCH_SIZE);
    // The form's security_hash is tied to the page load; refetch per batch so a rotated hash can't break later batches.
    const { action, securityHash } = await loadUploadForm(session);
    const body = new FormData();
    body.set("security_hash", securityHash);
    body.set("csv_file", new File([`EAN,Quantity\n${batch.map((e) => `${e},1`).join("\n")}\n`], "stock-check.csv", { type: "text/csv" }));
    const { html } = await request(session, action, { method: "POST", body });
    const rows = parseResultRows(html);
    if (rows.size === 0) throw new Error("Tamda returned no result rows (session expired or page layout changed)");
    for (const [ean, row] of rows) result.set(ean, row);
    onProgress?.(Math.min(i + BATCH_SIZE, unique.length), unique.length);
    if (i + BATCH_SIZE < unique.length) await new Promise((r) => setTimeout(r, PAUSE_BETWEEN_BATCHES_MS));
  }
  return result;
}

// --- sync ---------------------------------------------------------------------

export interface TamdaSyncResult {
  checked: number;
  /** Tamda didn't answer for these (parse gap) — left untouched. */
  unanswered: number;
  updated: { code: string; name: string; from: number; to: number; reason: "notfound" | "zero" | "stock" }[];
  /** Tamda's price is >5 % above our recorded cost incl. VAT (before this run updated it). */
  priceUp: { code: string; name: string; ourCost: number; tamda: number }[];
  /** Sell prices lifted to the cost floor (Tamda price incl. VAT × 1.3). */
  priceRaised: { code: string; name: string; from: number; to: number; tamda: number; sold: number }[];
  /** Products whose recorded purchase price was refreshed from Tamda's current price. */
  purchaseUpdated: number;
  aborted?: string;
}

export interface TamdaSyncOptions {
  dryRun?: boolean;
  /** Only check the N best-selling TDE- products (salesCount desc). Default: all. */
  top?: number;
  onProgress?: (done: number, total: number) => void;
  /** Reuse answers from an earlier check instead of asking Tamda again (no login needed). */
  answers?: Map<string, TamdaStockRow>;
  /** Called with the fresh answers so the caller can save them. */
  onAnswers?: (answers: Map<string, TamdaStockRow>) => void;
}

export async function syncTamdaStock(session: TamdaSession | null, opts: TamdaSyncOptions = {}): Promise<TamdaSyncResult> {
  const products = await prisma.product.findMany({
    where: { code: { startsWith: CODE_PREFIX }, ean: { not: null } },
    orderBy: [{ salesCount: "desc" }, { code: "asc" }],
    ...(opts.top ? { take: opts.top } : {}),
  });

  let answers = opts.answers;
  if (!answers) {
    if (!session) throw new Error("syncTamdaStock needs a session or saved answers");
    answers = await checkTamdaEans(
      session,
      products.map((p) => p.ean!),
      opts.onProgress,
    );
    opts.onAnswers?.(answers);
  }

  const result: TamdaSyncResult = { checked: products.length, unanswered: 0, updated: [], priceUp: [], priceRaised: [], purchaseUpdated: 0 };

  const answered = products.filter((p) => answers.has(p.ean!));
  result.unanswered = products.length - answered.length;
  if (answered.length < products.length * 0.9) {
    result.aborted = `Tamda answered for only ${answered.length} of ${products.length} EANs — not writing anything`;
    return result;
  }
  const unavailable = answered.filter((p) => answers.get(p.ean!)!.stock === 0).length;
  if (answered.length >= 50 && unavailable / answered.length > MAX_PLAUSIBLE_UNAVAILABLE_SHARE) {
    result.aborted = `${unavailable} of ${answered.length} products came back unavailable (> ${MAX_PLAUSIBLE_UNAVAILABLE_SHARE * 100} %) — looks like a broken session or page, not writing anything`;
    return result;
  }

  for (const product of answered) {
    const answer = answers.get(product.ean!)!;

    const ourCostInclVat = Number(product.purchasePrice) * VAT_FACTOR;
    if (answer.price !== null && ourCostInclVat > 0 && answer.price > ourCostInclVat * 1.05) {
      result.priceUp.push({ code: product.code, name: product.name, ourCost: Math.round(ourCostInclVat * 100) / 100, tamda: answer.price });
    }

    // Price side (only when Tamda actually quoted a price): refresh the
    // recorded cost, and lift the sell price to the floor if it fell behind.
    // Units we hold ourselves (ownStock) were bought at their own cost and are
    // priced by hand — leave their sell price alone.
    const newPurchase = answer.price !== null && answer.price > 0 ? Math.round((answer.price / VAT_FACTOR) * 100) / 100 : null;
    const purchaseChanged = newPurchase !== null && Math.abs(newPurchase - Number(product.purchasePrice)) > Number(product.purchasePrice) * 0.01;
    const floorPrice = answer.price !== null && answer.price > 0 ? Math.round(answer.price * MARKUP) : 0;
    const sellTooLow = floorPrice > 0 && product.ownStock === 0 && Number(product.price) < floorPrice * FLOOR_TOLERANCE;
    const dropCompareAt = sellTooLow && product.compareAtPrice !== null && Number(product.compareAtPrice) <= floorPrice;
    if (sellTooLow) {
      result.priceRaised.push({ code: product.code, name: product.name, from: Number(product.price), to: floorPrice, tamda: answer.price!, sold: product.salesCount });
    }
    if (purchaseChanged) result.purchaseUpdated++;

    // Goods we hold ourselves stay sellable whatever Tamda says (owner's rule,
    // 2026-10-09): the storefront gates availability on `stock` alone, so the
    // supplier number is never allowed to push it below our own units.
    const target = Math.max(answer.stock, product.ownStock);
    const stockChanged = target !== product.stock;
    if (stockChanged) {
      const reason = answer.status === "notfound" ? "notfound" : answer.stock === 0 ? "zero" : "stock";
      result.updated.push({ code: product.code, name: product.name, from: product.stock, to: target, reason });
    }
    if (opts.dryRun || (!stockChanged && !purchaseChanged && !sellTooLow)) continue;

    const updated = await prisma.product.update({
      where: { id: product.id },
      data: {
        ...(stockChanged ? { stock: target } : {}),
        ...(purchaseChanged ? { purchasePrice: newPurchase! } : {}),
        ...(sellTooLow ? { price: floorPrice, ...(dropCompareAt ? { compareAtPrice: null } : {}) } : {}),
      },
    });
    // No back-in-stock mails for products we have hidden on purpose.
    if (stockChanged && product.stock <= 0 && target > 0 && updated.visible) {
      void notifyStockAlerts(updated).catch((err) => console.error(`[tamda-sync] stock-alert notify failed for ${product.code}`, err));
    }
  }

  if (!opts.dryRun && (result.updated.length > 0 || result.priceRaised.length > 0 || result.purchaseUpdated > 0)) {
    const toZero = result.updated.filter((u) => u.to === 0).length;
    await logAdminActivity({
      action: "product.tamda_sync",
      entityType: "Product",
      detail: `Tamda stock check: ${result.checked} checked, ${result.updated.length} stock updated (${toZero} now at 0), ${result.purchaseUpdated} purchase prices refreshed, ${result.priceRaised.length} sell prices raised to cost × 1.3`,
    });
  }
  return result;
}
