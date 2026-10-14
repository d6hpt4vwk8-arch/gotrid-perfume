"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export interface WishlistItem {
  productId: string;
  slug: string;
  name: string;
  price: number;
  image: string | null;
}

interface WishlistContextValue {
  items: WishlistItem[];
  isWishlisted: (productId: string) => boolean;
  toggle: (item: WishlistItem) => void;
  remove: (productId: string) => void;
  count: number;
}

const STORAGE_KEY = "gotrid-wishlist";

const WishlistContext = createContext<WishlistContextValue | null>(null);

function readStoredWishlist(): WishlistItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// For a logged-in customer the server copy (WishlistItem) is the source of
// truth across devices; localStorage stays the instant working copy. On load
// the two are merged, and every toggle is mirrored to the server.
function syncToServer(productId: string, on: boolean) {
  fetch("/api/customer/wishlist", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ productId, on }),
  }).catch(() => {
    // Best-effort — the local list is still correct, the next load re-merges.
  });
}

export function WishlistProvider({ children, loggedIn = false }: { children: ReactNode; loggedIn?: boolean }) {
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setItems(readStoredWishlist());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items, hydrated]);

  // Logged in: push the browser's favourites to the account and pull back
  // what the account already has (items hearted on another device).
  useEffect(() => {
    if (!hydrated || !loggedIn) return;
    let cancelled = false;
    (async () => {
      try {
        const local = readStoredWishlist();
        const res = await fetch("/api/customer/wishlist", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productIds: local.map((i) => i.productId) }),
        });
        if (!res.ok) return;
        const { productIds } = (await res.json()) as { productIds: string[] };
        const known = new Set(local.map((i) => i.productId));
        const missing = productIds.filter((id) => !known.has(id));
        let fetched: WishlistItem[] = [];
        if (missing.length > 0) {
          const r = await fetch(`/api/products/by-ids?ids=${encodeURIComponent(missing.join(","))}`);
          const data = (await r.json()) as {
            products: { id: string; slug: string; name: string; price: number; images: { url: string }[] }[];
          };
          fetched = data.products.map((p) => ({
            productId: p.id,
            slug: p.slug,
            name: p.name,
            price: Number(p.price),
            image: p.images[0]?.url ?? null,
          }));
        }
        if (!cancelled && fetched.length > 0) {
          setItems((prev) => [...prev, ...fetched.filter((f) => !prev.some((i) => i.productId === f.productId))]);
        }
      } catch {
        // Offline or logged out meanwhile — keep the local list as it is.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hydrated, loggedIn]);

  const isWishlisted = useCallback(
    (productId: string) => items.some((i) => i.productId === productId),
    [items],
  );

  const toggle = useCallback(
    (item: WishlistItem) => {
      const wasOn = items.some((i) => i.productId === item.productId);
      setItems((prev) =>
        prev.some((i) => i.productId === item.productId)
          ? prev.filter((i) => i.productId !== item.productId)
          : [...prev, item],
      );
      if (loggedIn) syncToServer(item.productId, !wasOn);
    },
    [items, loggedIn],
  );

  const remove = useCallback(
    (productId: string) => {
      setItems((prev) => prev.filter((i) => i.productId !== productId));
      if (loggedIn) syncToServer(productId, false);
    },
    [loggedIn],
  );

  return (
    <WishlistContext.Provider
      value={{ items, isWishlisted, toggle, remove, count: items.length }}
    >
      {children}
    </WishlistContext.Provider>
  );
}

export function useWishlist(): WishlistContextValue {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error("useWishlist must be used within WishlistProvider");
  return ctx;
}
