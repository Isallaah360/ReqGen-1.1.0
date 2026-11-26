// ReqGen 6.3.1 with app 4.2.1 (build 13): Royal Blue website with a Glass switch, the home page with the big logo, and the app's icon home screen.
import fs from "node:fs";
const read = (f) => fs.readFileSync(f, "utf8");
let failures = 0;
const check = (label, ok) => { console.log(`${ok ? "PASS" : "FAIL"}  ${label}`); if (!ok) failures += 1; };

const css = read("app/v4/v631-look.css"), layout = read("app/layout.tsx"), theme = read("lib/theme.ts"), frame = read("app/components/v4/AppFrame.tsx");
check("Website: the 6.3.1 look loads after the 6.2.0 frame", layout.indexOf('"./v4/v6-site.css"') > -1 && layout.indexOf('"./v4/v631-look.css"') > layout.indexOf('"./v4/v6-site.css"'));
check("Website: the top bar is IET blue, not black, with no colour strip", /\.s6-top \{ background: #146185; border-bottom: 0; border-image: none; \}/.test(css) && css.includes("html body::before { display: none !important;") && css.includes(".v4-top-stripe { display: none !important; }"));
check("Website: the footer is dark blue, never black", /\.s6-foot \{[^}]*background: #0E4A66/.test(css));
check("Website: dark mode is deep IET blue", css.includes('html[data-theme="dark"] .v4-root { --v4-bg: #071E2A;'));
check("Website: the search text and hint are readable on the blue bar", css.includes(".s6-top .v4-search { background: #0E4A66;") && css.includes(".s6-top .v4-search input { color: #FFFFFF;") && css.includes(".s6-top .v4-search input::placeholder { color: #CFE8F5; opacity: 1; }"));
check("Website: Royal Blue by default; Glass is set before the first paint and switched from the photo menu", theme.includes('export type LookMode = "royal" | "glass"') && /dataset\.look\s*=/.test(theme) && frame.includes('applyLook(look === "glass" ? "royal" : "glass")'));
check("Website: animations stop when the device asks for less motion", css.includes("prefers-reduced-motion: no-preference"));
check("No purple anywhere in the new look", !/#(7c3aed|8b5cf6|a855f7|9333ea|6d28d9|purple)/i.test(css) && !/purple|violet/i.test(css));

const home = read("app/page.tsx");
check("Home page: big IET logo, ReqGen under it, sign-in links and the moving strip", home.includes('src="/v4/iet-logo.png"') && home.includes('className="s6-home-name">Req<span>Gen</span>') && home.includes('href="/login"') && home.includes('href="/signup"') && home.includes('className="s6-home-strip"') && home.includes('aria-hidden="true" inert'));
check("Home page: IET only, no developer branding", !/Barderian/i.test(home));

const grid = read("mobile/app/src/screens/Offices.tsx"), homeApp = read("mobile/app/src/screens/Home.tsx"), me = read("mobile/app/src/screens/Me.tsx"), appTsx = read("mobile/app/src/App.tsx"), acss = read("mobile/app/src/styles.css");
check("App: offices and pages are app icons on the home screen", grid.includes("export function AppGrid") && grid.includes("export function officeIcons") && homeApp.includes("<AppGrid") && homeApp.includes("officeIcons("));
check("App: each office opens to a page of app icons", /function Office\b[\s\S]*<AppGrid/.test(grid));
check("App: the tab is Settings; the profile photo opens Profile", appTsx.includes('b("me", "Settings", <Settings size={22} />)') && homeApp.includes('className="av-btn"') && homeApp.includes("<ProfileScreen />") && me.includes("export function ProfileScreen"));
check("App: Settings has fingerprint, App PIN, look and Sign out; Profile has access, activity, notices, about and Sign out", me.includes("<Big>Settings</Big>") && /PIN/.test(me) && /[Ff]ingerprint/.test(me) && me.includes('"Icon Grid"') && me.includes('"Glass Dock"') && (me.match(/Sign out/g) || []).length >= 2 && /My access/.test(me) && /My activity/.test(me) && /About ReqGen/.test(me));
check("App: Icon Grid is the default look and Glass Dock can be switched on", appTsx.includes('store.get<string>("rg:look", "grid")') || /rg:look",\s*"grid"/.test(appTsx));
check("App: glass look uses the deep IET blue base", acss.includes("--bg:#0B3D55") || acss.includes("--bg: #0B3D55"));
check("App: count badges use the readable IET red", acss.includes("#B8301C"));
check("App: motion stops when the phone asks for less motion", /prefers-reduced-motion/.test(acss));

const pkg = JSON.parse(read("package.json"));
check("Website version 6.3.1 or later", /^(6\.3\.([1-9]|\d\d)|6\.([4-9]|\d\d)\.|([7-9]|\d\d)\.)/.test(pkg.version) && read("lib/version.ts").includes(`"${pkg.version}"`));
const vp = read("mobile/version.properties");
const vn = (vp.match(/REQGEN_VERSION_NAME=(.+)/) || [])[1]?.trim();
check("App version 4.2.1 or later, build 13 or later", /^4\.(2\.([1-9]|\d\d)|([3-9]|\d\d)\.)/.test(vn || "") && Number((vp.match(/REQGEN_VERSION_CODE=(\d+)/) || [])[1]) >= 13 && read("mobile/app/src/lib/core.ts").includes(`APP_VERSION = "${vn}"`));
check("App: the secret service key is never in the app", !fs.readdirSync("mobile/app/src", { recursive: true }).some((f) => /\.(ts|tsx)$/.test(f) && /service_role|SERVICE_ROLE/.test(read(`mobile/app/src/${f}`))));

console.log(failures ? `\n${failures} check(s) failed.` : "\nAll ReqGen 6.3.1 checks passed.");
process.exit(failures ? 1 : 0);
