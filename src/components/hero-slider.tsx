"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

const AUTO_ADVANCE_MS = 6000;

/**
 * Carousel wrapper for the homepage hero — slide content itself is built
 * server-side (product images, coupon data, …) and passed in as ready JSX;
 * this component only owns which slide is showing, the autoplay timer, and
 * the arrow/dot controls. Autoplay pauses on hover/focus so it doesn't yank
 * the slide out from under someone reading it.
 */
export function HeroSlider({ slides }: { slides: ReactNode[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = slides.length;
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    if (count <= 1 || paused) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % count), AUTO_ADVANCE_MS);
    return () => clearInterval(timer);
  }, [count, paused]);

  if (count === 0) return null;

  const goTo = (i: number) => setIndex((i + count) % count);

  return (
    <div
      className="relative"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onTouchStart={(e) => {
        touchStartX.current = e.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(e) => {
        if (touchStartX.current === null) return;
        const delta = e.changedTouches[0]!.clientX - touchStartX.current;
        if (delta > 40) goTo(index - 1);
        else if (delta < -40) goTo(index + 1);
        touchStartX.current = null;
      }}
    >
      <div className="overflow-hidden rounded-sm">
        <div
          className="flex transition-transform duration-500 ease-out"
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {slides.map((slide, i) => (
            <div key={i} className="w-full shrink-0">
              {slide}
            </div>
          ))}
        </div>
      </div>

      {count > 1 && (
        <>
          <button
            type="button"
            onClick={() => goTo(index - 1)}
            aria-label="Předchozí"
            className="absolute top-1/2 left-2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur transition hover:bg-black/50 sm:left-4"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => goTo(index + 1)}
            aria-label="Další"
            className="absolute top-1/2 right-2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur transition hover:bg-black/50 sm:right-4"
          >
            ›
          </button>
          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
            {slides.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => goTo(i)}
                aria-label={`Snímek ${i + 1}`}
                className={`h-1.5 rounded-full transition-all ${
                  i === index ? "w-5 bg-white" : "w-1.5 bg-white/40 hover:bg-white/60"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
