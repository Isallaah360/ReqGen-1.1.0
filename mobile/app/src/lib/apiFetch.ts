import { CapacitorHttp } from "@capacitor/core";
import { WEBSITE, isNative } from "./core";

/**
 * 3.0.2: the website's own pages call our website's server routes as "/api/...". Inside the app those calls
 * go to https://ietreqgen.barderians.com.ng/api/... (on the phone through Android's own network layer, so no
 * browser cross-site rule can block them). Database calls are untouched.
 */
function toBase64Bytes(b64: string) {
  const bin = atob(b64); const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function b64(bytes: Uint8Array) {
  let s = ""; const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) s += String.fromCharCode(...bytes.subarray(i, i + step));
  return btoa(s);
}
export function routeApiCalls() {
  const plain = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const m = raw.match(/^(?:https?:\/\/localhost(?::\d+)?)?(\/api\/.*)$/);
    if (!m || m[1].startsWith("/api/app-config")) return plain(input, init);
    const url = `${WEBSITE}${m[1]}`;
    const method = (init?.method || (typeof input !== "string" && !(input instanceof URL) ? input.method : "GET") || "GET").toUpperCase();
    const headers: Record<string, string> = {};
    new Headers(init?.headers || (typeof input !== "string" && !(input instanceof URL) ? input.headers : undefined)).forEach((v, k) => { headers[k] = v; });
    const body = init?.body;
    if (!isNative() || (body && typeof body !== "string" && !(body instanceof FormData))) return plain(url, init);
    let data: unknown = undefined;
    let dataType: "formData" | undefined;
    if (typeof body === "string") { try { data = JSON.parse(body); } catch { data = body; } }
    if (body instanceof FormData) {
      // a form with a file (a backup to restore): sent as a form, through the phone's own network layer
      const parts: { key: string; value: string; type: "string" | "base64File"; fileName?: string; contentType?: string }[] = [];
      for (const [key, value] of body.entries()) {
        if (typeof value === "string") parts.push({ key, value, type: "string" });
        else parts.push({ key, value: b64(new Uint8Array(await value.arrayBuffer())), type: "base64File", fileName: value.name || "file", contentType: value.type || "application/octet-stream" });
      }
      data = parts; dataType = "formData";
      delete headers["content-type"];
      headers["Content-Type"] = "multipart/form-data";
    }
    const r = await CapacitorHttp.request({ url, method, headers, data, dataType, responseType: "arraybuffer" } as Parameters<typeof CapacitorHttp.request>[0]);
    const bytes = typeof r.data === "string" ? toBase64Bytes(r.data) : new TextEncoder().encode(JSON.stringify(r.data ?? null));
    return new Response(bytes as BodyInit, { status: r.status, headers: r.headers as Record<string, string> });
  };
}
