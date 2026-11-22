"use client";

import { appInfo, isApp } from "./native";

/**
 * ReqGen v4.6.11 — updates inside the app (brief §7).
 * public/downloads/app-version.json (made by MAKE_APP.bat) says which APK is
 * newest. When it is newer than this app, Home shows "New update available";
 * Update downloads it with a progress bar and Android asks to Install.
 */

export type AppRelease = {
  version: string;
  build: number;
  apk: string;
  size?: string;
  date?: string;
  sha256?: string;
  new?: string[];
  fixed?: string[];
  better?: string[];
};

export const APP_UPDATE_EVENT = "reqgen-app-update";

export async function latestRelease(): Promise<AppRelease | null> {
  try {
    const r = await fetch(`/downloads/app-version.json?t=${Date.now()}`, { cache: "no-store" });
    if (!r.ok) return null;
    const j = (await r.json()) as AppRelease;
    return j && j.version && j.build ? j : null;
  } catch {
    return null;
  }
}

/** The newer release, or null when this app is up to date (or on the website). */
export async function newerRelease(): Promise<AppRelease | null> {
  if (!isApp()) return null;
  const [mine, latest] = await Promise.all([appInfo(), latestRelease()]);
  if (!mine || !latest) return null;
  return latest.build > mine.build ? latest : null;
}

/**
 * Downloads the APK with progress (0 to 100, plus bytes so far and the full
 * size), then Android asks to Install. v4.6.12 (Kit K3): when `cancelled()`
 * says yes by the time the file is in, the installer is not opened and the
 * file is deleted.
 */
export async function downloadAndInstall(release: AppRelease, onProgress: (pct: number, bytes?: number, total?: number) => void, cancelled?: () => boolean) {
  const [{ Filesystem, Directory }, { FileOpener }] = await Promise.all([import("@capacitor/filesystem"), import("@capacitor-community/file-opener")]);
  const url = new URL(release.apk || "/downloads/ReqGen.apk", window.location.origin).href;
  const listener = await Filesystem.addListener("progress", (p) => {
    if (p.contentLength > 0) onProgress(Math.min(100, Math.round((p.bytes / p.contentLength) * 100)), p.bytes, p.contentLength);
  });
  try {
    await Filesystem.downloadFile({ url, path: "ReqGen-update.apk", directory: Directory.Cache, progress: true });
    if (cancelled?.()) {
      await Filesystem.deleteFile({ path: "ReqGen-update.apk", directory: Directory.Cache }).catch(() => undefined);
      return;
    }
    onProgress(100);
    const { uri } = await Filesystem.getUri({ path: "ReqGen-update.apk", directory: Directory.Cache });
    await FileOpener.open({ filePath: uri, contentType: "application/vnd.android.package-archive" });
  } finally {
    await listener.remove();
  }
}
