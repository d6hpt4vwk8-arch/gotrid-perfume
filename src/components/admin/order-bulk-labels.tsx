"use client";

import { useEffect, useState } from "react";

const SELECTOR = "input[data-order-select]";

function checkboxes(): HTMLInputElement[] {
  return [...document.querySelectorAll<HTMLInputElement>(SELECTOR)];
}

// The row checkboxes are plain inputs rendered by the server page (data-order-select) — this bar only reads
// them, so the table itself stays a server component. Printing is a real form POST into a new tab, the same
// way the single-order label links open, so the browser's own PDF viewer shows the merged result.
export function OrderBulkLabels() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const update = () => setCount(checkboxes().filter((c) => c.checked).length);
    document.addEventListener("change", update);
    return () => document.removeEventListener("change", update);
  }, []);

  function setAll(checked: boolean) {
    for (const c of checkboxes()) c.checked = checked;
    setCount(checked ? checkboxes().length : 0);
  }

  function print() {
    const ids = checkboxes()
      .filter((c) => c.checked)
      .map((c) => c.value);
    if (ids.length === 0) return;
    const form = document.createElement("form");
    form.method = "POST";
    form.action = "/api/admin/orders/labels";
    form.target = "_blank";
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = "ids";
    input.value = ids.join(",");
    form.appendChild(input);
    document.body.appendChild(form);
    form.submit();
    form.remove();
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <button
        type="button"
        onClick={print}
        disabled={count === 0}
        className="rounded-sm bg-ink px-4 py-2 font-medium text-white hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
      >
        Vytisknout štítky{count > 0 ? ` (${count})` : ""}
      </button>
      <button type="button" onClick={() => setAll(true)} className="rounded-sm border border-line px-3 py-2 hover:border-accent-2">
        Vybrat vše na stránce
      </button>
      {count > 0 && (
        <button type="button" onClick={() => setAll(false)} className="rounded-sm border border-line px-3 py-2 hover:border-accent-2">
          Zrušit výběr
        </button>
      )}
      <span className="text-xs text-accent-2">Štítky všech vybraných objednávek (Zásilkovna, GLS, Balíkovna) se otevřou v jednom PDF.</span>
    </div>
  );
}
