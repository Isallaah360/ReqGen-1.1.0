// ReqGen v4.0.0 — release lock: the approved v4 frame, mother pages, IET brand,
// fingerprint + passcode sign-in, PD / HR Coordinator names, POS removed.
import fs from "node:fs";
import path from "node:path";

const read = (f) => fs.readFileSync(f, "utf8");
const exists = (f) => fs.existsSync(f);
const results = [];
const check = (label, ok) => results.push([label, !!ok]);

function walk(dir, out = []) {
  if (!exists(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name.startsWith(".")) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out); else out.push(p);
  }
  return out;
}
const appFiles = walk("app").concat(walk("lib")).filter((f) => /\.(tsx?|css)$/.test(f));
const routeExists = (href) => {
  const clean = href.split(/[?#]/)[0].replace(/^\//, "");
  return exists(path.join("app", clean, "page.tsx"));
};

// 1. Design system
const v4css = read("app/v4/v4.css");
const theme = read("app/v4/v4-theme.css");
const layout = read("app/layout.tsx");
check("v4 design system ported from the approved mock-ups (1000+ rules)", (v4css.match(/\{/g) || []).length > 1000 && v4css.includes(".v4-tile") && v4css.includes(".v4-stat"));
check("Light and dark themes (IET colours in both)", theme.includes('html[data-theme="dark"] .v4-root') && theme.includes("--v4-brand: #E0661F"));
check("Layout loads the v4 styles and marks the page", layout.includes('import "./v4/v4.css"') && layout.includes('import "./v4/v4-theme.css"') && layout.includes('className="v4-root"'));
check("Element styles are low-specificity (buttons keep their own colours)", v4css.includes(":where(.v4-ui) a {") && !/^\.v4-ui a \{/m.test(v4css));

// 2. IET brand
check("IET tab icon, app icon and phone icon", exists("app/favicon.ico") && exists("app/icon.png") && exists("app/apple-icon.png") && exists("public/v4/icon-512.png"));
check("Installable app details use IET name and colour", read("app/manifest.ts").includes("#B83E00") && read("app/manifest.ts").includes("Islamic Education Trust"));
check("Browser colour is IET orange", layout.includes('color: "#B83E00"') && !layout.includes("#0b2d57"));
// The Developer system account belongs to Barderian Enterprises, so My Account may name it.
const barderianAllowed = new Set(["app/components/PublicAuthShell.tsx", "app/components/v4/AppFrame.tsx", "app/about/page.tsx", "app/docs/page.tsx", "app/profile/page.tsx",
  // v4.6: the approved mock-ups name the Developer account (80) and the release (88)
  "app/admin/system-accounts/page.tsx", "app/admin/system-health/page.tsx",
  // v4.6.6: the Developer Console is the Developer's own workspace; What's new names who released it; the
  // "not set up" page names the Developer account's email
  "app/developer/page.tsx", "app/whats-new/page.tsx", "app/unauthorized/page.tsx"]);
const barderianLeaks = appFiles.filter((f) => /\.tsx$/.test(f) && /Barderian/i.test(read(f)) && !barderianAllowed.has(f.replace(/\\/g, "/")));
check(`Barderian Enterprises appears only in footers and About (${barderianLeaks.join(", ") || "ok"})`, barderianLeaks.length === 0);
check("Home page shows the IET logo, not Barderian", !read("app/page.tsx").includes("be-logo") || read("app/page.tsx").includes("PublicFoot"));

// 3. Frame and mother pages
const modules = read("lib/v4/modules.ts");
const frame = read("app/components/v4/AppFrame.tsx");
const shell = read("app/components/GovernmentAppShell.tsx");
const moduleHrefs = [...modules.matchAll(/^\s{4}href: "([^"]+)",$/gm)].map((m) => m[1]);
check(`Ten modules in the menu (${moduleHrefs.length})`, moduleHrefs.length === 10);
check("Menu groups: Offices and Oversight", modules.includes('group: "Offices"') && modules.includes('group: "Oversight"'));
check("Every module has a mother page", moduleHrefs.every(routeExists) && routeExists("/profile"));
const tileHrefs = [...modules.matchAll(/\{ href: "([^"]+)", title:/g)].map((m) => m[1]);
const missingTiles = tileHrefs.filter((h) => !routeExists(h));
check(`Every tile opens a real page (${missingTiles.join(", ") || "ok"})`, missingTiles.length === 0);
check("Shell uses the v4 frame for signed-in pages", shell.includes("<AppFrame>") && shell.includes("isV4Page"));
check("Breadcrumb on every page (Home › Module › Page › Record)", frame.includes("breadcrumbsFor(") && modules.includes("export function breadcrumbsFor"));
check("Loading bar sits below the top bar", frame.indexOf("</header>") < frame.indexOf("<LoadBar />"));
check("Approvals badge uses the shared queue rule", frame.includes("isAwaitingUser(row"));
check("Sidebar collapses and opens as a drawer on phones", frame.includes("v4-is-mini") && frame.includes("v4-drawer-open"));
check("Footer: Made for IET, values, Help, Privacy, version, 2FA window, Powered by", frame.includes("Made for the") && frame.includes("REQGEN_VERSION") && frame.includes("2FA verified until") && frame.includes("Powered by"));
check("Theme choice kept (light, dark, device) in the account menu", frame.includes("applyTheme(next)"));
const moved = ["requests/mine", "approvals/inbox", "finance/overview", "payment-vouchers/centre", "registry/centre", "reports/centre", "audit-centre/logs", "admin/overview", "profile/details"];
check("Old module front pages moved under their mother pages", moved.every((m) => exists(`app/${m}/page.tsx`)));
const staleLinks = appFiles.filter((f) => /["'`]\/(registry\?view|payment-vouchers\?create|requests\?updated|admin\?updated|finance\?updated|audit-centre\?view|profile\?guide)/.test(read(f)));
check(`No link still points at an old front page (${staleLinks.join(", ") || "ok"})`, staleLinks.length === 0);
// v4.3: each voucher view is its own page now; none of them renders the mother page
check("PV views import the Voucher Centre, not the mother page", ["pending", "approved", "history", "print-centre", "reports"].every((v) => !read(`app/payment-vouchers/${v}/page.tsx`).includes("MotherPage")));

// 4. Sign-in and security
const wa = read("app/api/auth/webauthn/route.ts");
const pc = read("app/api/auth/passcode/route.ts");
const rules = read("lib/v4/passcodeRules.ts");
const dev = read("lib/v4/deviceSignIn.ts");
check("Fingerprint: adding one needs a 2FA-checked session", wa.includes('who.claims.aal !== "aal2"'));
check("Fingerprint: user verification required and counter checked", wa.includes('userVerification: "required"') && wa.includes("newCounter"));
check("Fingerprint sign-in counts as the 12-hour 2FA check", wa.includes("setWindowCookie("));
check("Passcode: only a slow salted hash is stored, joined to the device key", pc.includes("scryptSync") && pc.includes("device_key_hash") && !/passcode_hash:\s*passcode\b/.test(pc));
check("Passcode: five wrong tries remove it from the device", pc.includes("securityRules()).passcodeTries") && read("lib/server/mfaWindow.ts").includes("let passcodeTries = 5") && pc.includes("revoked_at"));
check("Passcode: easy codes refused", rules.includes('"123456"') && rules.includes("Numbers in a row"));
check("Passcode: setting it signs out every other device", pc.includes('signOut(who.token, "others")'));
check("Passcode never kept in the browser", !/setItem\([^)]*passcode/i.test(dev));
check("Sign-in page offers passcode on a trusted device and fingerprint", read("app/login/page.tsx").includes("passcodeSignIn") && read("app/login/page.tsx").includes("fingerprintSignIn"));
check("2FA page offers fingerprint or the 6-digit code", read("app/mfa/page.tsx").includes("fingerprintStepUp") && read("app/mfa/page.tsx").includes("OtpBoxes"));
check("Security & Devices lists fingerprints and trusted devices", read("app/profile/security/page.tsx").includes("reqgen_webauthn_credentials") && read("app/profile/security/page.tsx").includes("reqgen_trusted_devices"));
check("Browser never reads passcode hashes", !/reqgen_trusted_devices"\)\.select\("[^"]*hash/.test(read("app/profile/security/page.tsx")));

// 5. Names and payment methods
const roles = read("lib/roles.ts");
check("PO now reads as PD; HR Boss as HR Coordinator", roles.includes('return "pd"') && roles.includes('return "hrcoordinator"') && roles.includes('hrcoordinator: "HR Coordinator"'));
const hrBoss = appFiles.filter((f) => /\.tsx$/.test(f) && /HR Boss|Head of HR/.test(read(f)));
check(`No screen says "HR Boss" (${hrBoss.join(", ") || "ok"})`, hrBoss.length === 0);
const dean = appFiles.filter((f) => /\.tsx$/.test(f) && /\bDean\b/.test(read(f)));
check(`No screen says "Dean" (${dean.join(", ") || "ok"})`, dean.length === 0);
check("Routing engine works with PD (old PO rows read as PD)", read("lib/routingEngine.ts").includes('"PD" | "DOD"') && read("lib/routingEngine.ts").includes("canonicalStage"));
check("Departments read pd_id (or po_id before the database step)", read("app/admin/departments/page.tsx").includes("x.pd_id ?? x.po_id"));
const treat = read("app/finance/request/[id]/page.tsx");
check("Three payment methods only: Bank Transfer, Cheque, Cash", treat.includes('(["Transfer", "Cash", "Cheque"] as Mode[])') && !treat.includes("POS"));
check("Manual voucher offers the same three methods", !/"POS"|"Mobile Transfer"/.test(read("app/payment-vouchers/manual/page.tsx")));
check("POS is not a standard IET account", !read("app/finance/manage-accounts/page.tsx").includes('name: "POS"'));

// 6. Privacy, dialogs, release hygiene
const perms = read("lib/permissions.ts");
check("Registry still cannot open request contents (own list allowed)", perms.includes("(?!(?:new|mine)(?:\\/|$))") && perms.includes('roles: ["registry"]'));
const v4Files = walk("app/components/v4").concat(["app/dashboard/page.tsx", "app/notifications/page.tsx", "app/profile/page.tsx", "app/profile/security/page.tsx", "app/profile/passcode/page.tsx", "app/login/page.tsx", "app/mfa/page.tsx", "app/mfa/setup/page.tsx"]);
const nativeDialogs = v4Files.filter((f) => /\bwindow\.(alert|confirm|prompt)\(|(^|[^.\w])(alert|confirm)\(/m.test(read(f)));
check(`In-app dialogs only (${nativeDialogs.join(", ") || "ok"})`, nativeDialogs.length === 0);
const emoji = v4Files.filter((f) => /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(read(f)));
check(`No emoji in v4 screens (${emoji.join(", ") || "ok"})`, emoji.length === 0);
check("Version 4.x everywhere", JSON.parse(read("package.json")).version.startsWith("4.") && read("lib/version.ts").includes(`REQGEN_SEMVER = "${JSON.parse(read("package.json")).version}"`));
const envFiles = fs.readdirSync(".").filter((f) => /^\.env/.test(f));
check(`No .env file in the project (${envFiles.join(", ") || "ok"})`, envFiles.length === 0);

let failed = 0;
for (const [label, ok] of results) { if (!ok) failed++; console.log(`${ok ? "PASS" : "FAIL"}  ${label}`); }
if (failed) { console.error(`\nv4.0.0 release lock: ${failed} failure(s).`); process.exit(1); }
console.log(`\nv4.0.0 release lock: PASS (${results.length} checks).`);
