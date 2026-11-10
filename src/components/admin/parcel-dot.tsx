import type { ParcelIndicator, ParcelTone } from "@/lib/orders/parcel-indicator";

export const PARCEL_DOT_CLASS: Record<ParcelTone, string> = {
  red: "bg-red-600",
  amber: "bg-amber-400",
  slate: "bg-slate-400",
  green: "bg-emerald-500",
  muted: "bg-stone-300",
};

const PARCEL_TEXT_CLASS: Record<ParcelTone, string> = {
  red: "font-semibold text-red-700",
  amber: "text-amber-800",
  slate: "text-slate-700",
  green: "text-emerald-800",
  muted: "text-accent-2",
};

export function ParcelDot({ tone, className = "" }: { tone: ParcelTone; className?: string }) {
  return <span aria-hidden className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${PARCEL_DOT_CLASS[tone]} ${className}`} />;
}

/** Coloured dot + stage icon + short label; the title attribute carries the longer explanation. */
export function ParcelIndicatorBadge({ indicator }: { indicator: ParcelIndicator | null }) {
  if (!indicator) return <span className="text-xs text-accent-2">—</span>;
  return (
    <span title={indicator.hint} className={`inline-flex items-center gap-1.5 whitespace-nowrap text-xs ${PARCEL_TEXT_CLASS[indicator.tone]}`}>
      <ParcelDot tone={indicator.tone} />
      <span aria-hidden>{indicator.icon}</span>
      {indicator.label}
      {indicator.urgent && <span aria-label="Řešit hned">❗</span>}
    </span>
  );
}
