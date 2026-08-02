import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const exts = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);
const ignored = new Set(["node_modules", ".next", ".git", "audit-output"]);

function walk(dir, output = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, output);
    else if (exts.has(path.extname(entry.name))) output.push(full);
  }
  return output;
}

const tables = new Set();
const rpcs = new Set();
const channels = new Set();
const references = [];

for (const file of walk(root)) {
  const source = fs.readFileSync(file, "utf8");
  for (const match of source.matchAll(/\.from\(["']([^"']+)["']\)/g)) {
    tables.add(match[1]); references.push({ kind: "table", name: match[1], file: path.relative(root, file) });
  }
  for (const match of source.matchAll(/\.rpc\(["']([^"']+)["']/g)) {
    rpcs.add(match[1]); references.push({ kind: "rpc", name: match[1], file: path.relative(root, file) });
  }
  for (const match of source.matchAll(/\.channel\(["']([^"']+)["']/g)) {
    channels.add(match[1]); references.push({ kind: "channel", name: match[1], file: path.relative(root, file) });
  }
}

const report = {
  generatedAt: new Date().toISOString(),
  summary: { tables: tables.size, rpcs: rpcs.size, realtimeChannels: channels.size },
  tables: [...tables].sort(),
  rpcs: [...rpcs].sort(),
  realtimeChannels: [...channels].sort(),
  references,
};

fs.mkdirSync(path.join(root, "audit-output"), { recursive: true });
fs.writeFileSync(path.join(root, "audit-output", "database-contract.json"), JSON.stringify(report, null, 2));
console.log(`Database contract audit complete: ${tables.size} tables/views, ${rpcs.size} RPCs, ${channels.size} realtime channels.`);
console.log("Report: audit-output/database-contract.json");
