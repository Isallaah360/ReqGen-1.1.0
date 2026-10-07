// ReqGen v3.1.10 — release lock: every page reachable, IET financial year,
// one loading bar, "Checked by" never blank, Setup Guide completes.
import fs from "node:fs";
import path from "node:path";
const read = (f) => fs.readFileSync(f, "utf8");
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? (e.name === "node_modules" || e.name.startsWith(".") ? [] : walk(path.join(d, e.name))) : [path.join(d, e.name)]);
const results = [];
const check = (label, ok, detail = "") => results.push({ label, ok: Boolean(ok), detail });

// 1. Reachability: every page is linked somewhere, or is an auth/public page, or a redirect.
const files = [...walk("app"), ...walk("lib")].filter((f) => /\.(tsx?|mjs)$/.test(f));
const pages = files.filter((f) => f.startsWith("app") && f.endsWith("page.tsx"));
const literals = new Set();
for (const f of files) {
  if (/routeRegistry|pageArchitecture/.test(f)) continue;
  for (const m of read(f).matchAll(/["'`](\/[a-z0-9\-/]*)/g)) literals.add(m[1].replace(/\/$/, "") || "/");
}
const PUBLIC = new Set(["/", "/login", "/signup", "/forgot-password", "/reset-password", "/mfa", "/mfa/setup", "/unauthorized"]);
const orphans = pages.map((p) => ({ p, route: ("/" + path.dirname(p).replace(/^app\/?/, "")).replace(/\/$/, "") || "/" }))
  .filter(({ route }) => !route.includes("["))
  .filter(({ p, route }) => !PUBLIC.has(route) && !literals.has(route) && !/redirect\(/.test(read(p)));
check("Every page is reachable from the app (linked, auth page or redirect)", orphans.length === 0, orphans.map((o) => o.route).join(", "));
const shell = read("app/components/GovernmentAppShell.tsx");
check("Finance Audit, Admin Audit Log and Diagnostics are module tabs", ['"/finance/audit"', '"/admin/audit"', '"/admin/system-health"'].every((t) => shell.includes(t)));

// 2. Financial year 1 Sep – 31 Aug.
const fy = read("lib/financialYear.ts");
check("Financial year starts in September", fy.includes("FY_START_MONTH = 8"));
check("Backup, Print Register and Finance use the IET financial year", read("app/api/backup/export/route.ts").includes("fyBounds") && read("app/requests/printable/page.tsx").includes("fyStartYear") && read("app/finance/page.tsx").includes("fyStartYear"));

// 3. One loading bar.
const css = read("app/globals.css");
check("One loading bar: the top stripe animates; the second strip is retired", css.includes("html.rg-busy body::before") && read("app/components/ActivityStrip.tsx").includes('classList.toggle("rg-busy"'));

// 4. Checked by.
const rp = read("app/requests/[id]/print/page.tsx");
check("'Checked by' falls back to the Account Officer when no reviewer step exists", rp.includes("checkedHistory || (isPersonal ? hrHistory : null) || hrHistory || accountHistory") && rp.includes("checkedReady = isOfficial ? !!checkedLine.name && !!checkedLine.sigUrl"));

// 5. Setup guide.
check("Setup Guide password step only for temporary passwords; green ready bar", read("lib/profileSetup.ts").includes("!meta.temporary_password") && read("app/api/admin/users/route.ts").includes("temporary_password: true") && read("app/components/SetupCoach.tsx").includes("is-complete"));

// 6. No browser notifications.
const browserNotify = files.filter((f) => /new Notification\(|Notification\.requestPermission/.test(read(f)));
check("Notifications stay inside the app (no browser notifications)", browserNotify.length === 0, browserNotify.join(", "));

let failed = 0;
for (const r of results) { if (!r.ok) failed++; console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.label}${!r.ok && r.detail ? " — " + r.detail : ""}`); }
if (failed) { console.error(`\nv3.1.10 release lock: ${failed} failure(s).`); process.exit(1); }
console.log(`\nv3.1.10 release lock: PASS (${results.length} checks).`);
