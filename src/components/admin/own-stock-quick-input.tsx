"use client";

import { useState, useTransition } from "react";
import { updateOwnStock } from "@/lib/admin/actions/products";

// Inline editor for a physical recount — saves on blur/Enter rather than a
// separate button, since walking the warehouse typing numbers one after
// another is the whole point (see vlastni-sklad/page.tsx).
export function OwnStockQuickInput({
  productId,
  initialValue,
}: {
  productId: string;
  initialValue: number;
}) {
  const [value, setValue] = useState(String(initialValue));
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function save() {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed === initialValue) {
      setValue(String(initialValue));
      return;
    }
    startTransition(async () => {
      await updateOwnStock(productId, parsed);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    });
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <input
        type="number"
        min={0}
        step={1}
        value={value}
        disabled={isPending}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.currentTarget.blur();
          }
        }}
        className="w-20 rounded-sm border border-line px-2 py-1 text-sm font-semibold disabled:opacity-50"
      />
      ks
      {saved && <span className="text-xs text-ok">uloženo</span>}
    </span>
  );
}
