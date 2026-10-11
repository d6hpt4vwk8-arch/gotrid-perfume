import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { renderEmailLayout } from "@/lib/email/layout";
import { EMAIL_FROM, OWNER_EMAIL, getResendClient, isEmailConfigured } from "@/lib/email/resend";

export interface InstagramPost {
  id: string;
  permalink: string;
  mediaUrl: string;
  caption: string | null;
}

interface GraphMediaItem {
  id: string;
  permalink: string;
  caption?: string;
  media_type: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM";
  media_url: string;
  thumbnail_url?: string;
}

/**
 * Fetches the account's most recent posts via the Instagram API (Instagram
 * Login flow — graph.instagram.com, not the older Facebook-Page-linked
 * graph.facebook.com flow; the two issue different token types that aren't
 * interchangeable). Requires a Business/Creator account, a Meta app, and an
 * access token (see .env.example for the setup steps) — until those are
 * configured this just returns an empty list, so the footer falls back to
 * a plain profile link instead of breaking.
 */
const tail = (token: string) => token.slice(-12);
const REFRESH_EVERY_MS = 7 * 24 * 60 * 60 * 1000;
const ALERT_EVERY_MS = 24 * 60 * 60 * 1000;

/**
 * The token in use: the copy the daily cron keeps refreshing (Settings), as
 * long as it still derives from the env token — a freshly pasted
 * INSTAGRAM_ACCESS_TOKEN changes the tail and takes over again. Cached for an
 * hour so the footer doesn't hit the DB on every page render.
 */
const getActiveToken = unstable_cache(
  async (): Promise<string | null> => {
    const envToken = process.env.INSTAGRAM_ACCESS_TOKEN;
    if (!envToken) return null;
    const row = await prisma.settings.findUnique({
      where: { id: "singleton" },
      select: { instagramAccessToken: true, instagramTokenSeed: true },
    });
    return row?.instagramAccessToken && row.instagramTokenSeed === tail(envToken) ? row.instagramAccessToken : envToken;
  },
  ["instagram-active-token"],
  { revalidate: 3600 },
);

async function alertOwnerOnce(reason: string) {
  if (!isEmailConfigured()) return;
  const row = await prisma.settings.findUnique({ where: { id: "singleton" }, select: { instagramRefreshAlertAt: true } });
  if (row?.instagramRefreshAlertAt && Date.now() - row.instagramRefreshAlertAt.getTime() < ALERT_EVERY_MS) return;
  const html = renderEmailLayout(
    `<h1>Instagram na webu přestane fungovat</h1>
     <p>Přístupový token pro „Poslední z Instagramu“ se nepodařilo obnovit: <strong>${reason}</strong></p>
     <p>V Meta for Developers vygenerujte nový token (Instagram → API setup with Instagram login → Generate token), vložte ho do Vercelu jako <code>INSTAGRAM_ACCESS_TOKEN</code> a spusťte nové nasazení. Dál se obnovuje automaticky.</p>`,
  );
  const { error } = await getResendClient().emails.send({ from: EMAIL_FROM, to: OWNER_EMAIL, subject: "Instagram token vypršel — obnovte ho", html });
  if (!error) await prisma.settings.update({ where: { id: "singleton" }, data: { instagramRefreshAlertAt: new Date() } });
}

/**
 * Daily-cron job: keeps the long-lived Instagram token alive. Tokens last 60
 * days and can only be refreshed while still valid, so it renews weekly and
 * e-mails the owner (once a day) if a renewal ever fails — the footer feed
 * itself fails silently by design.
 */
export async function refreshInstagramToken(): Promise<{ status: string; detail?: string }> {
  const envToken = process.env.INSTAGRAM_ACCESS_TOKEN;
  if (!envToken) return { status: "not-configured" };

  const row = await prisma.settings.findUnique({
    where: { id: "singleton" },
    select: { instagramAccessToken: true, instagramTokenSeed: true, instagramTokenRefreshedAt: true },
  });
  const derived = row?.instagramAccessToken && row.instagramTokenSeed === tail(envToken);

  // A token just pasted into the env var is brand new (and Meta refuses to
  // refresh tokens younger than 24 h) — check it works, then adopt it and
  // start the weekly clock. An already-dead token must NOT be adopted, or the
  // "fresh" marker would hide the failure for a week.
  if (!derived) {
    try {
      const probe = new URL("https://graph.instagram.com/v21.0/me");
      probe.searchParams.set("fields", "id");
      probe.searchParams.set("access_token", envToken);
      const res = await fetch(probe, { cache: "no-store" });
      const body: { error?: { message?: string } } = await res.json();
      if (!res.ok) throw new Error(body.error?.message ?? `HTTP ${res.status}`);
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e);
      console.error(`[instagram] env token is not usable: ${detail}`);
      await alertOwnerOnce(detail).catch((err) => console.error("[instagram] alert e-mail failed", err));
      return { status: "failed", detail };
    }
    await prisma.settings.upsert({
      where: { id: "singleton" },
      update: { instagramAccessToken: envToken, instagramTokenSeed: tail(envToken), instagramTokenRefreshedAt: new Date() },
      create: { id: "singleton", instagramAccessToken: envToken, instagramTokenSeed: tail(envToken), instagramTokenRefreshedAt: new Date() },
    });
    return { status: "adopted-env-token" };
  }
  if (row?.instagramTokenRefreshedAt && Date.now() - row.instagramTokenRefreshedAt.getTime() < REFRESH_EVERY_MS) {
    return { status: "fresh" };
  }

  try {
    const url = new URL("https://graph.instagram.com/refresh_access_token");
    url.searchParams.set("grant_type", "ig_refresh_token");
    url.searchParams.set("access_token", row!.instagramAccessToken!);
    const res = await fetch(url, { cache: "no-store" });
    const body: { access_token?: string; error?: { message?: string } } = await res.json();
    if (!res.ok || !body.access_token) throw new Error(body.error?.message ?? `HTTP ${res.status}`);
    await prisma.settings.update({
      where: { id: "singleton" },
      data: { instagramAccessToken: body.access_token, instagramTokenRefreshedAt: new Date() },
    });
    return { status: "refreshed" };
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    console.error(`[instagram] token refresh failed: ${detail}`);
    await alertOwnerOnce(detail).catch((err) => console.error("[instagram] alert e-mail failed", err));
    return { status: "failed", detail };
  }
}

export async function getRecentInstagramPosts(limit = 6): Promise<InstagramPost[]> {
  const token = await getActiveToken();
  const accountId = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;
  if (!token || !accountId) return [];

  try {
    const url = new URL(`https://graph.instagram.com/v21.0/${accountId}/media`);
    url.searchParams.set("fields", "id,caption,media_type,media_url,thumbnail_url,permalink");
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("access_token", token);

    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) {
      console.error(`[instagram] feed request failed: HTTP ${res.status}`);
      return [];
    }

    const data: { data?: GraphMediaItem[] } = await res.json();
    if (!Array.isArray(data.data)) return [];

    return data.data
      .filter((item) => item.media_type !== "VIDEO" || item.thumbnail_url)
      .map((item) => ({
        id: item.id,
        permalink: item.permalink,
        mediaUrl: item.media_type === "VIDEO" ? item.thumbnail_url! : item.media_url,
        caption: item.caption ?? null,
      }));
  } catch {
    return [];
  }
}
