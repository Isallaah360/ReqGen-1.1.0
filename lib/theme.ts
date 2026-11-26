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

/**
 * 5.0.0 (Blueprint 07): the two themes, chosen in My Account › Appearance.
 *   "sand" = warm sand with IET blue (default), "gold" = the gold of the IET logo.
 * Each works with Light, Dark and Match device. Kept on this device only.
 * Older saved choices still work: "iet" becomes Gold, "green" becomes Sand.
 */
export type AccentMode = "sand" | "gold";
export const ACCENT_STORAGE_KEY = "reqgen-accent";

export function readAccent(): AccentMode {
  try {
    const v = window.localStorage.getItem(ACCENT_STORAGE_KEY);
    return v === "gold" || v === "iet" ? "gold" : "sand";
  } catch { return "sand"; }
}

export function applyAccent(accent: AccentMode) {
  const root = document.documentElement;
  root.dataset.accent = accent;
  try { window.localStorage.setItem(ACCENT_STORAGE_KEY, accent); } catch { /* private mode */ }
  window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: { accent } }));
}

/**
 * 6.3.1: the website look. "royal" (Royal Blue, the default) or "glass" (frosted glass over soft IET blue and gold).
 * Written to <html data-look="…">, kept on this device, chosen from the account menu.
 */
export type LookMode = "royal" | "glass";
export const LOOK_STORAGE_KEY = "reqgen-look";
export function readLook(): LookMode {
  try { return window.localStorage.getItem(LOOK_STORAGE_KEY) === "glass" ? "glass" : "royal"; } catch { return "royal"; }
}
export function applyLook(look: LookMode) {
  document.documentElement.dataset.look = look;
  try { window.localStorage.setItem(LOOK_STORAGE_KEY, look); } catch { /* private mode */ }
  window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: { look } }));
}

/** Runs in <head> before first paint, so dark mode never flashes white. */
export const THEME_BOOT_SCRIPT = `(function(){try{var m=localStorage.getItem('${THEME_STORAGE_KEY}')||'system';var d=m==='dark'||(m==='system'&&window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches);var r=document.documentElement;r.dataset.theme=d?'dark':'light';r.style.colorScheme=d?'dark':'light';var a=localStorage.getItem('${ACCENT_STORAGE_KEY}');r.dataset.accent=(a==='gold'||a==='iet')?'gold':'sand';r.dataset.look=localStorage.getItem('${LOOK_STORAGE_KEY}')==='glass'?'glass':'royal';}catch(e){document.documentElement.dataset.accent='sand';document.documentElement.dataset.look='royal';}})();`;
