import fs from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();
const appRoot = path.join(projectRoot, "app");
const permissionsFile = path.join(projectRoot, "lib", "permissions.ts");

const sensitiveRoots = [
  "/admin",
  "/audit-centre",
  "/workflow",
  "/finance",
  "/payment-vouchers",
  "/hr",
  "/registry",
  "/reports",
];

function walk(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) return walk(full);
    return [full];
  });
}

function routeFromPage(file) {
  const relative = path.relative(appRoot, path.dirname(file));
  if (!relative || relative === ".") return "/";
  return `/${relative.split(path.sep).join("/")}`;
}

function matchesPrefix(route, prefix) {
  return route === prefix || route.startsWith(`${prefix}/`);
}

const permissionsSource = fs.readFileSync(permissionsFile, "utf8");
const policyPrefixes = [...permissionsSource.matchAll(/prefix:\s*["']([^"']+)["']/g)]
  .map((match) => match[1])
  .sort((a, b) => b.length - a.length);

const pageFiles = walk(appRoot).filter((file) => file.endsWith(`${path.sep}page.tsx`));
const routes = pageFiles.map(routeFromPage).sort();
const duplicateRoutes = routes.filter((route, index) => routes.indexOf(route) !== index);

const unclassifiedSensitiveRoutes = routes.filter((route) => {
  const sensitive = sensitiveRoots.some((root) => matchesPrefix(route, root));
  const classified = policyPrefixes.some((prefix) => matchesPrefix(route, prefix));
  return sensitive && !classified;
});

const policyConflicts = policyPrefixes.filter(
  (prefix, index) => policyPrefixes.indexOf(prefix) !== index
);

const report = {
  generatedAt: new Date().toISOString(),
  totalPages: routes.length,
  sensitiveRoots,
  policyPrefixes,
  duplicateRoutes: [...new Set(duplicateRoutes)],
  duplicatePolicyPrefixes: [...new Set(policyConflicts)],
  unclassifiedSensitiveRoutes,
  routes,
};

const outputDir = path.join(projectRoot, "audit-output");
fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(
  path.join(outputDir, "route-audit.json"),
  JSON.stringify(report, null, 2)
);

console.log(`ReqGen route audit completed: ${routes.length} page routes inspected.`);
console.log(`Route policies detected: ${policyPrefixes.length}`);
console.log(`Duplicate routes: ${report.duplicateRoutes.length}`);
console.log(`Duplicate policy prefixes: ${report.duplicatePolicyPrefixes.length}`);
console.log(`Unclassified sensitive routes: ${report.unclassifiedSensitiveRoutes.length}`);
console.log("Report: audit-output/route-audit.json");

if (
  report.duplicateRoutes.length ||
  report.duplicatePolicyPrefixes.length ||
  report.unclassifiedSensitiveRoutes.length
) {
  process.exitCode = 1;
}
