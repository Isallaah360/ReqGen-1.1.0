"use client";

/**
 * Canonical ReqGen donut chart.
 *
 * Every donut chart in the app should use this component instead of a
 * bespoke implementation.
 *
 * This is drawn entirely as native SVG — the ring, the white centre hole,
 * and the centre number/label are all plain SVG shapes (<circle> and
 * <text>) inside one <svg> coordinate space. Earlier versions of this
 * component overlaid a separate HTML <button> on top of the SVG using
 * absolute positioning to make the centre "hole" and its text. That
 * requires the browser to align two different rendering technologies
 * (HTML box layout and SVG) pixel-perfectly, which turned out to be
 * unreliable across different displays/zoom levels/environments and
 * repeatedly rendered as a rounded square instead of a circle. Putting
 * everything inside the SVG removes that alignment problem entirely: a
 * circle is drawn with the same math the ring segments use, so it cannot
 * end up a different shape.
 *
 * No hover tooltips and no interactive stroke-width-on-hover styling —
 * removed deliberately, since the earlier interactive version was part of
 * what looked broken/inconsistent in testing. Clicking a segment or the
 * centre still calls onSelect if provided, same as before.
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
  formatTotal?: (total: number) => string;
  formatValue?: (value: number, label: string) => string;
  onSelect?: (detail: string) => void;
}) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;
  const totalText = formatTotal ? formatTotal(total) : total.toLocaleString();
  const totalFontSize = Math.round(size * (totalText.length > 5 ? 0.13 : 0.19));
  const labelFontSize = Math.max(9, Math.round(size * 0.086));
  let offset = 0;

  const fmt = formatValue || ((v: number, label: string) => `${label}: ${v.toLocaleString()}`);

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={`Donut chart. Total ${total.toLocaleString()}.`}
      style={{ display: "block", flexShrink: 0 }}
    >
      <g transform={`rotate(-90 ${center} ${center})`}>
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
                  style={{ cursor: onSelect ? "pointer" : undefined }}
                  onClick={onSelect ? () => onSelect(fmt(s.value, s.label)) : undefined}
                />
              );
            })
          : null}
      </g>

      <circle
        cx={center}
        cy={center}
        r={Math.max(radius - strokeWidth / 2 - 2, 4)}
        fill="#fff"
        stroke="#eef2f6"
        strokeWidth={1}
        style={{ cursor: onSelect ? "pointer" : "default" }}
        onClick={onSelect ? () => onSelect(segments.map((s) => fmt(s.value, s.label)).join(" \u00b7 ")) : undefined}
      />
      <text
        x={center}
        y={center - labelFontSize * 0.35}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={totalFontSize}
        fontWeight={900}
        fill="#11244a"
        style={{ pointerEvents: "none", userSelect: "none" }}
      >
        {totalText}
      </text>
      <text
        x={center}
        y={center + labelFontSize * 1.15}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={labelFontSize}
        fontWeight={600}
        fill="#7b8797"
        style={{ pointerEvents: "none", userSelect: "none" }}
      >
        {centerLabel}
      </text>
    </svg>
  );
}
