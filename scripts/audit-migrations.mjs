import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const candidates = [path.join(root, "supabase", "migrations"), path.join(root, "database", "migrations")];
const files = [];
for (const dir of candidates) {
  if (!fs.existsSync(dir)) continue;
  for (const name of fs.readdirSync(dir).filter((n) => n.endsWith(".sql")).sort()) {
    const full = path.join(dir, name);
    const sql = fs.readFileSync(full, "utf8");
    files.push({
      file: path.relative(root, full),
      bytes: Buffer.byteLength(sql),
      createsTables: [...sql.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?([a-zA-Z0-9_]+)/gi)].map((m) => m[1]),
      createsFunctions: [...sql.matchAll(/create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?([a-zA-Z0-9_]+)/gi)].map((m) => m[1]),
      createsPolicies: [...sql.matchAll(/create\s+policy\s+([a-zA-Z0-9_]+)/gi)].map((m) => m[1]),
    });
  }
}
const warnings = [];
if (files.length === 0) warnings.push("No local migration directory was found. Record already-applied SQL manually in docs/DATABASE_MIGRATION_REGISTER.md.");
const report = { generatedAt: new Date().toISOString(), migrationCount: files.length, warnings, migrations: files };
fs.mkdirSync(path.join(root, "audit-output"), { recursive: true });
fs.writeFileSync(path.join(root, "audit-output", "migration-audit.json"), JSON.stringify(report, null, 2));
console.log(`Migration audit complete: ${files.length} local SQL migration file(s).`);
for (const warning of warnings) console.warn(`WARNING: ${warning}`);
