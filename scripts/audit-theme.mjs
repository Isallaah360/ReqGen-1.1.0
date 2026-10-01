// ReqGen v3.0.6 — Theme & design-standard lock.
import fs from "node:fs";
import path from "node:path";
const root = process.cwd();
const walk = (dir, ext) => fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((d) =>
  d.isDirectory() ? walk(path.join(dir, d.name), ext) : d.name.endsWith(ext) ? [path.join(dir, d.name)] : []);
const results = [];
const check = (label, ok, detail = "") => results.push({ label, ok: Boolean(ok), detail });

const generated = fs.readFileSync(path.join(root, "app/theme-dark.generated.css"), "utf8");
const defined = new Set([...generated.matchAll(/(--c-(?:bg|fg|ln)-[0-9a-f]{6,8}):/g)].map((m) => m[1]));
const used = new Set();
for (const f of walk("app", ".css")) {
  if (f.endsWith("theme-dark.generated.css") || f.endsWith("theme-dark.css")) continue;
  const css = fs.readFileSync(path.join(root, f), "utf8");
  for (const m of css.matchAll(/var\((--c-(?:bg|fg|ln)-[0-9a-f]{6,8}),/g)) used.add(m[1]);
}
const missing = [...used].filter((v) => !defined.has(v));
check("Every themed colour has a dark value (run `npm run theme:build` after CSS changes)", missing.length === 0, missing.slice(0, 5).join(", "));

const layout = fs.readFileSync(path.join(root, "app/layout.tsx"), "utf8");
check("Dark theme stylesheets are loaded", layout.includes("./theme-dark.generated.css") && layout.includes("./theme-dark.css"));
check("Theme is applied before first paint (no white flash)", layout.includes("THEME_BOOT_SCRIPT"));
check("Theme switch is in the top bar", fs.readFileSync(path.join(root, "app/components/GovernmentAppShell.tsx"), "utf8").includes("<ThemeToggle"));

const emoji = /[\u2705\u274C\u26D4\u2B50]|[\u{1F300}-\u{1FAFF}]|\u26A0\uFE0F|\u2139\uFE0F/u;
const allowIconMap = "app/finance/_components/FinancePageFrame.tsx"; // maps legacy emoji → line icons
const offenders = walk("app", ".tsx").filter((f) => f !== allowIconMap && !f.startsWith(path.join("app", "finance")) && emoji.test(fs.readFileSync(path.join(root, f), "utf8")));
check("No emoji in the interface (use line icons / ✓ ✕ ⚠)", offenders.length === 0, offenders.slice(0, 5).join(", "));

const fonts = new Set();
for (const f of walk("app", ".css")) for (const m of fs.readFileSync(path.join(root, f), "utf8").matchAll(/font-family\s*:\s*([^;}!]+)/g)) {
  const v = m[1].trim().replace(/\s+/g, " ");
  if (!/^(inherit|var\(--rg3-font)/.test(v) && !/^Aptos/.test(v)) fonts.add(v.slice(0, 40));
}
check("One font family system-wide (Aptos stack via --rg3-font)", fonts.size === 0, [...fonts].join(" | "));

let failed = 0;
for (const r of results) { if (!r.ok) failed++; console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.label}${!r.ok && r.detail ? " — " + r.detail : ""}`); }
if (failed) { console.error(`\nTheme lock: ${failed} failure(s).`); process.exit(1); }
console.log(`\nTheme lock: PASS (${results.length} checks).`);
