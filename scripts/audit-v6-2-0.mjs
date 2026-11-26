// ReqGen 6.2.0 with app 4.1.1: the new website frame (Blueprint 08) and the app's IET A4 papers.
import fs from "node:fs";
const read = (f) => fs.readFileSync(f, "utf8");
let failures = 0;
const check = (label, ok) => { console.log(`${ok ? "PASS" : "FAIL"}  ${label}`); if (!ok) failures += 1; };

const frame = read("app/components/v4/AppFrame.tsx");
const shell = read("app/components/GovernmentAppShell.tsx");
const css = read("app/v4/v6-site.css");
const layout = read("app/layout.tsx");
check("Website: signed-in pages use the new frame (top bar, menu, page, footer)", ["s6-site", "s6-top", "s6-menu", "s6-page", "<SiteFooter"].every((k) => frame.includes(k)));
check("Website: the old left menu, phone tab bar and pointer glow are gone", !/PhoneTabBar|PointerGlow|v4-drawer|MeSheet/.test(frame));
check("Website: sign-in and other public pages use the same plain frame", shell.includes("function PublicFrame") && shell.includes("s6-public"));
check("Website: the new look loads last, after the older skins", layout.indexOf("v6-site.css") > layout.indexOf("v5-skin.css") && layout.indexOf("v5-skin.css") > -1);
check("Website: colours come from the IET logo (no purple)", ["#31A8E0", "#F9A11F", "#F47824", "#EF3F27"].every((c) => css.toUpperCase().includes(c)) && !/#(8b5cf6|7c3aed|a855f7|6d28d9|9333ea)/i.test(css));
check("Website: no sideways scroll on phones (long buttons wrap)", /white-space:\s*normal/.test(css));
const siteFooter = frame.slice(frame.indexOf("export function SiteFooter"));
check("Website: IET brand for staff; Barderian only as developer, in the footer", siteFooter.includes("Developed by Barderian Enterprises") && frame.includes("<small>Islamic Education Trust, Request and Payment System</small>") && !shell.includes("Barderian"));

const a4 = read("mobile/app/src/lib/a4.ts");
check("App: the A4 papers follow the website's IET print templates", ["SUB-HEAD:", "Request for Fund", "ALLOCATION B/D:", "Payment Voucher", "Amount in Words", "Disbursement Details", "Certification / Approval / Receipt", "Building Bridges"].every((k) => a4.includes(k)));
check("App: the papers carry the QR check code", a4.includes('from "qrcode"') && a4.includes("/check/v/") && a4.includes("/check/r/"));
check("App: paper styles cannot clash with app styles (all prefixed)", !/class="(?!p4-|q-)[^"$]/.test(a4.replace(/class="p4-[^"]*"/g, "")));
check("App: the QR address is printed, never fetched", !/fetch\(\s*CHECK_SITE/.test(a4));

// times are 12-hour with AM/PM everywhere (website and app)
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.name === "node_modules" ? [] : e.isDirectory() ? walk(`${d}/${e.name}`) : [`${d}/${e.name}`]));
const uiFiles = ["app", "lib", "mobile/app/src"].flatMap(walk).filter((f) => /\.tsx?$/.test(f));
const h24 = uiFiles.filter((f) => /hour: "2-digit"|timeStyle|hour12: false/.test(read(f)));
check("Times: 12-hour with AM/PM on every screen (website and app)", h24.length === 0);
if (h24.length) console.log("      24-hour times in:", h24.join(", "));
const appTsx = read("mobile/app/src/App.tsx"), appCss = read("mobile/app/src/styles.css");
check("App: the opening screen is centred, with a live loading bar", appTsx.includes('className="splash"') && /\.splash\{position:fixed;inset:0[^}]*justify-content:center/.test(appCss) && appCss.includes("@keyframes splashRun") && appCss.includes("prefers-reduced-motion"));

const pkg = JSON.parse(read("package.json"));
check("Website version 6.2.0 or later", /^(6\.([2-9]|\d\d)|([7-9]|\d\d)\.)/.test(pkg.version) && read("lib/version.ts").includes(`"${pkg.version}"`));
const vp = read("mobile/version.properties");
const name = (vp.match(/REQGEN_VERSION_NAME=(.+)/) || [])[1]?.trim();
check("App version agrees everywhere (4.1.1 or later)", !!name && read("mobile/app/src/lib/core.ts").includes(`APP_VERSION = "${name}"`) && Number((vp.match(/REQGEN_VERSION_CODE=(\d+)/) || [])[1]) >= 11);

console.log(failures ? `\n${failures} check(s) failed.` : "\nAll ReqGen 6.2.0 checks passed.");
process.exit(failures ? 1 : 0);
