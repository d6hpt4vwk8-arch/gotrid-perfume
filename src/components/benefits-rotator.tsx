"use client";

import { useEffect, useRef, useState } from "react";

const ROTATE_INTERVAL_MS = 3200;
const FADE_MS = 300;

export function BenefitsRotator({ items }: { items: string[] }) {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (items.length <= 1) return;

    const interval = setInterval(() => {
      setVisible(false);
      timeoutRef.current = setTimeout(() => {
        setIndex((i) => (i + 1) % items.length);
        setVisible(true);
      }, FADE_MS);
    }, ROTATE_INTERVAL_MS);

    return () => {
      clearInterval(interval);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [items.length]);

  return (
    <p
      aria-live="polite"
      className={`text-center text-[11px] font-medium tracking-wide text-white/70 transition-opacity duration-300 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
    >
      {items[index]}
    </p>
  );
}
