import fs from "node:fs";

const shell = fs.readFileSync("app/components/GovernmentAppShell.tsx", "utf8");
const css = fs.readFileSync("app/globals.css", "utf8");
const version = fs.readFileSync("lib/version.ts", "utf8");
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
const failures = [];

const requiredNav = ["Dashboard", "Requests", "Approvals", "Finance", "Payment Vouchers", "Registry", "Reports", "Audit Centre", "Admin", "Profile"];
for (const label of requiredNav) if (!shell.includes(`label: "${label}"`)) failures.push(`Missing locked navigation item: ${label}`);
if (shell.includes('{ href: "/payment-vouchers/new", label: "Create Voucher" }')) failures.push("Create Voucher must not appear in module tabs.");

// v3.0.1 navigation standard: flat sidebar + numbered in-page module tabs.
if (shell.includes('className="rg-subnav"')) failures.push("Collapsible sidebar sub-menus are retired; use in-page module tabs.");
if (!shell.includes("function ModuleTabs(")) failures.push("ModuleTabs component (numbered in-page tabs) is missing.");
if (!shell.includes("<ModuleTabs")) failures.push("ModuleTabs is not rendered inside the main workspace.");
if (!css.includes(".rg-module-tabs{")) failures.push("Module tab styles are missing.");
if (!css.includes(".rg-nav-link span{font-size:13px!important")) failures.push("Main navigation typography lock (13px) is missing.");

// Greeting standard: icons (not emoji) and the user's name.
if (/Good (Morning|Afternoon|Evening) [\u{1F300}-\u{1FAFF}\u2600-\u27BF]/u.test(shell)) failures.push("Greeting must use icons, not emoji.");
if (!shell.includes("rg-greeting-name")) failures.push("Greeting must include the user's name.");

// Version standard: one source of truth, v-prefixed three-part SemVer.
const semver = version.match(/REQGEN_SEMVER = "(\d+\.\d+\.\d+)"/)?.[1];
if (!semver) failures.push("lib/version.ts must define REQGEN_SEMVER as MAJOR.MINOR.PATCH.");
if (semver && pkg.version !== semver) failures.push(`package.json version (${pkg.version}) must equal REQGEN_SEMVER (${semver}).`);
if (semver && pkg.reqgenVersion !== `v${semver}`) failures.push(`package.json reqgenVersion must be v${semver}.`);

if (failures.length) {
  console.error("Shell architecture lock: FAIL");
  failures.forEach((f) => console.error(`- ${f}`));
  process.exit(1);
}
console.log("Shell architecture lock: PASS");
console.log(`Flat sidebar; numbered in-page module tabs; icon greeting with name; version v${semver} consistent.`);
