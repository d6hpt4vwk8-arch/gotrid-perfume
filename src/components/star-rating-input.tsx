"use client";

import { useState } from "react";

export function StarRatingInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const display = hovered ?? value;

  return (
    <div role="radiogroup" aria-label="Hodnocení" className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} ${n === 1 ? "hvězda" : n < 5 ? "hvězdy" : "hvězd"}`}
          onClick={() => onChange(n)}
          onMouseEnter={() => setHovered(n)}
          onMouseLeave={() => setHovered(null)}
          className="text-2xl leading-none"
        >
          <span className={n <= display ? "text-accent" : "text-line"}>★</span>
        </button>
      ))}
    </div>
  );
}
