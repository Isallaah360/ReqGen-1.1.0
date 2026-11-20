"use client";

/**
 * ReqGen v4.6.11 — phone features of the ReqGen Android app (Capacitor 8).
 *
 * The app opens the live ReqGen website, so these helpers run inside the same
 * pages as the website. Every one of them does nothing on the website: they
 * check isApp() first, and the plugins load only inside the app.
 */

type Cap = { isNativePlatform?: () => boolean };

export const APP_SERVER_NAME = "reqgen.barderians.com.ng";

export function isApp(): boolean {
  if (typeof window === "undefined") return false;
  const cap = (window as unknown as { Capacitor?: Cap }).Capacitor;
  return !!cap?.isNativePlatform?.();
}

/** The installed app's own version (never the website version). */
export async function appInfo(): Promise<{ version: string; build: number } | null> {
  if (!isApp()) return null;
  try {
    const { App } = await import("@capacitor/app");
    const info = await App.getInfo();
    return { version: info.version, build: Number(info.build) || 0 };
  } catch {
    return null;
  }
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] || "");
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

/** An app cannot "download": the file is saved, then the phone's Share box opens. */
export async function shareFile(blob: Blob, fileName: string) {
  const [{ Filesystem, Directory }, { Share }] = await Promise.all([import("@capacitor/filesystem"), import("@capacitor/share")]);
  const safe = fileName.replace(/[^\w.\- ]+/g, "_").slice(0, 120) || "ReqGen-file";
  const written = await Filesystem.writeFile({ path: safe, data: await blobToBase64(blob), directory: Directory.Cache });
  await Share.share({ title: safe, files: [written.uri], dialogTitle: "Save or send" });
}

/** Download links made by ReqGen (CSV, Excel, backups) use the Share box in the app. Returns the undo. */
export function installFileShare(): () => void {
  const proto = HTMLAnchorElement.prototype;
  const original = proto.click;
  proto.click = function click(this: HTMLAnchorElement) {
    const href = this.getAttribute("href") || "";
    if (this.hasAttribute("download") && /^(blob:|data:)/.test(href)) {
      const name = this.getAttribute("download") || "ReqGen-file";
      void fetch(href).then((r) => r.blob()).then((b) => shareFile(b, name)).catch(() => undefined);
      return;
    }
    return original.call(this);
  };
  return () => { proto.click = original; };
}

/** The phone's print screen, which also offers "Save as PDF" (ReqGenPrint, built into the app). */
export async function printScreen(name = "ReqGen") {
  const { registerPlugin } = await import("@capacitor/core");
  const ReqGenPrint = registerPlugin<{ print: (o: { name: string }) => Promise<void> }>("ReqGenPrint");
  await ReqGenPrint.print({ name });
}

/* ---------------- app-private storage ---------------- */

export async function appGet(key: string): Promise<string | null> {
  const { Preferences } = await import("@capacitor/preferences");
  return (await Preferences.get({ key })).value;
}

export async function appSet(key: string, value: string | null) {
  const { Preferences } = await import("@capacitor/preferences");
  if (value === null) await Preferences.remove({ key });
  else await Preferences.set({ key, value });
}
