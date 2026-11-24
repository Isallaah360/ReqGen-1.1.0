import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { SplashScreen } from "@capacitor/splash-screen";
import App from "./App";
import { openOutside } from "./lib/core";
import { catchDownloads, catchOpens } from "./lib/files2";
import { routeApiCalls } from "./lib/apiFetch";
catchDownloads();
catchOpens();
routeApiCalls();
import "@fontsource/plus-jakarta-sans/latin-400.css";
import "@fontsource/plus-jakarta-sans/latin-500.css";
import "@fontsource/plus-jakarta-sans/latin-600.css";
import "@fontsource/plus-jakarta-sans/latin-700.css";
import "@fontsource/plus-jakarta-sans/latin-800.css";
import "./styles.css";

// Links to our website (print, Finance, password) open in the phone's browser, never inside the app.
document.addEventListener("click", (e) => {
  const a = (e.target as HTMLElement | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
  if (!a || !/^https?:/i.test(a.href) || a.origin === window.location.origin) return;
  e.preventDefault();
  openOutside(a.href);
});

createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
void SplashScreen.hide().catch(() => null);
