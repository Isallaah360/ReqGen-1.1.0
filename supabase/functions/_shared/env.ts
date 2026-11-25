// ReqGen Edge Functions: the website code reads process.env; here the values come from the
// Supabase project (SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY are built in)
// and from the secrets set with `supabase secrets set` (SENDCHAMP_*, OTP_HASH_SECRET, ...).
const g = globalThis as unknown as { process?: { env: Record<string, string | undefined> } };
if (!g.process) g.process = { env: {} };
if (!g.process.env) g.process.env = {};
const env = g.process.env;
for (const [k, v] of Object.entries(Deno.env.toObject())) if (env[k] === undefined) env[k] = String(v);
env.NEXT_PUBLIC_SUPABASE_URL ??= Deno.env.get("SUPABASE_URL");
env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= Deno.env.get("SUPABASE_ANON_KEY");
env.NEXT_PUBLIC_APP_URL ??= "https://ietreqgen.barderians.com.ng";
export {};
