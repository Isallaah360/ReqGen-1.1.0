"use client";

import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { THEME_EVENT, applyTheme, readThemeMode, type ThemeMode } from "@/lib/theme";

const NEXT: Record<ThemeMode, ThemeMode> = { light: "dark", dark: "system", system: "light" };
const LABEL: Record<ThemeMode, string> = { light: "Light theme", dark: "Dark theme", system: "System theme" };

/** Top-bar theme switch: Light → Dark → System. */
export default function ThemeToggle() {
  const [mode, setMode] = useState<ThemeMode>("system");

  useEffect(() => {
    queueMicrotask(() => setMode(readThemeMode()));
    const media = window.matchMedia?.("(prefers-color-scheme: dark)");
    const onSystem = () => { if (readThemeMode() === "system") applyTheme("system"); };
    const onChange = () => setMode(readThemeMode());
    media?.addEventListener?.("change", onSystem);
    window.addEventListener(THEME_EVENT, onChange);
    return () => { media?.removeEventListener?.("change", onSystem); window.removeEventListener(THEME_EVENT, onChange); };
  }, []);

  const next = NEXT[mode];
  const Icon = mode === "light" ? Sun : mode === "dark" ? Moon : Monitor;
  return (
    <button
      type="button"
      className="rg-theme-toggle"
      onClick={() => applyTheme(next)}
      aria-label={`${LABEL[mode]} — switch to ${LABEL[next].toLowerCase()}`}
      title={`${LABEL[mode]} (click for ${LABEL[next].toLowerCase()})`}
    >
      <Icon size={19} aria-hidden="true" />
    </button>
  );
}
