export type AnyRow = Record<string, unknown>;
export type Department = { id: string; name: string };

export function text(value: unknown): string {
  return String(value ?? "").trim();
}
export function numberValue(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}
export function money(value: unknown): string {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(numberValue(value));
}
export function dateValue(value: unknown): Date | null {
  const raw = text(value);
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}
export function dateLabel(value: unknown): string {
  const date = dateValue(value);
  return date ? date.toLocaleDateString("en-NG", { day: "2-digit", month: "short", year: "numeric" }) : "—";
}
export function rowDate(row: AnyRow): Date | null {
  return dateValue(row.transaction_date ?? row.voucher_date ?? row.entry_date ?? row.created_at ?? row.updated_at ?? row.date);
}
export function canonicalBalance(row: AnyRow): number {
  return numberValue(row.approved_allocation) - numberValue(row.reserved_amount) - numberValue(row.expenditure);
}
export function isRequestRejected(row: AnyRow): boolean {
  return /reject|cancel|delete/.test(`${text(row.status)} ${text(row.current_stage)}`.toLowerCase());
}
export function isRequestCompleted(row: AnyRow): boolean {
  return /complete|paid|closed|approved/.test(`${text(row.status)} ${text(row.current_stage)}`.toLowerCase());
}
export function isVoucherPaid(row: AnyRow): boolean {
  return /paid|complete|closed|disbursed/.test(text(row.status).toLowerCase());
}
export function isOpenVoucher(row: AnyRow): boolean {
  return !/paid|complete|closed|cancel|reject|void/.test(text(row.status).toLowerCase());
}
export function outflowValue(row: AnyRow): number {
  const debit = numberValue(row.debit);
  if (debit > 0) return debit;
  const type = `${text(row.transaction_type)} ${text(row.type)} ${text(row.narration)}`.toLowerCase();
  if (/expense|expenditure|payment|debit|withdraw|disburse/.test(type)) return numberValue(row.amount);
  return 0;
}
export function yearOf(row: AnyRow): number | null {
  return rowDate(row)?.getFullYear() ?? null;
}
export function daysOld(value: unknown): number | null {
  const date = dateValue(value);
  if (!date) return null;
  return Math.max(0, (Date.now() - date.getTime()) / 86400000);
}
export function downloadCsv(filename: string, rows: Array<Array<string | number>>) {
  const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
