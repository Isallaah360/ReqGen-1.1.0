import { strFromU8, unzipSync } from "fflate";

/**
 * ReqGen v4.5 — read a bank statement (CSV or Excel .xlsx) for Finance
 * Reconciliation. Columns are found by their headings (Date, Details /
 * Description / Narration, Debit / Withdrawal / Out, Credit / Deposit / In,
 * Balance, Reference), so most Nigerian bank exports work as they are.
 */

export type StatementLine = { date: string; details: string; ref: string; out: number; in: number; balance: number | null; matched?: string | null };
export type Statement = { lines: StatementLine[]; opening: number; closing: number };

function csvRows(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = []; let cell = ""; let q = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { cell += '"'; i += 1; } else if (c === '"') q = false; else cell += c; continue; }
    if (c === '"') q = true;
    else if (c === "," || c === ";" || c === "\t") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i += 1; row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim() !== ""));
}

function xlsxRows(bytes: Uint8Array): string[][] {
  const files = unzipSync(bytes);
  const parse = (name: string) => (files[name] ? new DOMParser().parseFromString(strFromU8(files[name]), "application/xml") : null);
  const shared = parse("xl/sharedStrings.xml");
  const strings = shared ? Array.from(shared.getElementsByTagName("si")).map((si) => Array.from(si.getElementsByTagName("t")).map((t) => t.textContent || "").join("")) : [];
  const sheetName = Object.keys(files).filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n)).sort()[0];
  const sheet = sheetName ? parse(sheetName) : null;
  if (!sheet) return [];
  const colIndex = (ref: string) => (ref.match(/^[A-Z]+/)?.[0] || "A").split("").reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
  return Array.from(sheet.getElementsByTagName("row")).map((r) => {
    const out: string[] = [];
    Array.from(r.getElementsByTagName("c")).forEach((c) => {
      const t = c.getAttribute("t");
      const v = c.getElementsByTagName("v")[0]?.textContent ?? c.getElementsByTagName("t")[0]?.textContent ?? "";
      out[colIndex(c.getAttribute("r") || "A1")] = t === "s" ? strings[Number(v)] || "" : v;
    });
    return Array.from(out, (x) => x ?? "");
  }).filter((r) => r.some((x) => String(x).trim() !== ""));
}

const money = (s: string) => {
  const v = String(s || "").replace(/[₦N,\s]/g, "").replace(/^\((.*)\)$/, "-$1");
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
function isoDate(s: string) {
  const v = String(s || "").trim();
  if (/^\d{5}(\.\d+)?$/.test(v)) { const d = new Date(Math.round((Number(v) - 25569) * 86400000)); return d.toISOString().slice(0, 10); } // Excel serial
  const m = v.match(/^(\d{1,2})[/\-. ](\d{1,2}|[A-Za-z]{3})[/\-. ](\d{2,4})/);
  if (m) {
    const mon = /\d/.test(m[2]) ? Number(m[2]) : ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"].indexOf(m[2].toLowerCase()) + 1;
    const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    return `${y}-${String(mon).padStart(2, "0")}-${String(Number(m[1])).padStart(2, "0")}`;
  }
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

export async function readStatement(file: File): Promise<Statement> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const rows = /\.xlsx$/i.test(file.name) ? xlsxRows(bytes) : csvRows(new TextDecoder().decode(bytes));
  const headAt = rows.findIndex((r) => r.some((c) => /date/i.test(c)) && r.some((c) => /(debit|withdraw|credit|deposit|amount|balance)/i.test(c)));
  if (headAt < 0) throw new Error("The statement needs a heading row with Date, Debit / Credit (or Amount) and Balance.");
  const h = rows[headAt].map((c) => String(c).toLowerCase());
  const find = (re: RegExp) => h.findIndex((c) => re.test(c));
  const iDate = find(/date/), iDet = find(/(detail|descr|narrat|remark|particular)/), iRef = find(/(ref|cheque|instrument)/);
  const iOut = find(/(debit|withdraw|money out|^out$|dr\b)/), iIn = find(/(credit|deposit|money in|^in$|cr\b)/), iAmt = find(/^amount/), iBal = find(/balance/);
  const lines: StatementLine[] = rows.slice(headAt + 1).map((r) => {
    const amt = iAmt >= 0 ? money(r[iAmt]) : 0;
    return {
      date: isoDate(r[iDate]), details: String(r[iDet] ?? "").trim(), ref: iRef >= 0 ? String(r[iRef] ?? "").trim() : "",
      out: iOut >= 0 ? Math.abs(money(r[iOut])) : amt < 0 ? -amt : 0, in: iIn >= 0 ? Math.abs(money(r[iIn])) : amt > 0 ? amt : 0,
      balance: iBal >= 0 && String(r[iBal] ?? "").trim() !== "" ? money(r[iBal]) : null,
    };
  }).filter((l) => l.date);
  if (!lines.length) throw new Error("No dated lines were found under the heading row.");
  const first = lines[0], last = lines[lines.length - 1];
  const opening = /opening|brought forward|b\/f/i.test(first.details) ? first.balance ?? 0 : (first.balance ?? 0) + first.out - first.in;
  const closing = last.balance ?? lines.reduce((t, l) => t + l.in - l.out, opening);
  return { lines, opening, closing };
}

export type LedgerEvent = { at: string; ref: string; details: string; money_out: number; money_in: number };

/** Pair each statement line with one ReqGen ledger event: same amount and direction, voucher number in the text, or within 5 days. */
export function matchLines(lines: StatementLine[], events: LedgerEvent[]): StatementLine[] {
  const used = new Set<number>();
  return lines.map((l) => {
    if (/opening|brought forward|b\/f/i.test(l.details) && !l.in && !l.out) return { ...l, matched: "opening" };
    const amount = l.out || l.in;
    const isOut = l.out > 0;
    const cands = events.map((e, i) => ({ e, i })).filter(({ e, i }) => !used.has(i) && Math.abs((isOut ? Number(e.money_out) : Number(e.money_in)) - amount) < 0.01);
    const text = `${l.details} ${l.ref}`.toUpperCase();
    const best = cands.find(({ e }) => e.ref && text.includes(String(e.ref).toUpperCase()))
      || cands.sort((a, b) => Math.abs(new Date(a.e.at).getTime() - new Date(l.date).getTime()) - Math.abs(new Date(b.e.at).getTime() - new Date(l.date).getTime()))
        .find(({ e }) => Math.abs(new Date(e.at).getTime() - new Date(l.date).getTime()) <= 5 * 86400000);
    if (!best) return { ...l, matched: null };
    used.add(best.i);
    return { ...l, matched: best.e.ref || "ReqGen" };
  });
}
