import { Filesystem, Directory } from "@capacitor/filesystem";
import { FileOpener } from "@capacitor-community/file-opener";
import { isNative } from "./core";

const safe = (n: string) => n.replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim().slice(0, 80) || "ReqGen";
const MIME: Record<string, string> = { pdf: "application/pdf", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", csv: "text/csv", zip: "application/zip", png: "image/png", jpg: "image/jpeg", json: "application/json", txt: "text/plain" };

function toBase64(bytes: Uint8Array) {
  let s = ""; const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) s += String.fromCharCode(...bytes.subarray(i, i + step));
  return btoa(s);
}

/** 3.0.2: a file made in the app (PDF, Excel, CSV, backup) is saved on the phone and opened. */
export async function saveAndOpen(name: string, bytes: Uint8Array, type?: string) {
  const ext = (name.split(".").pop() || "").toLowerCase();
  const mime = type || MIME[ext] || "application/octet-stream";
  if (!isNative()) {
    const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: mime }));
    const a = document.createElement("a"); a.href = url; a.download = name; document.body.appendChild(a); HTMLAnchorElement.prototype.click.call(a); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    return;
  }
  const path = `ReqGen/${Date.now()}-${safe(name)}`;
  const res = await Filesystem.writeFile({ path, data: toBase64(bytes), directory: Directory.Cache, recursive: true });
  await FileOpener.open({ filePath: res.uri, contentType: mime, openWithDefault: true });
}

/** Draws each A4 page as on screen and saves one PDF (A4, portrait). */
export async function savePdf(pages: HTMLElement[], title: string) {
  const [{ toPng }, { jsPDF }] = await Promise.all([import("html-to-image"), import("jspdf")]);
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true });
  for (let i = 0; i < pages.length; i++) {
    const el = pages[i];
    // the sheet may be shown smaller on the phone screen; the PDF is always drawn at the real A4 size
    const shown = el.style.zoom;
    el.style.zoom = "";
    let png: string;
    try {
      png = await toPng(el, { pixelRatio: 2, width: 794, height: 1123, backgroundColor: "#ffffff", cacheBust: true, style: { margin: "0", boxShadow: "none", borderRadius: "0", transform: "none", zoom: "1" } });
    } finally { el.style.zoom = shown; }
    if (i > 0) pdf.addPage("a4", "portrait");
    pdf.addImage(png, "PNG", 0, 0, 210, 297, undefined, "FAST");
  }
  const bytes = new Uint8Array(pdf.output("arraybuffer"));
  await saveAndOpen(`${safe(title.replace(/\s*\|\s*ReqGen$/, ""))}.pdf`, bytes, "application/pdf");
}

/** Every download a website page makes (Excel, CSV, PDF, backup) is caught and saved on the phone instead. */
export function catchDownloads() {
  if (!isNative()) return;
  const plain = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
    if (this.download && /^(blob:|data:)/.test(this.href)) {
      const name = this.download;
      void fetch(this.href).then((r) => r.arrayBuffer()).then((b) => saveAndOpen(name, new Uint8Array(b))).catch(() => null);
      return;
    }
    return plain.call(this);
  };
}

/** 3.0.2: a page that opens an attached file (a signed storage link) gets it saved on the phone and opened, not a browser tab. */
export function catchOpens() {
  if (!isNative()) return;
  const plain = window.open.bind(window);
  window.open = ((url?: string | URL, target?: string, features?: string) => {
    const u = url ? String(url) : "";
    if (/^https:\/\/[^/]+\.supabase\.co\/storage\//.test(u)) {
      void (async () => {
        const { CapacitorHttp } = await import("@capacitor/core");
        const r = await CapacitorHttp.request({ url: u, method: "GET", responseType: "arraybuffer" });
        const raw = typeof r.data === "string" ? r.data : "";
        const bin = atob(raw); const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        const name = decodeURIComponent(new URL(u).pathname.split("/").pop() || "attachment");
        const type = (r.headers?.["Content-Type"] || r.headers?.["content-type"]) as string | undefined;
        await saveAndOpen(name, bytes, type);
      })().catch(() => null);
      return null;
    }
    return plain(url, target, features);
  }) as typeof window.open;
}
