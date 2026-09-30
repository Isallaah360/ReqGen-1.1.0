"use client";

import { useState } from "react";

/**
 * Canonical ReqGen donut chart — v3.0.3 interactive standard.
 *
 * Drawn entirely as native SVG (ring, centre hole and centre text share one
 * coordinate space), so it always renders as a true circle at any zoom.
 *
 * Interaction:
 *  - HOVER (or keyboard focus) a slice: it thickens, the others fade, and the
 *    centre shows that slice's value, label and share of the total.
 *  - CLICK (or Enter/Space) a slice: it becomes the selected slice. Pages pass
 *    `onSegmentSelect` to filter their data to that slice; clicking it again,
 *    or the centre, clears the selection.
 *  - `onSelect(detail)` is still called with a readable sentence for pages
 *    that show a "Selected data" note.
 */
export type DonutSegment = { label: string; value: number; color: string };

export function Donut({
  segments,
  size = 116,
  strokeWidth = 22,
  centerLabel = "Total",
  formatTotal,
  formatValue,
  formatAmount,
  onSelect,
  onSegmentSelect,
  selected,
  fluidMax,
}: {
  segments: DonutSegment[];
  size?: number;
  strokeWidth?: number;
  centerLabel?: string;
  formatTotal?: (total: number) => string;
  formatValue?: (value: number, label: string) => string;
  /** Formats a single number for the centre (e.g. naira). */
  formatAmount?: (value: number) => string;
  onSelect?: (detail: string) => void;
  /** Called with the selected slice label, or null when the selection is cleared. */
  onSegmentSelect?: (label: string | null) => void;
  /** Controlled selection (a segment label). Omit to let the chart manage it. */
  selected?: string | null;
  /** When set, the chart scales to fill its card up to this many pixels wide. */
  fluidMax?: number;
}) {
  const [hovered, setHovered] = useState<string | null>(null);
  const [ownSelection, setOwnSelection] = useState<string | null>(null);
  const active = selected !== undefined ? selected : ownSelection;

  const total = segments.reduce((sum, s) => sum + s.value, 0);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;
  const fmt = formatValue || ((v: number, label: string) => `${label}: ${v.toLocaleString()}`);
  const interactive = Boolean(onSelect || onSegmentSelect);

  const focusLabel = hovered || active;
  const focusSegment = focusLabel ? segments.find((s) => s.label === focusLabel) : undefined;
  const pct = (v: number) => (total > 0 ? Math.round((v / total) * 100) : 0);

  const amount = (v: number) => (formatAmount ? formatAmount(v) : v.toLocaleString());
  const bigText = focusSegment ? amount(focusSegment.value) : formatTotal ? formatTotal(total) : amount(total);
  const smallText = focusSegment ? `${focusSegment.label} · ${pct(focusSegment.value)}%` : centerLabel;
  const bigFont = Math.round(size * (bigText.length > 5 ? 0.13 : 0.19));
  const smallFont = Math.max(9, Math.round(size * (smallText.length > 16 ? 0.062 : 0.078)));

  function choose(label: string | null) {
    const next = label && label === active ? null : label;
    if (selected === undefined) setOwnSelection(next);
    onSegmentSelect?.(next);
    if (onSelect) {
      if (next) {
        const seg = segments.find((s) => s.label === next);
        if (seg) onSelect(`${fmt(seg.value, seg.label)} (${pct(seg.value)}% of ${total.toLocaleString()})`);
      } else {
        onSelect(segments.map((s) => fmt(s.value, s.label)).join(" · "));
      }
    }
  }

  let offset = 0;

  return (
    <svg
      width={fluidMax ? undefined : size}
      height={fluidMax ? undefined : size}
      viewBox={`0 0 ${size} ${size}`}
      role="group"
      aria-label={`Donut chart. Total ${total.toLocaleString()}. ${segments.map((s) => `${s.label} ${s.value}`).join(", ")}.`}
      className="rg-donut"
      style={
        fluidMax
          ? { display: "block", flexShrink: 0, width: `min(100%, ${fluidMax}px)`, height: "auto", aspectRatio: "1 / 1", overflow: "visible" }
          : { display: "block", flexShrink: 0, overflow: "visible" }
      }
      onMouseLeave={() => setHovered(null)}
    >
      <g transform={`rotate(-90 ${center} ${center})`}>
        <circle cx={center} cy={center} r={radius} fill="none" stroke="var(--rg-chart-track, #edf2f7)" strokeWidth={strokeWidth} />
        {total > 0
          ? segments.map((s) => {
              if (s.value <= 0) return null;
              const length = (s.value / total) * circumference;
              const dashOffset = -offset;
              offset += length;
              const isFocus = focusLabel === s.label;
              const dimmed = Boolean(focusLabel) && !isFocus;
              return (
                <circle
                  key={s.label}
                  cx={center}
                  cy={center}
                  r={radius}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={isFocus ? strokeWidth + Math.max(4, strokeWidth * 0.22) : strokeWidth}
                  pathLength={circumference}
                  strokeDasharray={`${length} ${circumference - length}`}
                  strokeDashoffset={dashOffset}
                  opacity={dimmed ? 0.32 : 1}
                  className="rg-donut-slice"
                  tabIndex={interactive ? 0 : -1}
                  role={interactive ? "button" : undefined}
                  aria-pressed={interactive ? active === s.label : undefined}
                  aria-label={`${s.label}: ${s.value.toLocaleString()} (${pct(s.value)}%)`}
                  style={{ cursor: interactive ? "pointer" : "default", transition: "opacity .15s ease, stroke-width .15s ease", outline: "none" }}
                  onMouseEnter={() => setHovered(s.label)}
                  onFocus={() => setHovered(s.label)}
                  onBlur={() => setHovered(null)}
                  onClick={interactive ? () => choose(s.label) : undefined}
                  onKeyDown={interactive ? (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); choose(s.label); } } : undefined}
                >
                  <title>{`${s.label}: ${s.value.toLocaleString()} (${pct(s.value)}%)`}</title>
                </circle>
              );
            })
          : null}
      </g>

      <circle
        cx={center}
        cy={center}
        r={Math.max(radius - strokeWidth / 2 - 2, 4)}
        fill="var(--rg-surface, #fff)"
        stroke="var(--rg-line-soft, #eef2f6)"
        strokeWidth={1}
        style={{ cursor: interactive && active ? "pointer" : "default" }}
        onClick={interactive && active ? () => choose(null) : undefined}
      >
        {interactive && active ? <title>Clear selection</title> : null}
      </circle>
      <text x={center} y={center - smallFont * 0.45} textAnchor="middle" dominantBaseline="central" fontSize={bigFont} fontWeight={900}
        fill={focusSegment ? focusSegment.color : "var(--rg-text-strong, #11244a)"} style={{ pointerEvents: "none", userSelect: "none" }}>
        {bigText}
      </text>
      <text x={center} y={center + smallFont * 1.35} textAnchor="middle" dominantBaseline="central" fontSize={smallFont} fontWeight={700}
        fill="var(--rg-text-muted, #7b8797)" style={{ pointerEvents: "none", userSelect: "none" }}>
        {smallText}
      </text>
    </svg>
  );
}
