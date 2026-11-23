// ReqGen v4.6.11 release lock: the 20 Nov 2026 brief (colours, phone tabs,
// skeletons, optimistic actions, kept apart, speed, the Android app).
import fs from "node:fs";
const read = (f) => fs.readFileSync(f, "utf8");
let failures = 0;
const check = (label, ok) => { console.log(`${ok ? "PASS" : "FAIL"}  ${label}`); if (!ok) failures += 1; };

const css = read("app/v4/v4-brief.css");
check("Version 4.6.11 or later", /REQGEN_SEMVER = "4\.(6\.(1[1-9]|[2-9]\d)|([7-9]|[1-9]\d)\.\d+)"/.test(read("lib/version.ts")));
check("Colours: cream ground, navy text, orange buttons with navy text", css.includes("--v4-bg: #F7F2EA") && css.includes("--v4-ink: #1C2B5A") && css.includes("--v4-accent: #FF7A1A") && css.includes("color: var(--v4-on-accent)"));
check("Dark mode ground #0E1530 with cards #18234A", css.includes("--v4-bg: #0E1530") && css.includes("--v4-surface: #18234A"));
check("Brief stylesheet loads last", read("app/layout.tsx").indexOf("v4-brief.css") > read("app/layout.tsx").indexOf("v4-pages.css"));
check("Glass tab bar: blur 18 saturate 1.7, solid when it cannot blur", css.includes("blur(18px) saturate(1.7)") && css.includes("prefers-reduced-transparency") && css.includes("@supports not"));
const nav = read("app/components/v4/PhoneNav.tsx");
check("Tabs: Home, Requests, New, Approvals (approvers only), Me", ["Home", "Requests", "New", "Approvals", "Me"].every((t) => nav.includes(`/>${t}`) || nav.includes(`>${t}<`) || nav.includes(`${t}{`)) && nav.includes("approves(me.roleSet)"));
check("Me holds only the person's own account", !/MODULES/.test(nav) && nav.includes("Log out") && nav.includes("/change-password"));
const frame = read("app/components/v4/AppFrame.tsx");
check("Back on every page that is not Home, breadcrumb hidden on Home", frame.includes("v4-back-btn") && frame.includes("data-home"));
const ui = read("app/components/v4/ui.tsx");
check("Skeletons: rows, cards, timeline; aria-busy and a hidden Loading", ui.includes('kind?: "lines" | "rows" | "cards" | "timeline"') && ui.includes('aria-busy="true"') && ui.includes(">Loading<"));
check("Skeleton shimmer moves with transform only, plain for reduced motion", css.includes("v4-sk-move") && css.includes("transform: translateX(100%)") && css.includes("prefers-reduced-motion"));
check("Optimistic approve and return, undone with a message if refused", read("app/components/requests/RequestDetailsWorkspace.tsx").includes("Your approval was undone."));
check("Mark as read is undone if the server refuses", read("lib/notifications.ts").includes("Promise<boolean>") && read("app/components/v4/Bell.tsx").includes("Not marked as read"));
check("No developer sign-in on public pages; hidden /console", read("app/login/LoginView.tsx").includes('systemAccount === "developer" && !isConsole') && fs.existsSync("app/console/page.tsx"));
check("Footer has the WhatsApp and email contact", read("app/components/PublicAuthShell.tsx").includes("WhatsApp 0803 119 7746"));
check("No purple", !/#7C3AED|#8B5CF6|#4C1D95/i.test(css));
const vercel = JSON.parse(read("vercel.json"));
check("Speed: immutable fonts and assets, short cache on public checks", JSON.stringify(vercel.headers).includes("immutable") && JSON.stringify(vercel.headers).includes("s-maxage=60"));
check("Upgrade SQL is idempotent and ends with the done line", /if not exists/.test(read("database/v4_6_11_upgrade.sql")) && /upgrade done' as result;\s*$/.test(read("database/v4_6_11_upgrade.sql")));
const cap = JSON.parse(read("mobile/capacitor.config.json"));
// v4.7.0 (app 2.0.0): the screens are inside the APK; it no longer opens the site in a window.
check("App: Capacitor 8, id ng.com.barderians.reqgen, screens inside the APK", cap.appId === "ng.com.barderians.reqgen" && !cap.server?.url && JSON.parse(read("mobile/package.json")).dependencies["@capacitor/android"].startsWith("8."));
check("App plugins from the brief", ["@capacitor/app", "@capacitor/status-bar", "@capacitor/splash-screen", "@capacitor/filesystem", "@capacitor/share", "@capacitor-community/file-opener", "@capgo/capacitor-native-biometric"].every((p) => read("mobile/package.json").includes(p) && read("package.json").includes(p)));
check("Fingerprint keeps the email and password in the secure store", read("lib/app/biometric.ts").includes("setCredentials") && read("lib/app/biometric.ts").includes("getSecureCredentials") && read("lib/app/biometric.ts").includes("deleteCredentials"));
check("App PIN and fingerprint lock with a Use fingerprint button", read("app/components/app/AppBridge.tsx").includes("Use fingerprint") && read("lib/app/pin.ts").includes("SHA-256"));
check("Updates inside the app with progress, then Android asks to Install", read("lib/app/update.ts").includes("downloadFile") && read("lib/app/update.ts").includes("FileOpener.open"));
check("The download page shows the SHA-256", read("app/app/AppDownload.tsx").includes("SHA-256"));
check("The signing key never goes in the project", !fs.readdirSync("mobile").some((f) => /\.(keystore|jks)$/.test(f)) && read("mobile/make_app.ps1").includes("ReqGen_Key") && read("mobile/.gitignore").includes("*.keystore"));
check("The app project stays out of the website deploy", read(".vercelignore").includes("mobile/"));

console.log(failures ? `v4.6.11 release lock: ${failures} failure(s).` : "v4.6.11 release lock: PASSED");
process.exit(failures ? 1 : 0);
