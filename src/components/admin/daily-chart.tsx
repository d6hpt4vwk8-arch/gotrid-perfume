import type { DayPoint } from "@/lib/admin-stats.server";

export type ChartMetric = "profit" | "revenue" | "orders";

const PAD = { l: 44, r: 6, t: 12, b: 26 };

function valueOf(p: DayPoint, metric: ChartMetric): number {
  return metric === "orders" ? p.orders : metric === "revenue" ? p.revenue : p.profit;
}

/** 1 / 2 / 5 × 10ⁿ step that gives roughly `parts` gridlines over `range`. */
function niceStep(range: number, parts: number): number {
  const raw = Math.max(range, 1) / parts;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const n = raw / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * pow;
}

function shortNumber(v: number, metric: ChartMetric): string {
  if (metric === "orders") return String(Math.round(v));
  const abs = Math.abs(v);
  if (abs >= 1000) return `${(v / 1000).toLocaleString("cs-CZ", { maximumFractionDigits: 1 })} k`;
  return String(Math.round(v));
}

/**
 * Daily bars for the current period with the previous period drawn as a thin line behind them (aligned by day index).
 * Server-rendered SVG — hover a bar for the exact day (native <title> tooltip).
 */
export function DailyChart(props: { current: DayPoint[]; previous: DayPoint[]; metric: ChartMetric }) {
  // Two drawings instead of one scaled down: an SVG squeezed to phone width would shrink its labels to ~5 px.
  return (
    <>
      <div className="hidden sm:block">
        <Chart {...props} W={760} H={250} />
      </div>
      <div className="sm:hidden">
        <Chart {...props} W={340} H={230} />
      </div>
    </>
  );
}

function Chart({
  current,
  previous,
  metric,
  W,
  H,
}: {
  current: DayPoint[];
  previous: DayPoint[];
  metric: ChartMetric;
  W: number;
  H: number;
}) {
  const cur = current.map((p) => valueOf(p, metric));
  const prev = previous.map((p) => valueOf(p, metric));
  const all = [...cur, ...prev];
  const dataMax = Math.max(0, ...all);
  const dataMin = Math.min(0, ...all);
  const step = niceStep(dataMax - dataMin, 4);
  const top = Math.ceil(dataMax / step) * step || step;
  const bottom = Math.floor(dataMin / step) * step;
  const innerW = W - PAD.l - PAD.r;
  const innerH = H - PAD.t - PAD.b;
  const y = (v: number) => PAD.t + innerH - ((v - bottom) / (top - bottom)) * innerH;
  const slot = innerW / current.length;
  const barW = Math.max(2, slot * 0.68);
  const x = (i: number) => PAD.l + i * slot + (slot - barW) / 2;
  const zeroY = y(0);
  const bestValue = Math.max(...cur);
  const ticks = Array.from({ length: Math.round((top - bottom) / step) + 1 }, (_, i) => bottom + i * step);
  const wide = W > 500;
  const labelEvery = current.length > 45 ? (wide ? 14 : 30) : current.length > 20 ? (wide ? 5 : 10) : wide ? 2 : 4;

  const linePath = prev
    .map((v, i) => `${i === 0 ? "M" : "L"}${(PAD.l + i * slot + slot / 2).toFixed(1)},${y(v).toFixed(1)}`)
    .join(" ");

  const fmtDay = (ymd: string) => {
    const [, m, d] = ymd.split("-");
    return `${Number(d)}. ${Number(m)}.`;
  };
  const fmtValue = (p: DayPoint) =>
    metric === "orders"
      ? `${p.orders} obj.`
      : `${Math.round(valueOf(p, metric)).toLocaleString("cs-CZ")} Kč`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Denní graf">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} className="stroke-line" strokeWidth={1} />
          <text x={PAD.l - 6} y={y(t) + 4} textAnchor="end" className="fill-accent-2" fontSize={11}>
            {shortNumber(t, metric)}
          </text>
        </g>
      ))}
      {bottom < 0 && <line x1={PAD.l} x2={W - PAD.r} y1={zeroY} y2={zeroY} className="stroke-accent-2" strokeWidth={1} />}

      {cur.map((v, i) => {
        const isBest = v === bestValue && v > 0;
        const barTop = Math.min(y(v), zeroY);
        const h = Math.max(Math.abs(y(v) - zeroY), v === 0 ? 0 : 1);
        return (
          <g key={current[i].day}>
            <rect
              x={x(i)}
              y={barTop}
              width={barW}
              height={h}
              rx={1.5}
              className={v < 0 ? "fill-red-500" : isBest ? "fill-ink" : "fill-accent-2/70"}
            >
              <title>{`${fmtDay(current[i].day)} — ${fmtValue(current[i])} · ${current[i].orders} obj.`}</title>
            </rect>
            {/* wider invisible hit area so thin bars are easy to hover */}
            <rect x={PAD.l + i * slot} y={PAD.t} width={slot} height={innerH} fill="transparent">
              <title>{`${fmtDay(current[i].day)} — ${fmtValue(current[i])} · ${current[i].orders} obj.`}</title>
            </rect>
          </g>
        );
      })}

      <path d={linePath} fill="none" className="stroke-ink" strokeWidth={1.5} strokeDasharray="4 3" opacity={0.8} />

      {current.map((p, i) =>
        i % labelEvery === 0 ? (
          <text key={p.day} x={PAD.l + i * slot + slot / 2} y={H - 8} textAnchor="middle" className="fill-accent-2" fontSize={11}>
            {fmtDay(p.day)}
          </text>
        ) : null,
      )}
    </svg>
  );
}
