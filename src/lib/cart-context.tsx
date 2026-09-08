"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { formatPrice } from "@/lib/format";

export interface CartItem {
  productId: string;
  slug: string;
  name: string;
  price: number;
  image: string | null;
  qty: number;
  stock: number;
}

interface CartContextValue {
  items: CartItem[];
  addItem: (item: Omit<CartItem, "qty">, qty?: number) => void;
  removeItem: (productId: string) => void;
  setQty: (productId: string, qty: number) => void;
  clear: () => void;
  itemCount: number;
  total: number;
  toast: string | null;
  freeShippingThreshold: number;
  /**
   * Coupon code and free-gift choice live here (not in the checkout form) so
   * both can be picked already in the cart and survive the trip to
   * /pokladna. Only the identifiers are kept — the discount amount and the
   * gift's eligibility are always re-validated server-side at order time.
   */
  couponCode: string | null;
  setCouponCode: (code: string | null) => void;
  giftProductId: string | null;
  setGiftProductId: (productId: string | null) => void;
}

const STORAGE_KEY = "gotrid-cart";
const COUPON_STORAGE_KEY = "gotrid-cart-coupon";
const GIFT_STORAGE_KEY = "gotrid-cart-gift";

const CartContext = createContext<CartContextValue | null>(null);

function readStoredCart(): CartItem[] {
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

export function CartProvider({
  children,
  freeShippingThreshold,
}: {
  children: ReactNode;
  freeShippingThreshold: number;
}) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [couponCode, setCouponCode] = useState<string | null>(null);
  const [giftProductId, setGiftProductId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const totalRef = useRef(0);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setItems(readStoredCart());
    setCouponCode(window.localStorage.getItem(COUPON_STORAGE_KEY));
    setGiftProductId(window.localStorage.getItem(GIFT_STORAGE_KEY));
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    for (const [key, value] of [
      [COUPON_STORAGE_KEY, couponCode],
      [GIFT_STORAGE_KEY, giftProductId],
    ] as const) {
      if (value) window.localStorage.setItem(key, value);
      else window.localStorage.removeItem(key);
    }
  }, [couponCode, giftProductId, hydrated]);

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, []);

  const addItem = useCallback(
    (item: Omit<CartItem, "qty">, qty = 1) => {
      setItems((prev) => {
        const existing = prev.find((i) => i.productId === item.productId);
        if (existing) {
          return prev.map((i) =>
            i.productId === item.productId
              ? { ...i, qty: Math.min(i.qty + qty, i.stock || i.qty + qty) }
              : i,
          );
        }
        return [...prev, { ...item, qty: Math.min(qty, item.stock || qty) }];
      });

      const newTotal = totalRef.current + item.price * qty;
      const remaining = freeShippingThreshold - newTotal;
      const message =
        remaining > 0
          ? `Ještě ${formatPrice(remaining)} do dopravy zdarma`
          : "Máte nárok na dopravu zdarma! 🎉";

      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
      setToast(message);
      toastTimeoutRef.current = setTimeout(() => setToast(null), 3500);
    },
    [freeShippingThreshold],
  );

  const removeItem = useCallback((productId: string) => {
    setItems((prev) => prev.filter((i) => i.productId !== productId));
  }, []);

  const setQty = useCallback((productId: string, qty: number) => {
    setItems((prev) =>
      prev
        .map((i) => (i.productId === productId ? { ...i, qty } : i))
        .filter((i) => i.qty > 0),
    );
  }, []);

  const clear = useCallback(() => {
    setItems([]);
    setCouponCode(null);
    setGiftProductId(null);
  }, []);

  const { itemCount, total } = useMemo(
    () => ({
      itemCount: items.reduce((sum, i) => sum + i.qty, 0),
      total: items.reduce((sum, i) => sum + i.qty * i.price, 0),
    }),
    [items],
  );

  useEffect(() => {
    totalRef.current = total;
  }, [total]);

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        setQty,
        clear,
        itemCount,
        total,
        toast,
        freeShippingThreshold,
        couponCode,
        setCouponCode,
        giftProductId,
        setGiftProductId,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
