/**
 * ReqGen RBAC matrix audit (Phase 3).
 *
 * This is an INDEPENDENT test. The expected access rules below come from the
 * Global Stabilisation Roadmap (Phase 3), NOT from lib/permissions.ts. The
 * script then checks every real page route against every canonical role and
 * fails if the implementation in lib/permissions.ts disagrees with the rules.
 *
 * It also fails if any real page is neither public nor covered by a rule, so a
 * new page can never silently ship with unrestricted access.
 *
 * Run:  node scripts/audit-rbac-matrix.mjs
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];
const fail = (msg) => failures.push(msg);

/* ------------------------------------------------------------------ */
/* 1. Read the real implementation (lib/permissions.ts) as data        */
/* ------------------------------------------------------------------ */
const permSrc = fs.readFileSync(path.join(root, "lib/permissions.ts"), "utf8");

const publicBlock = permSrc.match(/PUBLIC_PATHS\s*=\s*\[([\s\S]*?)\]/);
if (!publicBlock) throw new Error("Could not find PUBLIC_PATHS in lib/permissions.ts");
const PUBLIC_PATHS = [...publicBlock[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);

const policyBlock = permSrc.match(/ROUTE_POLICIES:\s*RoutePolicy\[\]\s*=\s*\[([\s\S]*?)\n\];/);
if (!policyBlock) throw new Error("Could not find ROUTE_POLICIES in lib/permissions.ts");
const POLICIES = [...policyBlock[1].matchAll(/\{([^{}]*?)\}/g)]
  .map((m) => m[1])
  .filter((body) => /prefix\s*:/.test(body))
  .map((body) => ({
    prefix: body.match(/prefix\s*:\s*"([^"]+)"/)[1],
    authenticatedOnly: /authenticatedOnly\s*:\s*true/.test(body),
    roles: (body.match(/roles\s*:\s*\[([^\]]*)\]/)?.[1].match(/"([^"]+)"/g) || []).map((s) => s.replace(/"/g, "")),
  }));

const declaredPrefixCount = (policyBlock[1].match(/prefix\s*:/g) || []).length;
if (POLICIES.length !== declaredPrefixCount) {
  fail(`Parsed ${POLICIES.length} policies but the file declares ${declaredPrefixCount}; the audit parser is out of date.`);
}
// Guard: the audit mirrors the real matching logic. If that logic changes, this must be updated.
if (!permSrc.includes("b.prefix.length - a.prefix.length")) {
  fail("lib/permissions.ts no longer uses longest-prefix matching; update this audit's canAccess().");
}

const normalizeRole = (value) => {
  const n = String(value || "").trim().toLowerCase().replace(/[^a-z0-9:]+/g, "");
  if (n === "deanadmin") return "dinadmin";
  if (n === "gensec") return "generalsecretary";
  return n;
};

function policyFor(pathname) {
  return (
    POLICIES.slice()
      .sort((a, b) => b.prefix.length - a.prefix.length)
      .find((p) => pathname === p.prefix || pathname.startsWith(`${p.prefix}/`)) || null
  );
}

function actualAccess(pathname, role) {
  if (PUBLIC_PATHS.includes(pathname)) return true;
  const policy = policyFor(pathname);
  if (!policy) return true; // mirrors canAccessPath(): no policy => allowed
  if (policy.authenticatedOnly) return true;
  if (!policy.roles.length) return true;
  return policy.roles.map(normalizeRole).includes(normalizeRole(role));
}

/* ------------------------------------------------------------------ */
/* 2. Expected access, from the Roadmap (independent of the code)      */
/* ------------------------------------------------------------------ */
const ROLES = [
  "staff", "hod", "director", "dg", "hr", "generalsecretary", "dinadmin",
  "registrar", "accountofficer", "pvsigner", "pvcountersigner", "auditor", "admin",
];
const EVERYONE = ROLES;

// Longest matching prefix wins, exactly like the real policy engine.
const EXPECTED = [
  { prefix: "/admin/security", allow: ["admin", "auditor"] },
  { prefix: "/admin", allow: ["admin"] },
  { prefix: "/audit-centre", allow: ["admin", "auditor"] },
  { prefix: "/workflow", allow: ["admin", "auditor"] }, // redirect-only stub
  { prefix: "/reports", allow: ["admin", "auditor"] }, // DG has no access (Roadmap)
  { prefix: "/output", allow: ["admin", "auditor"] },
  { prefix: "/test-supabase", allow: ["admin"] },
  { prefix: "/finance", allow: ["admin", "auditor", "accountofficer"] }, // PV signing must NOT grant Finance
  { prefix: "/payment-vouchers/settings", allow: ["admin", "auditor"] },
  { prefix: "/payment-vouchers", allow: ["admin", "auditor", "accountofficer", "pvsigner", "pvcountersigner"] },
  { prefix: "/registry", allow: ["admin", "auditor", "registrar"] },
  { prefix: "/dashboard", allow: EVERYONE },
  { prefix: "/requests", allow: EVERYONE },
  { prefix: "/approvals", allow: EVERYONE },
  { prefix: "/profile", allow: EVERYONE },
  { prefix: "/notifications", allow: EVERYONE },
  { prefix: "/change-password", allow: EVERYONE },
  { prefix: "/about", allow: EVERYONE },
  { prefix: "/docs", allow: EVERYONE },
];

function expectedAccess(pathname, role) {
  if (PUBLIC_PATHS.includes(pathname)) return true;
  const rule = EXPECTED.slice()
    .sort((a, b) => b.prefix.length - a.prefix.length)
    .find((r) => pathname === r.prefix || pathname.startsWith(`${r.prefix}/`));
  if (!rule) return null; // unclassified
  return rule.allow.includes(role);
}

/* ------------------------------------------------------------------ */
/* 3. Discover every real page route                                    */
/* ------------------------------------------------------------------ */
function findPages(dir, base = "") {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "api" || entry.name.startsWith("_")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const segment = /^\(.*\)$/.test(entry.name) ? "" : `/${entry.name}`;
      out.push(...findPages(full, base + segment));
    } else if (entry.name === "page.tsx") {
      out.push(base || "/");
    }
  }
  return out;
}
const routes = findPages(path.join(root, "app"))
  .map((r) => r.replace(/\[[^\]]+\]/g, "sample"))
  .sort();

/* ------------------------------------------------------------------ */
/* 4a. Every non-public page MUST have an explicit policy               */
/*     (no policy => canAccessPath() allows it with no login required)  */
/* ------------------------------------------------------------------ */
for (const route of routes) {
  if (!PUBLIC_PATHS.includes(route) && !policyFor(route)) {
    fail(`NO POLICY for ${route}: it is not public and has no rule, so it is reachable without any restriction.`);
  }
}

/* ------------------------------------------------------------------ */
/* 4b. Compare every route x role                                       */
/* ------------------------------------------------------------------ */
const matrix = {};
let cells = 0;
for (const route of routes) {
  matrix[route] = {};
  for (const role of ROLES) {
    const expected = expectedAccess(route, role);
    if (expected === null) {
      fail(`UNCLASSIFIED route (no roadmap rule and not public): ${route}`);
      break;
    }
    const actual = actualAccess(route, role);
    matrix[route][role] = actual;
    cells += 1;
    if (actual !== expected) {
      fail(`MISMATCH ${route} for role "${role}": roadmap says ${expected ? "ALLOW" : "DENY"}, implementation says ${actual ? "ALLOW" : "DENY"}`);
    }
  }
}

/* ------------------------------------------------------------------ */
/* 5. Extra invariants                                                  */
/* ------------------------------------------------------------------ */
for (const removed of ["/hr", "/staff", "/executive", "/erp-2"]) {
  if (POLICIES.some((p) => p.prefix === removed || p.prefix.startsWith(`${removed}/`))) {
    fail(`Stale policy for removed module still present: ${removed}`);
  }
}
for (const p of POLICIES) {
  const stillExists = routes.some((r) => r === p.prefix || r.startsWith(`${p.prefix}/`));
  if (!stillExists) fail(`Stale policy (no real page under it): ${p.prefix}`);
}
const rolesSrc = fs.readFileSync(path.join(root, "lib/roles.ts"), "utf8");
const reportRoles = rolesSrc.match(/REPORT_ACCESS_ROLES\s*=\s*\[([^\]]*)\]/)?.[1].match(/"([^"]+)"/g)?.map((s) => s.replace(/"/g, "")) || [];
if (reportRoles.slice().sort().join(",") !== "admin,auditor") {
  fail(`REPORT_ACCESS_ROLES must be exactly admin + auditor, found: ${reportRoles.join(", ")}`);
}

/* ------------------------------------------------------------------ */
/* 6. Write the matrix report                                           */
/* ------------------------------------------------------------------ */
const sections = [
  "/dashboard", "/requests", "/approvals", "/profile", "/finance", "/payment-vouchers",
  "/payment-vouchers/settings", "/registry", "/reports", "/audit-centre", "/admin", "/admin/security",
];
const lines = [
  "# ReqGen RBAC access matrix (generated)",
  "",
  `Routes checked: ${routes.length} · Roles: ${ROLES.length} · Cells compared: ${cells} · Failures: ${failures.length}`,
  "",
  "| Section | " + ROLES.join(" | ") + " |",
  "|---|" + ROLES.map(() => ":-:").join("|") + "|",
  ...sections.map((s) => `| ${s} | ` + ROLES.map((r) => (actualAccess(s, r) ? "✔" : "✘")).join(" | ") + " |"),
  "",
];
fs.mkdirSync(path.join(root, "audit-output"), { recursive: true });
fs.writeFileSync(path.join(root, "audit-output/rbac-matrix.md"), lines.join("\n"));
fs.writeFileSync(path.join(root, "audit-output/rbac-matrix.json"), JSON.stringify(matrix, null, 2));

console.log(`RBAC matrix audit: ${routes.length} routes x ${ROLES.length} roles = ${cells} access decisions compared against the Roadmap.`);
if (failures.length) {
  console.error(`FAILED (${failures.length}):`);
  failures.forEach((f) => console.error(" - " + f));
  process.exit(1);
}
console.log("PASS — every route/role decision matches the Roadmap; no unclassified routes; no stale policies.");
