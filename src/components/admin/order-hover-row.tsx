"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export interface OrderPreviewData {
  number: string;
  customer: string;
  items: { name: string; qty: number; isGift: boolean }[];
  shipping: string;
  payment: string;
  total: string;
  note: string | null;
  tracking: string | null;
}

const SHOW_DELAY_MS = 150;
const OFFSET = 16;

// A table row that shows what is in the order next to the cursor while it is hovered — so a pile of parcels can
// be matched to orders without opening each one. The popup is portalled and position: fixed because the table
// sits in an overflow-x-auto box that would clip it, and it ignores the pointer so it never blocks the status
// dropdown underneath.
export function OrderHoverRow({ preview, children, className }: { preview: OrderPreviewData; children: ReactNode; className?: string }) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [visible, setVisible] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const popup = useRef<HTMLDivElement>(null);

  const place = useCallback((x: number, y: number) => {
    const el = popup.current;
    const w = el?.offsetWidth ?? 320;
    const h = el?.offsetHeight ?? 200;
    setPos({
      x: Math.max(8, Math.min(x + OFFSET, window.innerWidth - w - 8)),
      y: Math.max(8, Math.min(y + OFFSET, window.innerHeight - h - 8)),
    });
  }, []);

  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  return (
    <>
      <tr
        className={className}
        onMouseEnter={(e) => {
          const { clientX, clientY } = e;
          timer.current = setTimeout(() => {
            place(clientX, clientY);
            setVisible(true);
          }, SHOW_DELAY_MS);
        }}
        onMouseMove={(e) => visible && place(e.clientX, e.clientY)}
        onMouseLeave={() => {
          if (timer.current) clearTimeout(timer.current);
          setVisible(false);
        }}
      >
        {children}
      </tr>
      {visible &&
        pos &&
        createPortal(
          <div
            ref={popup}
            style={{ left: pos.x, top: pos.y }}
            className="pointer-events-none fixed z-50 w-80 rounded-sm border border-line bg-white p-3 text-sm shadow-lg"
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-semibold text-ink">{preview.number}</span>
              <span className="truncate text-xs text-accent-2">{preview.customer}</span>
            </div>
            <ul className="mt-2 flex flex-col gap-1">
              {preview.items.map((item, i) => (
                <li key={i} className="flex gap-2">
                  <span className="w-8 shrink-0 text-right font-semibold tabular-nums">{item.qty}×</span>
                  <span className="min-w-0">
                    {item.name}
                    {item.isGift && <span className="ml-1 text-xs text-accent-2">🎁 dárek</span>}
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-2 border-t border-line pt-2 text-xs text-accent-2">
              {preview.shipping} · {preview.payment} · {preview.total}
              {preview.tracking && <div>Zásilka: {preview.tracking}</div>}
            </div>
            {preview.note && <div className="mt-2 rounded-sm bg-amber-50 p-2 text-xs text-amber-900">📝 {preview.note}</div>}
          </div>,
          document.body,
        )}
    </>
  );
}
