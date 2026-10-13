// ReqGen v4.6.0 — list source files no page, layout or API route uses any more.
//
//   node scripts/cleanup-unused.mjs              lists them (nothing is changed)
//   node scripts/cleanup-unused.mjs --delete YES deletes the listed files
//
// Files still read by an audit script, Next.js special files and the route / navigation
// registries are never listed. Run the whole check again after deleting:
//   npm run lint && npm run typecheck && npm run build && npm run audit:deploy
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
  const p = path.join(dir, e.name);
  if (e.isDirectory()) return e.name === "node_modules" || e.name.startsWith(".") ? [] : walk(p);
  return /\.(tsx?|css)$/.test(e.name) ? [path.relative(root, p)] : [];
});
const files = ["app", "lib"].flatMap((d) => walk(path.join(root, d))).map((f) => f.split(path.sep).join("/"));
const src = Object.fromEntries(files.map((f) => [f, fs.readFileSync(f, "utf8")]));
for (const f of ["middleware.ts", "proxy.ts", "instrumentation.ts", "next.config.ts"]) if (fs.existsSync(f)) src[f] = fs.readFileSync(f, "utf8");

const ENTRY = /(^|\/)(page|layout|route|loading|error|not-found|template|default|global-error|manifest|sitemap|robots|icon|opengraph-image)\.tsx?$/;
const KEEP = new Set(["lib/routeRegistry.ts", "lib/navigation.ts", "lib/pageArchitecture.ts", "lib/accessMatrix.ts", "middleware.ts", "proxy.ts"]);
const IMPORT = /(?:import|from|require\(|import\()\s*['"]([^'"]+)['"]/g;
const resolve = (base, spec) => {
  let p;
  if (spec.startsWith("@/")) p = spec.slice(2);
  else if (spec.startsWith(".")) p = path.posix.normalize(path.posix.join(path.posix.dirname(base), spec));
  else return null;
  return [p, `${p}.ts`, `${p}.tsx`, `${p}/index.ts`, `${p}/index.tsx`].find((c) => c in src) || null;
};

const seen = new Set(Object.keys(src).filter((f) => ENTRY.test(f) || KEEP.has(f)));
const stack = [...seen];
while (stack.length) {
  const f = stack.pop();
  for (const m of src[f].matchAll(IMPORT)) {
    const r = resolve(f, m[1]);
    if (r && !seen.has(r)) { seen.add(r); stack.push(r); }
  }
}

const auditText = fs.readdirSync("scripts").filter((f) => f.endsWith(".mjs") && f !== "cleanup-unused.mjs").map((f) => fs.readFileSync(path.join("scripts", f), "utf8")).join("\n");
const unused = files.filter((f) => !seen.has(f));
const stillAudited = unused.filter((f) => auditText.includes(f) || auditText.includes(path.posix.basename(f)));
const removable = unused.filter((f) => !stillAudited.includes(f));

console.log(`Not used by any page or route: ${unused.length} file(s).`);
console.log(`\nSafe to delete (${removable.length}):`);
removable.forEach((f) => console.log(`  ${f}`));
console.log(`\nKept for now — an older release audit still reads them (${stillAudited.length}):`);
stillAudited.forEach((f) => console.log(`  ${f}`));

if (process.argv[2] === "--delete") {
  if (process.argv[3] !== "YES") { console.error("\nNothing deleted. To delete, type: node scripts/cleanup-unused.mjs --delete YES"); process.exit(1); }
  removable.forEach((f) => fs.rmSync(f));
  console.log(`\nDeleted ${removable.length} file(s). Now run: npm run lint && npm run typecheck && npm run build && npm run audit:deploy`);
}
