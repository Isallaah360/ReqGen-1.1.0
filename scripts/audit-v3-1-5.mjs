// ReqGen v3.1.5 — release lock: in-app dialogs, Signature Ink Engine,
// one approval-queue rule, and the voucher signer SQL repair.
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (f) => fs.readFileSync(path.join(root, f), "utf8");
const exists = (f) => fs.existsSync(path.join(root, f));
const walk = (dir, exts) => fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((d) =>
  d.isDirectory() ? (d.name === "node_modules" || d.name.startsWith(".") ? [] : walk(path.join(dir, d.name), exts))
    : exts.some((e) => d.name.endsWith(e)) ? [path.join(dir, d.name)] : []);
const results = [];
const check = (label, ok, detail = "") => results.push({ label, ok: Boolean(ok), detail });

// 1. No native browser dialogs anywhere in the app.
const nativeDialog = /(^|[^A-Za-z0-9_$.])(?:window\s*\.\s*)?(confirm|alert|prompt)\s*\(/m;
const sources = [...walk("app", [".ts", ".tsx"]), ...walk("lib", [".ts", ".tsx"])];
const dialogOffenders = sources.filter((f) => {
  const text = read(f).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  return nativeDialog.test(text);
});
check("No native browser dialogs (window.confirm / alert / prompt)", dialogOffenders.length === 0, dialogOffenders.join(", "));
check("In-app DialogHost is mounted in the root layout", read("app/layout.tsx").includes("<DialogHost />"));
check("Dialog service exists (lib/dialog.ts)", exists("lib/dialog.ts") && read("lib/dialog.ts").includes("export async function confirmDialog"));

// 2. Signatures always go through the Signature Ink Engine.
const sigPages = ["app/requests/[id]/print/page.tsx", "app/payment-vouchers/[id]/print/page.tsx", "app/profile/page.tsx"];
for (const f of sigPages) {
  const text = read(f);
  check(`${f}: signatures use <SignatureInk> inside .rg-sig-slot`, text.includes("<SignatureInk") && text.includes("rg-sig-slot"));
  check(`${f}: no raw <Image>/<img> for a signature`, !/<(Image|img)[^>]*alt=["{][^>]*ignature/s.test(text));
}
check("Profile upload removes the paper background", read("app/profile/page.tsx").includes("cleanSignatureFile"));
check("Signature slot CSS outranks generic img rules", /html body \.rg-sig-slot>img\.rg-sig-img\{[^}]*height:100%!important/.test(read("app/globals.css")));

// 3. One approval-queue rule everywhere.
const approvals = read("app/approvals/page.tsx");
check("Approvals 'waiting' list uses isAwaitingUser", approvals.includes("rows.filter((row) => isAwaitingUser(row, userId, activeRole))"));
check("Approvals no longer uses stage-only visibility", !approvals.includes("isVisibleInApprovals"));
check("Process screen canAct uses isAwaitingUser", read("app/components/requests/RequestDetailsWorkspace.tsx").includes("return isAwaitingUser(req, me.id"));
check("Access gate reads both Account Officer columns", read("app/components/requests/RequestAccessGate.tsx").includes("assigned_account_officer_user_id"));
check("Bell badge uses the same rule", read("app/components/GovernmentAppShell.tsx").includes("isAwaitingUser(row"));

// 4. SQL repair shipped with a verification table.
const sqlFile = "database/v3_1_5_voucher_signer_and_queue_repair.sql";
check("Voucher signer SQL repair is present", exists(sqlFile));
if (exists(sqlFile)) {
  const sql = read(sqlFile);
  check("SQL backs up original function definitions", sql.includes("reqgen_function_backups"));
  check("SQL uses a lock timeout", sql.includes("lock_timeout"));
  check("SQL ends with a verification table", sql.includes("check_item") && sql.includes("'OK'"));
}

let failed = 0;
for (const r of results) { if (!r.ok) failed++; console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.label}${!r.ok && r.detail ? " — " + r.detail : ""}`); }
if (failed) { console.error(`\nv3.1.5 release lock: ${failed} failure(s).`); process.exit(1); }
console.log(`\nv3.1.5 release lock: PASS (${results.length} checks).`);
