/**
 * Validates a post-login `?next=` redirect target before handing it to
 * router.push(). Next.js's client router falls back to a raw browser
 * navigation for anything it can't resolve as an internal RSC route —
 * which means an attacker-supplied `javascript:` URI gets evaluated in the
 * site's own origin (confirmed: `?next=javascript:...` executes on submit).
 * Restricting to same-origin relative paths (single leading slash, no
 * scheme, no protocol-relative `//host`) closes that off entirely.
 */
export function getSafeRedirectPath(path: string | null, fallback: string): string {
  if (!path) return fallback;
  if (!path.startsWith("/") || path.startsWith("//")) return fallback;
  return path;
}
