import { REQGEN_SEMVER } from "@/lib/version";
import { deliveryStatus } from "@/lib/server/codeService";
import { json, preflight } from "@/lib/server/cors";

export const dynamic = "force-dynamic";

/**
 * ReqGen v4.7.0: what the real app needs to talk to our database. Only public
 * values (the same ones every web page already carries). Never a secret key.
 */
export function GET(req: Request) {
  const s = deliveryStatus();
  return json(req, {
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || null,
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || null,
    website: process.env.NEXT_PUBLIC_APP_URL || "https://ietreqgen.barderians.com.ng",
    version: REQGEN_SEMVER,
    codes: s.key ? (s.sms && s.email ? "sms_email" : s.sms ? "sms" : "email") : "off",
  });
}
export const OPTIONS = preflight;
