import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const findings = [];
function check(name, ok, detail) { findings.push({ name, ok: Boolean(ok), detail }); }

const request = read("app/components/requests/RequestDetailsWorkspace.tsx");
const navigation = read("lib/navigation.ts");
const roles = read("lib/roles.ts");
const integritySql = read("database/20260924_phase6_workflow_integrity_guard.sql");
const authoritySql = read("database/20260924_phase7_subhead_authority_guard.sql");
const pkg = JSON.parse(read("package.json"));

const authorityBlock = request.slice(
  request.indexOf("const canAssignSubhead"),
  request.indexOf("const selectedAssignableSubhead")
);

for (const role of ["director", "dinadmin", "hod", "registrar", "hr"]) {
  check(`Subhead authority includes ${role}`, authorityBlock.includes(`\"${role}\"`), `Expected ${role} in exact UI authority set.`);
}
for (const forbidden of ["dg", "admin", "auditor", "account", "accountofficer"]) {
  check(`Subhead authority excludes ${forbidden}`, !authorityBlock.includes(`\"${forbidden}\"`), `${forbidden} must not be able to assign subheads.`);
}
check("Subhead authority uses active role", /activeRoleKey/.test(authorityBlock), "Privilege decision must use the active role, not merely any assigned role.");
check("Subhead authority requires current ownership", /current_owner\s*===\s*me\.id/.test(authorityBlock), "Only the current workflow owner may assign the subhead.");
check("DG entry is blocked without subhead", /current_stage[\s\S]*DG[\s\S]*subhead_id is null/i.test(integritySql), "Database trigger must reject official requests reaching DG without subhead.");
check("Database subhead authority trigger exists", /trg_reqgen_subhead_assignment_authority/.test(authoritySql), "Server-side role guard must be shipped as a migration.");
check("Database role allow-list excludes DG", !/not in \([^)]*'dg'/.test(authoritySql), "DG must not be in the DB allow-list.");
check("HOD is a canonical runtime role", /\| \"hod\"/.test(roles), "HOD must be represented in the role model.");
check("General Secretary alias normalized", /gensec/.test(roles) && /generalsecretary/.test(roles), "Legacy gensec should normalize to canonical General Secretary.");
check("Standalone HR absent from user navigation", !navigation.includes('href: "/hr"'), "HR remains a role, not a visible module.");
check("Standalone Workflow absent from user navigation", !navigation.includes('href: "/workflow"'), "Workflow UI remains hidden; workflow engine/history are preserved.");
check("Reports are not exposed to DG", /REPORT_ACCESS_ROLES = \[\"admin\", \"auditor\"\]/.test(roles), "Reports must remain Admin + Auditor only.");
check("Missing Section 4 audit restored", fs.existsSync(path.join(root, "scripts/audit-section4-lock.mjs")), "package.json references audit:section4; implementation must exist.");
check("Production audit command exists", Boolean(pkg.scripts?.["audit:production"]), "A consolidated architecture audit command is required.");

const failed = findings.filter((item) => !item.ok);
const report = { generatedAt: new Date().toISOString(), checks: findings.length, passed: findings.length - failed.length, failed: failed.length, findings };
fs.mkdirSync(path.join(root, "audit-output"), { recursive: true });
fs.writeFileSync(path.join(root, "audit-output/phase7-architecture-audit.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ checks: report.checks, passed: report.passed, failed: report.failed }, null, 2));
if (failed.length) {
  for (const item of failed) console.error(`FAIL ${item.name}: ${item.detail}`);
  process.exitCode = 1;
}
