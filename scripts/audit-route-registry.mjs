import fs from "node:fs";
import path from "node:path";

const appRoot = path.resolve("app");
const registryFile = path.resolve("lib/routeRegistry.ts");

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name === "page.tsx") out.push(full);
  }
  return out;
}

function routeFromFile(file) {
  const rel = path.relative(appRoot, path.dirname(file)).replaceAll(path.sep, "/");
  return rel ? `/${rel}` : "/";
}

const source = fs.readFileSync(registryFile, "utf8");
const pageRoutes = walk(appRoot).map(routeFromFile).sort();
const registered = [...source.matchAll(/"pattern":\s*"([^"]+)"/g)].map((m) => m[1]).sort();
const pageSet = new Set(pageRoutes);
const registrySet = new Set(registered);
const missing = pageRoutes.filter((route) => !registrySet.has(route));
const stale = registered.filter((route) => !pageSet.has(route));

const result = {
  checkedAt: new Date().toISOString(),
  pageRouteCount: pageRoutes.length,
  registryRouteCount: registered.length,
  missingFromRegistry: missing,
  staleRegistryEntries: stale,
  ok: missing.length === 0 && stale.length === 0,
};

fs.mkdirSync("audit-output", { recursive: true });
fs.writeFileSync("audit-output/route-registry-audit.json", JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exit(1);
