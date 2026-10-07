// ReqGen v3.1.11 — release lock: scannable authenticator QR, one-page Routing Engine.
import fs from "node:fs";
const read = (f) => fs.readFileSync(f, "utf8");
const results = [];
const check = (label, ok) => results.push({ label, ok: Boolean(ok) });

const qr = read("app/components/AuthenticatorQr.tsx");
check("QR drawn by ReqGen from the otpauth URI (black on white, quiet zone)", qr.includes("QRCode.toDataURL(uri") && qr.includes("margin: 4") && qr.includes('dark: "#000000"'));
for (const f of ["app/mfa/setup/page.tsx", "app/profile/security/replace-authenticator/page.tsx"]) {
  const s = read(f);
  check(`${f}: uses AuthenticatorQr, no injected qr_code HTML`, s.includes("<AuthenticatorQr") && !/__html:\s*qrCode/.test(s));
}
const page = read("app/admin/routing/page.tsx");
check("Routing Engine page saves through reqgen_save_department_route", page.includes('rpc("reqgen_save_department_route"'));
check("Routing Engine: ON/OFF per stage per request type, officer per stage, live route", page.includes('role="switch"') && page.includes("OFFICER_STAGES") && page.includes("Exact route for new requests"));
check("Routing Engine is the Admin tab", read("app/components/GovernmentAppShell.tsx").includes('{ href: "/admin/routing", label: "Routing Engine" }'));
const sql = read("database/v3_1_11_routing_engine_v2.sql");
check("SQL: department officers first, versioned routes, rules via reqgen_save_route", sql.includes("reqgen_department_stage_officers") && sql.includes("_V") && sql.includes("perform public.reqgen_save_route("));

let failed = 0;
for (const r of results) { if (!r.ok) failed++; console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.label}`); }
if (failed) { console.error(`\nv3.1.11 release lock: ${failed} failure(s).`); process.exit(1); }
console.log(`\nv3.1.11 release lock: PASS (${results.length} checks).`);
