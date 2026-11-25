// ReqGen app 4.0.0: before building, make sure the database address and its public key are known.
// They come from the website folder's .env.local (the same file the website uses). Nothing else is read.
import { existsSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Files from app 3.x that are no longer part of the app. Unzipping a new kit over the folder does not
// remove them, so they are removed here before the build. Only these exact app files are touched.
const here = path.dirname(fileURLToPath(import.meta.url));
const OLD = ["scripts/webcss.mjs", "src/lib/apiFetch.ts", "src/lib/web.ts", "src/modules", "src/office", "src/shim", "src/screens/Vouchers.tsx"];
const gone = OLD.filter((f) => existsSync(path.join(here, f)));
for (const f of gone) rmSync(path.join(here, f), { recursive: true, force: true });
if (gone.length) console.log("ReqGen app: removed old 3.x files no longer used:", gone.join(", "));

const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const found = {};
for (const f of [".env", ".env.local", ".env.production", ".env.production.local"]) {
  const p = path.join(web, f);
  if (!existsSync(p)) continue;
  for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*(NEXT_PUBLIC_SUPABASE_URL|NEXT_PUBLIC_SUPABASE_ANON_KEY)\s*=\s*"?([^"\s]*)"?\s*$/);
    if (m && m[2]) found[m[1]] = m[2];
  }
}
for (const k of ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"]) if (process.env[k]) found[k] = process.env[k];
const missing = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"].filter((k) => !found[k]);
if (missing.length) {
  console.error(`\nReqGen app: ${missing.join(" and ")} not found.\nPut the mobile folder inside the reqgen-web folder that has your .env.local (the website's settings), then build again.\n`);
  process.exit(1);
}
if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(found.NEXT_PUBLIC_SUPABASE_URL)) {
  console.error("\nReqGen app: NEXT_PUBLIC_SUPABASE_URL in .env.local does not look like a Supabase address.\n");
  process.exit(1);
}
console.log("ReqGen app: database address found:", found.NEXT_PUBLIC_SUPABASE_URL);
