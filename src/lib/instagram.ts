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
export async function getRecentInstagramPosts(limit = 6): Promise<InstagramPost[]> {
  const token = process.env.INSTAGRAM_ACCESS_TOKEN;
  const accountId = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;
  if (!token || !accountId) return [];

  try {
    const url = new URL(`https://graph.instagram.com/v21.0/${accountId}/media`);
    url.searchParams.set("fields", "id,caption,media_type,media_url,thumbnail_url,permalink");
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("access_token", token);

    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return [];

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
