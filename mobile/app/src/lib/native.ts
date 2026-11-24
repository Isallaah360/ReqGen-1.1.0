import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";
import { StatusBar, Style } from "@capacitor/status-bar";
import { App } from "@capacitor/app";
import { NativeBiometric } from "@capgo/capacitor-native-biometric";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { FileOpener } from "@capacitor-community/file-opener";
import { isNative, store, WEBSITE } from "./core";

/** Short vibrations on actions that matter. */
export const buzz = {
  tap: () => { if (isNative()) void Haptics.impact({ style: ImpactStyle.Light }).catch(() => null); },
  ok: () => { if (isNative()) void Haptics.notification({ type: NotificationType.Success }).catch(() => null); },
  bad: () => { if (isNative()) void Haptics.notification({ type: NotificationType.Error }).catch(() => null); },
};

/** The status bar follows light and dark, readable on Android 15 and newer. */
export function paintStatusBar(dark: boolean) {
  if (!isNative()) return;
  void StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light }).catch(() => null);
  void StatusBar.setBackgroundColor({ color: dark ? "#0E1530" : "#F7F2EA" }).catch(() => null);
}

// ---- App PIN (6 numbers, kept only as a SHA-256 fingerprint) and the 15-minute lock ----------------
async function sha(text: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`reqgen-pin:${text}`));
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
export const pin = {
  async isSet() { return !!(await store.get<string | null>("rg:pin", null)); },
  async set(p: string) { await store.set("rg:pin", await sha(p)); },
  async clear() { await store.del("rg:pin"); },
  async matches(p: string) { return (await store.get<string | null>("rg:pin", null)) === (await sha(p)); },
};
const LOCK_AFTER = 15 * 60 * 1000;
export async function touch() { await store.set("rg:active", Date.now()); }
export async function lockDue() { return Date.now() - (await store.get<number>("rg:active", 0)) > LOCK_AFTER; }

// ---- Fingerprint ------------------------------------------------------------------------------------
export const finger = {
  async ready() {
    if (!isNative()) return false;
    try { return (await NativeBiometric.isAvailable()).isAvailable; } catch { return false; }
  },
  async on() { return !!(await store.get<boolean>("rg:finger", false)); },
  async set(v: boolean) { await store.set("rg:finger", v); },
  async check(reason = "Open ReqGen") {
    await NativeBiometric.verifyIdentity({ reason, title: "ReqGen", subtitle: reason, description: "Use your fingerprint" });
  },
};

// ---- Back button, app version, updates -------------------------------------------------------------
export async function appVersion() {
  if (!isNative()) return { version: "2.0.1", build: 0 };
  try { const i = await App.getInfo(); return { version: i.version, build: Number(i.build) || 0 }; } catch { return { version: "2.0.1", build: 0 }; }
}
export type Release = { version: string; build: number; apk: string; size?: string; new?: string[]; fixed?: string[]; better?: string[] };
export async function newerRelease(): Promise<Release | null> {
  if (!isNative()) return null;
  try {
    const r = await fetch(`${WEBSITE}/downloads/app-version.json?t=${Date.now()}`, { cache: "no-store" });
    if (!r.ok) return null;
    const j = (await r.json()) as Release;
    const mine = await appVersion();
    return j.build > mine.build ? j : null;
  } catch { return null; }
}
export async function downloadAndInstall(rel: Release, onProgress: (pct: number, got: number, total: number) => void, cancelled: () => boolean) {
  const url = new URL(rel.apk || "/downloads/ReqGen.apk", WEBSITE).href;
  const l = await Filesystem.addListener("progress", (p) => { if (p.contentLength > 0) onProgress(Math.min(100, Math.round((p.bytes / p.contentLength) * 100)), p.bytes, p.contentLength); });
  try {
    await Filesystem.downloadFile({ url, path: "ReqGen-update.apk", directory: Directory.Cache, progress: true });
    if (cancelled()) { await Filesystem.deleteFile({ path: "ReqGen-update.apk", directory: Directory.Cache }).catch(() => null); return; }
    const { uri } = await Filesystem.getUri({ path: "ReqGen-update.apk", directory: Directory.Cache });
    await FileOpener.open({ filePath: uri, contentType: "application/vnd.android.package-archive" });
  } finally { await l.remove(); }
}
export function onBack(fn: () => void) {
  if (!isNative()) return () => undefined;
  const h = App.addListener("backButton", fn);
  return () => { void h.then((x) => x.remove()); };
}
export function onResume(fn: (active: boolean) => void) {
  if (!isNative()) return () => undefined;
  const h = App.addListener("appStateChange", ({ isActive }) => fn(isActive));
  return () => { void h.then((x) => x.remove()); };
}
export const exitApp = () => { if (isNative()) void App.exitApp(); };
