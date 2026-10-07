/**
 * ReqGen v3.1.10 — IET financial year: 1 September to 31 August.
 * A financial year is named by its start year: FY 2025 = "2025/26"
 * = 1 Sep 2025 – 31 Aug 2026.
 */
export const FY_START_MONTH = 8; // 0-based: September

export function fyStartYear(date: Date | string | number) {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return NaN;
  return d.getMonth() >= FY_START_MONTH ? d.getFullYear() : d.getFullYear() - 1;
}

export function fyLabel(startYear: number) {
  return `${startYear}/${String((startYear + 1) % 100).padStart(2, "0")}`;
}

export function fyRangeText(startYear: number) {
  return `1 Sep ${startYear} – 31 Aug ${startYear + 1}`;
}

/** ISO bounds [from, to) for database filters. */
export function fyBounds(startYear: number) {
  return { from: `${startYear}-09-01T00:00:00Z`, to: `${startYear + 1}-09-01T00:00:00Z` };
}

export function currentFyStart() {
  return fyStartYear(new Date());
}
