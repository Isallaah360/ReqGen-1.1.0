import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { SplashScreen } from "@capacitor/splash-screen";
import App from "./App";
import Crash, { watchCrashes } from "./Crash";
import "@fontsource/plus-jakarta-sans/latin-400.css";
import "@fontsource/plus-jakarta-sans/latin-500.css";
import "@fontsource/plus-jakarta-sans/latin-600.css";
import "@fontsource/plus-jakarta-sans/latin-700.css";
import "@fontsource/plus-jakarta-sans/latin-800.css";
import "./styles.css";

watchCrashes();
createRoot(document.getElementById("root")!).render(<StrictMode><Crash><App /></Crash></StrictMode>);
void SplashScreen.hide().catch(() => null);
