// ReqGen v3.0.4 — Request privacy lock.
// Fails if any page could expose request CONTENT outside the privacy rule.
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const walk = (dir) => fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((d) =>
  d.isDirectory() ? walk(path.join(dir, d.name)) : /\.(tsx?|mjs)$/.test(d.name) ? [path.join(dir, d.name)] : []);
const results = [];
const check = (label, ok, detail = "") => results.push({ label, ok: Boolean(ok), detail });

// 1. No org-wide full-row reads of requests or request_history (server API routes use the service key and are exempt).
const clientFiles = walk("app").filter((f) => !f.startsWith(path.join("app", "api")));
const wildcard = clientFiles.filter((f) => /from\("requests"\)\s*\.select\("\*"\)|from\("request_history"\)\s*\.select\("\*"\)/.test(read(f)));
check("No page reads every column of requests/request_history", wildcard.length === 0, wildcard.join(", "));

// 2. Oversight pages use the content-free registers.
for (const f of ["app/components/registry/RegistryCentreWorkspace.tsx", "app/finance/overview/page.tsx"]) {
  check(`${f} uses the content-free register`, /fetchRequest(Register|Movements)\(/.test(read(f)));
}
// v4.5: the Audit Log reads reqgen_audit_events (who, what, which number, when) and never the requests table.
check("app/audit-centre/logs/page.tsx uses the content-free audit events", read("app/audit-centre/logs/page.tsx").includes('rpc("reqgen_audit_events"') && !/from\("(requests|request_history)"\)/.test(read("app/audit-centre/logs/page.tsx")));
// v4.4: report pages never read requests directly; the database scopes them (titles only for your own).
const reportPages = fs.readdirSync("app/reports", { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => `app/reports/${d.name}/page.tsx`).filter((f) => fs.existsSync(f));
for (const f of reportPages) check(`${f} reads no request contents directly`, !/from\("(requests|request_history)"\)/.test(read(f)));

// 3. Every page that shows full request content is behind the access gate.
for (const f of ["app/requests/[id]/page.tsx", "app/requests/[id]/edit/page.tsx", "app/requests/[id]/print/page.tsx", "app/finance/request/[id]/page.tsx"]) {
  check(`${f} is wrapped in RequestAccessGate`, read(f).includes("<RequestAccessGate"));
}
// v4.1: the approvals list shows no request contents itself; it only links to the gated record page.
{
  const inbox = read("app/approvals/inbox/page.tsx");
  check("app/approvals/inbox/page.tsx links only to the gated record page", inbox.includes("href: `/requests/${r.id}`") && !inbox.includes("RequestDetailsWorkspace"));
}

// 4. No oversight bypass (IET decision, v3.0.4).
check("No role bypasses the request privacy rule", read("lib/requestAccess.ts").includes("REQUEST_OVERSIGHT_ROLES = new Set<string>([])"));
check("Approvals list has no oversight bypass", read("lib/approvalQueue.ts").includes("OVERSIGHT_ROLES = new Set<string>([])"));

// 5. The register never selects content columns.
const reg = read("lib/requestRegister.ts");
const cols = [...reg.matchAll(/_COLUMNS =\s*"([^"]+)"/g)].map((m) => m[1]).join(",");
const leaked = ["title", "details", "comment", "requester_comment", "signature_url"].filter((c) => cols.split(",").includes(c));
check("Content-free registers contain no content columns", leaked.length === 0, leaked.join(", "));

// 6. Database migration present and guarded.
const sql = read("database/v3_0_4_request_privacy.sql");
check("Privacy migration has an abort-if-unsafe pre-flight", sql.includes("STOPPED — nothing was changed"));
check("Privacy migration runs as one transaction", /\nbegin;[\s\S]*\ncommit;/.test(sql));

let failed = 0;
for (const r of results) {
  if (!r.ok) failed += 1;
  console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.label}${!r.ok && r.detail ? ` — ${r.detail}` : ""}`);
}
if (failed) { console.error(`\nRequest privacy lock: ${failed} failure(s).`); process.exit(1); }
console.log(`\nRequest privacy lock: PASS (${results.length} checks).`);
