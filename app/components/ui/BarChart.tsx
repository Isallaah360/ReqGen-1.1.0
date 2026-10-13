"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Canonical ReqGen bar chart — v3.0.3 interactive standard.
 *
 *  - Renders at the real pixel width of its card (ResizeObserver), so bars,
 *    labels and gridlines stay crisp and readable from phone to desktop.
 *  - HOVER / keyboard focus: the bar highlights and a tooltip shows its exact
 *    value (and optional sub-text).
 *  - CLICK / Enter / Space: selects the bar; pages pass `onBarSelect` to filter
 *    their data to it. Clicking the selected bar again clears the selection.
 */
export type BarDatum = { key: string; label: string; value: number; hint?: string };

/** Whole-number axis: 4 equal steps of 1, 2, 5, 10, 20, 25, 50… so ticks are never fractional. */
function niceScale(max: number) {
  const raw = Math.max(1, max) / 4;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / pow;
  const step = Math.max(1, (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * pow);
  const wholeStep = Math.ceil(step);
  return { max: wholeStep * 4, step: wholeStep };
}

export function BarChart({
  data,
  height = 240,
  color = "var(--rg-chart-1, #0b5cf0)",
  selectedColor = "var(--rg-chart-accent, #083fa8)",
  formatValue = (v: number) => v.toLocaleString(),
  valueNoun = "",
  selected,
  onBarSelect,
  ariaLabel,
}: {
  data: BarDatum[];
  height?: number;
  color?: string;
  selectedColor?: string;
  formatValue?: (value: number) => string;
  /** e.g. "requests" → tooltip "5 requests". */
  valueNoun?: string;
  selected?: string | null;
  onBarSelect?: (key: string | null) => void;
  ariaLabel: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [hovered, setHovered] = useState<string | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => setWidth(Math.max(260, Math.floor(el.clientWidth)));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const compact = width < 480;
  const padL = compact ? 30 : 40, padR = 12, padT = 26, padB = compact ? 34 : 40;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;
  const scale = niceScale(Math.max(0, ...data.map((d) => d.value)));
  const max = scale.max;
  const ticks = [0, 1, 2, 3, 4].map((i) => i * scale.step);
  const slot = data.length ? plotW / data.length : plotW;
  const barW = Math.max(8, Math.min(56, slot * 0.58));
  const y = (v: number) => padT + plotH - (max > 0 ? (v / max) * plotH : 0);
  const interactive = Boolean(onBarSelect);
  const noun = (v: number) => (valueNoun ? ` ${valueNoun}${v === 1 ? "" : "s"}`.replace(/ss$/, "s") : "");

  const tip = hovered ? data.find((d) => d.key === hovered) : undefined;
  const tipIndex = tip ? data.indexOf(tip) : -1;

  function choose(key: string) {
    onBarSelect?.(selected === key ? null : key);
  }

  return (
    <div ref={wrapRef} className="rg-bar-chart" style={{ width: "100%" }}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="group" aria-label={ariaLabel} style={{ display: "block", overflow: "visible" }}
        onMouseLeave={() => setHovered(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={width - padR} y1={y(t)} y2={y(t)} stroke="var(--rg-chart-grid, #e8eef6)" strokeDasharray={t === 0 ? undefined : "3 4"} />
            <text x={padL - 8} y={y(t)} textAnchor="end" dominantBaseline="central" fontSize={compact ? 10 : 11} fill="var(--rg-text-muted, #7b8797)">
              {t.toLocaleString()}
            </text>
          </g>
        ))}

        {data.map((d, i) => {
          const cx = padL + slot * i + slot / 2;
          const top = y(d.value);
          const isSel = selected === d.key;
          const isHover = hovered === d.key;
          const dim = Boolean(selected) && !isSel && !isHover;
          return (
            <g key={d.key}>
              {/* full-height hit area makes small bars easy to hover and tap */}
              <rect x={cx - slot / 2} y={padT} width={slot} height={plotH} fill="transparent"
                style={{ cursor: interactive ? "pointer" : "default" }}
                onMouseEnter={() => setHovered(d.key)}
                onClick={interactive ? () => choose(d.key) : undefined} />
              <rect
                x={cx - barW / 2}
                y={top}
                width={barW}
                height={Math.max(d.value > 0 ? 2 : 0, padT + plotH - top)}
                rx={Math.min(6, barW / 3)}
                fill={isSel ? selectedColor : color}
                opacity={dim ? 0.35 : isHover ? 0.85 : 1}
                tabIndex={interactive ? 0 : -1}
                role={interactive ? "button" : undefined}
                aria-pressed={interactive ? isSel : undefined}
                aria-label={`${d.label}: ${formatValue(d.value)}${noun(d.value)}`}
                style={{ cursor: interactive ? "pointer" : "default", transition: "opacity .15s ease", outline: "none" }}
                onMouseEnter={() => setHovered(d.key)}
                onFocus={() => setHovered(d.key)}
                onBlur={() => setHovered(null)}
                onClick={interactive ? () => choose(d.key) : undefined}
                onKeyDown={interactive ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); choose(d.key); } } : undefined}
              >
                <title>{`${d.label}: ${formatValue(d.value)}${noun(d.value)}`}</title>
              </rect>
              {d.value > 0 && !isHover ? (
                <text x={cx} y={top - 7} textAnchor="middle" fontSize={compact ? 10 : 11.5} fontWeight={800} fill="var(--rg-text-strong, #11244a)" style={{ pointerEvents: "none" }}>
                  {formatValue(d.value)}
                </text>
              ) : null}
              <text x={cx} y={height - padB + (compact ? 15 : 18)} textAnchor="middle" fontSize={compact ? 10 : 11.5} fontWeight={isSel ? 900 : 650}
                fill={isSel ? "var(--rg-text-strong, #11244a)" : "var(--rg-text-muted, #5b6b82)"} style={{ pointerEvents: "none" }}>
                {d.label}
              </text>
            </g>
          );
        })}

        {tip ? (() => {
          const cx = padL + slot * tipIndex + slot / 2;
          const line1 = `${formatValue(tip.value)}${noun(tip.value)}`;
          const line2 = tip.hint || tip.label;
          const w = Math.max(line1.length, line2.length) * 7 + 22;
          const x = Math.min(Math.max(cx - w / 2, 2), width - w - 2);
          const top = Math.max(2, y(tip.value) - 52);
          return (
            <g style={{ pointerEvents: "none" }}>
              <rect x={x} y={top} width={w} height={42} rx={8} fill="var(--rg-tooltip-bg, #0f1f3d)" opacity={0.96} />
              <text x={x + w / 2} y={top + 16} textAnchor="middle" fontSize={12.5} fontWeight={900} fill="#fff">{line1}</text>
              <text x={x + w / 2} y={top + 32} textAnchor="middle" fontSize={11} fontWeight={600} fill="#c9d6ea">{line2}</text>
            </g>
          );
        })() : null}
      </svg>
    </div>
  );
}
