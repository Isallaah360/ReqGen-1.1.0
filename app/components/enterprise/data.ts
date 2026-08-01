export type GenericRow = Record<string, unknown>;

export function normalizeRows(value: unknown): GenericRow[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is GenericRow => Boolean(item) && typeof item === "object" && !Array.isArray(item));
}

export function text(value: unknown, fallback = "") {
  if (value === null || value === undefined) return fallback;
  return String(value);
}

export function numberValue(value: unknown) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export function dateText(value: unknown) {
  if (!value) return "—";
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

export function roleKey(value: unknown) {
  return text(value).trim().toLowerCase().replace(/[\s_-]+/g, "");
}

export function activeRoleFromRpc(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return activeRoleFromRpc(value[0]);
  if (value && typeof value === "object") {
    const row = value as GenericRow;
    for (const key of ["get_my_active_role", "active_role_key", "role_key", "active_role", "role"]) {
      if (typeof row[key] === "string") return String(row[key]);
    }
  }
  return "staff";
}
