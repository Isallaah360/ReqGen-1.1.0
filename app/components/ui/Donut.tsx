"use client";

import type { ReactNode } from "react";

/**
 * Canonical ReqGen donut chart.
 *
 * Every donut chart in the app should use this component instead of a
 * bespoke `conic-gradient()` + CSS-mask implementation. Two reasons:
 *
 * 1. Standardisation — every donut in the app should look and behave
 *    identically. Before this component existed, at least 8 pages each had
 *    their own hand-rolled version, several of them visibly broken (the
 *    center circle rendering as a rounded square instead of a true circle).
 * 2. Robustness — this uses inline styles exclusively, with NO dependency
 *    on any CSS module file. The center circle is positioned with
 *    top/left/transform + explicit width/height + aspect-ratio, not the
 *    `inset` shorthand, which is the most likely cause of the rounded-square
 *    bug (browser/build-pipeline handling of `inset` on an absolutely
 *    positioned element with no other sizing was inconsistent). Because
 *    everything here is inline, there is no external stylesheet that can
 *    drift, get patched three different ways over time, or be overridden by
 *    an unrelated global rule.
 */
export type DonutSegment = { label: string; value: number; color: string };

export function Donut({
  segments,
  size = 116,
  strokeWidth = 22,
  centerLabel = "Total",
  formatTotal,
  formatValue,
  onSelect,
}: {
  segments: DonutSegment[];
  size?: number;
  strokeWidth?: number;
  centerLabel?: string;
  formatTotal?: (total: number) => ReactNode;
  formatValue?: (value: number, label: string) => string;
  onSelect?: (detail: string) => void;
}) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;
  const centerSize = Math.max(size - strokeWidth * 2.35, size * 0.4);
  let offset = 0;

  const fmt = formatValue || ((v: number, label: string) => `${label}: ${v.toLocaleString()}`);

  return (
    <div
      role="img"
      aria-label={`Donut chart. Total ${total.toLocaleString()}.`}
      style={{ position: "relative", width: size, height: size, minWidth: size, display: "grid", placeItems: "center" }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        aria-hidden="true"
        style={{ display: "block", transform: "rotate(-90deg)", overflow: "visible" }}
      >
        <circle cx={center} cy={center} r={radius} fill="none" stroke="#edf2f7" strokeWidth={strokeWidth} />
        {total > 0
          ? segments.map((s) => {
              if (s.value <= 0) return null;
              const length = (s.value / total) * circumference;
              const dashOffset = -offset;
              offset += length;
              return (
                <circle
                  key={s.label}
                  cx={center}
                  cy={center}
                  r={radius}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={strokeWidth}
                  pathLength={circumference}
                  strokeDasharray={`${length} ${circumference - length}`}
                  strokeDashoffset={dashOffset}
                  style={{ cursor: onSelect ? "pointer" : undefined, transition: "stroke-width .14s ease, opacity .14s ease" }}
                  onClick={onSelect ? () => onSelect(fmt(s.value, s.label)) : undefined}
                >
                  <title>{fmt(s.value, s.label)}</title>
                </circle>
              );
            })
          : null}
      </svg>
      <button
        type="button"
        onClick={onSelect ? () => onSelect(segments.map((s) => fmt(s.value, s.label)).join(" \u00b7 ")) : undefined}
        aria-label="Show complete chart breakdown"
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: centerSize,
          height: centerSize,
          aspectRatio: "1",
          borderRadius: "50%",
          border: 0,
          padding: 0,
          background: "#fff",
          boxShadow: "0 0 0 1px #eef2f6",
          display: "grid",
          placeContent: "center",
          textAlign: "center",
          cursor: onSelect ? "pointer" : "default",
          color: "#11244a",
        }}
      >
        {formatTotal ? formatTotal(total) : <strong style={{ fontSize: Math.round(size * 0.19), lineHeight: 1, fontWeight: 900 }}>{total.toLocaleString()}</strong>}
        <span style={{ marginTop: 4, display: "block", color: "#7b8797", fontSize: 10 }}>{centerLabel}</span>
      </button>
    </div>
  );
}
