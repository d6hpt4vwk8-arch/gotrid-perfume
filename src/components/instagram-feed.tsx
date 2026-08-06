import { getRecentInstagramPosts } from "@/lib/instagram";

const INSTAGRAM_URL = "https://www.instagram.com/gotrid_perfume/";

/**
 * Full-width "latest posts" strip for the bottom of the footer. Renders
 * nothing until INSTAGRAM_ACCESS_TOKEN/INSTAGRAM_BUSINESS_ACCOUNT_ID are
 * configured (see .env.example) — the plain Instagram link already lives in
 * SocialLinks, so there's nothing to fall back to here.
 */
export async function InstagramFeed() {
  const posts = await getRecentInstagramPosts(6);
  if (posts.length === 0) return null;

  return (
    <div className="border-t border-white/10 px-4 py-6">
      <div className="mx-auto max-w-6xl">
        <a
          href={INSTAGRAM_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-semibold text-white hover:text-white/80"
        >
          Poslední z Instagramu
        </a>
        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
          {posts.map((post) => (
            <a
              key={post.id}
              href={post.permalink}
              target="_blank"
              rel="noopener noreferrer"
              className="block aspect-square overflow-hidden rounded-sm bg-white/10"
            >
              {/* External Instagram CDN host rotates unpredictably, so a plain
                  <img> is used instead of next/image (which would need a
                  broad remotePatterns wildcard for a handful of tiny thumbs). */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={post.mediaUrl}
                alt={post.caption?.slice(0, 80) || "Instagram příspěvek Gotrid Perfume"}
                className="h-full w-full object-cover transition hover:opacity-80"
              />
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
