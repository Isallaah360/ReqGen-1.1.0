"use client";

import { useState, type MouseEvent, type ReactNode } from "react";

/**
 * ReqGen v4.4 — small SVG charts for the report pages (mock-ups 59, 61–64).
 * No chart library: plain SVG with the v4-viz styles, a hover tip, and every
 * chart has a table view or legend so the numbers are always readable.
 */

type Tip = { x: number; y: number; text: string } | null;

function useTip() {
  const [tip, setTip] = useState<Tip>(null);
  const on = (text: string) => ({
    onMouseMove: (e: MouseEvent) => setTip({ x: e.clientX + 12, y: e.clientY - 34, text }),
    onMouseLeave: () => setTip(null),
  });
  const node = tip ? <div className="v4-viz-tip" style={{ left: tip.x, top: tip.y }}>{tip.text}</div> : null;
  return { on, node };
}

export const SERIES_COLORS = ["#C2410C", "#2563EB", "#0F9D74", "#A16207", "#7C3AED", "#94A3B8", "#DB2777", "#0891B2"];

/** Vertical bars, one per label; `now` is drawn darker (the month being looked at). */
export function BarChart({ data, now, fmt, label }: { data: Array<{ label: string; value: number }>; now?: number; fmt: (n: number) => string; label: string }) {
  const { on, node } = useTip();
  const W = 1000, H = 250, L = 64, B = 220, T = 14;
  const max = Math.max(1, ...data.map((d) => d.value));
  const step = (W - L) / Math.max(1, data.length);
  const bw = Math.min(48, step * 0.6);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => max * f);
  return (
    <div className="v4-viz v4-vscroll">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} style={{ minWidth: 520 }}>
        <g className="v4-grid">
          {ticks.map((t) => {
            const y = B - ((B - T) * t) / max;
            return <g key={t}><line x1={L} x2={W} y1={y} y2={y} /><text className="v4-ax" x={L - 8} y={y + 4} textAnchor="end">{fmt(t)}</text></g>;
          })}
        </g>
        {data.map((d, i) => {
          const h = ((B - T) * d.value) / max;
          const x = L + step * i + (step - bw) / 2;
          return (
            <g key={d.label + i}>
              <rect className={`v4-bar${i === now ? " v4-now" : ""}`} x={x} y={B - h} width={bw} height={Math.max(h, d.value > 0 ? 2 : 0)} rx={4} {...on(`${d.label}: ${fmt(d.value)}`)} />
              <text className="v4-ax" x={x + bw / 2} y={240} textAnchor="middle">{d.label}</text>
            </g>
          );
        })}
      </svg>
      {node}
    </div>
  );
}

/** Donut with its legend (share and amount). */
export function Donut({ data, fmt, label }: { data: Array<{ label: string; value: number }>; fmt: (n: number) => string; label: string }) {
  const { on, node } = useTip();
  const total = data.reduce((t, d) => t + d.value, 0);
  const R = 74, C = 100;
  const arcs = data.reduce<{ start: number; out: ReactNode[] }>((acc, d, i) => {
    const frac = total > 0 ? d.value / total : 0;
    const a0 = acc.start * 2 * Math.PI - Math.PI / 2;
    const a1 = (acc.start + frac) * 2 * Math.PI - Math.PI / 2 - (frac > 0.002 ? 0.012 : 0);
    const large = frac > 0.5 ? 1 : 0;
    const path = frac >= 0.9999
      ? `M ${C} ${C - R} A ${R} ${R} 0 1 1 ${C - 0.01} ${C - R}`
      : `M ${(C + R * Math.cos(a0)).toFixed(2)} ${(C + R * Math.sin(a0)).toFixed(2)} A ${R} ${R} 0 ${large} 1 ${(C + R * Math.cos(a1)).toFixed(2)} ${(C + R * Math.sin(a1)).toFixed(2)}`;
    if (frac > 0) acc.out.push(<path key={d.label} className="v4-seg" d={path} stroke={SERIES_COLORS[i % SERIES_COLORS.length]} strokeWidth={26} fill="none" {...on(`${d.label}: ${fmt(d.value)} · ${Math.round(frac * 100)}%`)} />);
    return { start: acc.start + frac, out: acc.out };
  }, { start: 0, out: [] }).out;
  return (
    <div className="v4-donutwrap">
      <div className="v4-viz" style={{ width: 200, maxWidth: "100%" }}>
        <svg viewBox="0 0 200 200" role="img" aria-label={label}>
          {total > 0 ? arcs : <circle cx={C} cy={C} r={R} stroke="#E7ECF3" strokeWidth={26} fill="none" />}
          <text className="v4-val" x={C} y={C + 5} textAnchor="middle">{fmt(total)}</text>
        </svg>
        {node}
      </div>
      <ul className="v4-legend">
        {data.map((d, i) => (
          <li key={d.label}><i style={{ background: SERIES_COLORS[i % SERIES_COLORS.length] }} /><span>{d.label}<em>{total > 0 ? Math.round((d.value / total) * 100) : 0}%</em></span><b>{fmt(d.value)}</b></li>
        ))}
      </ul>
    </div>
  );
}

/** Horizontal bars, largest first. */
export function HBars({ data, fmt, color = "#2563EB" }: { data: Array<{ label: string; value: number }>; fmt: (n: number) => string; color?: string }) {
  const { on, node } = useTip();
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <>
      <ul className="v4-hbars">
        {data.map((d) => (
          <li key={d.label}><span title={d.label}>{d.label}</span><span className="v4-htrack"><i style={{ width: `${((d.value / max) * 100).toFixed(1)}%`, background: color }} {...on(`${d.label}: ${fmt(d.value)}`)} /></span><b>{fmt(d.value)}</b></li>
        ))}
      </ul>
      {node}
    </>
  );
}

/** Budget used against where we should be by now. */
export function Pace({ used, expected }: { used: number; expected: number }) {
  return (
    <>
      <div className="v4-pace" title={`Used ${used}% · expected ${expected}%`}><i style={{ width: `${Math.min(100, used)}%` }} /><b style={{ left: `${Math.min(100, expected)}%` }} /></div>
      <div className="v4-pace-l"><span>0%</span><span>Black line = where we should be ({expected}%)</span><span>100%</span></div>
    </>
  );
}
