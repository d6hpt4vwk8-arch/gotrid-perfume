"use client";

import { useRef, useState } from "react";
import Image from "next/image";

interface GalleryImage {
  id: string;
  url: string;
}

const SWIPE_THRESHOLD_PX = 40;

export function ProductGallery({ images, alt }: { images: GalleryImage[]; alt: string }) {
  const [index, setIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);

  if (images.length === 0) {
    return (
      <div className="relative aspect-square w-full overflow-hidden bg-line/60">
        <div className="flex h-full items-center justify-center text-sm text-accent-2">
          Bez obrázku
        </div>
      </div>
    );
  }

  const current = images[index];

  function goTo(next: number) {
    setIndex(((next % images.length) + images.length) % images.length);
  }

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return;
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    if (delta > SWIPE_THRESHOLD_PX) goTo(index - 1);
    else if (delta < -SWIPE_THRESHOLD_PX) goTo(index + 1);
    touchStartX.current = null;
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        className="relative aspect-square w-full touch-pan-y select-none overflow-hidden bg-line/60"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <Image
          src={current.url}
          alt={alt}
          fill
          sizes="(min-width: 768px) 50vw, 100vw"
          className="object-cover"
          priority
        />
        {images.length > 1 && (
          <>
            <button
              type="button"
              aria-label="Předchozí obrázek"
              onClick={() => goTo(index - 1)}
              className="absolute left-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-lg text-ink hover:bg-white"
            >
              ‹
            </button>
            <button
              type="button"
              aria-label="Další obrázek"
              onClick={() => goTo(index + 1)}
              className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-lg text-ink hover:bg-white"
            >
              ›
            </button>
            <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1.5">
              {images.map((image, i) => (
                <span
                  key={image.id}
                  className={`h-1.5 w-1.5 rounded-full ${i === index ? "bg-ink" : "bg-white/80"}`}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {images.length > 1 && (
        <div className="grid grid-cols-4 gap-2">
          {images.map((image, i) => (
            <button
              key={image.id}
              type="button"
              aria-label={`Zobrazit obrázek ${i + 1}`}
              onClick={() => goTo(i)}
              className={`relative aspect-square overflow-hidden bg-line/60 ${
                i === index ? "ring-2 ring-ink" : "opacity-70 hover:opacity-100"
              }`}
            >
              <Image src={image.url} alt={alt} fill sizes="12vw" className="object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
