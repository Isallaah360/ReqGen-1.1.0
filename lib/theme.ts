/**
 * ReqGen theme (v3.0.6): "light" | "dark" | "system".
 * The resolved theme is written to <html data-theme="…">; the dark palette
 * lives in app/theme-dark.generated.css + app/theme-dark.css.
 */
export type ThemeMode = "light" | "dark" | "system";
export const THEME_STORAGE_KEY = "reqgen-theme";
export const THEME_EVENT = "reqgen-theme-changed";

export function readThemeMode(): ThemeMode {
  try {
    const v = window.localStorage.getItem(THEME_STORAGE_KEY);
    return v === "light" || v === "dark" || v === "system" ? v : "system";
  } catch {
    return "system";
  }
}

export function resolveTheme(mode: ThemeMode): "light" | "dark" {
  if (mode !== "system") return mode;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyTheme(mode: ThemeMode) {
  const resolved = resolveTheme(mode);
  const root = document.documentElement;
  root.dataset.theme = resolved;
  root.style.colorScheme = resolved;
  try { window.localStorage.setItem(THEME_STORAGE_KEY, mode); } catch { /* private mode */ }
  window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: { mode, resolved } }));
}

/** Runs in <head> before first paint, so dark mode never flashes white. */
export const THEME_BOOT_SCRIPT = `(function(){try{var m=localStorage.getItem('${THEME_STORAGE_KEY}')||'system';var d=m==='dark'||(m==='system'&&window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches);var r=document.documentElement;r.dataset.theme=d?'dark':'light';r.style.colorScheme=d?'dark':'light';}catch(e){}})();`;
