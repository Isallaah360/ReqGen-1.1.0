import { db } from "./core";

export const MAX_MB = 10;
export const ACCEPT = ".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.webp,.txt";
function clean(name: string) {
  const parts = name.split(".");
  const ext = parts.length > 1 ? (parts.pop() || "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 12) : "";
  const base = parts.join(".").trim().toLowerCase().replace(/[^a-z0-9-_]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || "attachment";
  return ext ? `${base}.${ext}` : base;
}
export function addFiles(cur: File[], list: FileList | null): { files: File[]; problem: string | null } {
  if (!list || !list.length) return { files: cur, problem: null };
  const incoming = Array.from(list);
  const big = incoming.find((f) => f.size > MAX_MB * 1024 * 1024);
  if (big) return { files: cur, problem: `“${big.name}” is larger than ${MAX_MB} MB.` };
  return { files: [...cur, ...incoming].slice(0, 50), problem: null };
}
/** Same storage and table as the website. */
export async function uploadAll(requestId: string, uploader: string, files: File[]) {
  if (!files.length) return;
  const s = await db();
  const rows = [];
  for (let i = 0; i < files.length; i += 1) {
    const f = files[i];
    const path = `${requestId}/${Date.now()}-${i + 1}-${clean(f.name)}`;
    const up = await s.storage.from("request-attachments").upload(path, f, { upsert: false, contentType: f.type || "application/octet-stream" });
    if (up.error) throw new Error(`The request was sent, but “${f.name}” did not upload. Open the request on the website to add it again.`);
    rows.push({ request_id: requestId, uploaded_by: uploader, file_name: f.name, file_path: path, file_type: f.type || null, file_size: f.size, verification_status: "Pending" });
  }
  const ins = await s.from("request_attachments").insert(rows);
  if (ins.error) throw new Error("The files uploaded but could not be linked to the request: " + ins.error.message);
}
export const newNumber = () => { const n = new Date(); return `REQ-${n.getFullYear()}${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getTime()).slice(-6)}`; };
export const kb = (b: number) => (b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
export const parseAmount = (t: string) => { const v = Number(String(t).replace(/[^\d.]/g, "")); return Number.isFinite(v) ? Math.round(v * 100) / 100 : NaN; };
export const fmtAmount = (t: string) => { const raw = t.replace(/[^\d.]/g, ""); const [a, b] = raw.split("."); const i = (a || "").replace(/^0+(?=\d)/, "").replace(/\B(?=(\d{3})+(?!\d))/g, ","); return b !== undefined ? `${i}.${b.slice(0, 2)}` : i; };
