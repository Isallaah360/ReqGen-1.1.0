import { CodeError, sendCode, serverUser } from "@/lib/server/codeService";
import { json, preflight } from "@/lib/server/cors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Kept for pages opened before v4.7.0: the same code service as /api/otp/send. */
export async function POST(req: Request) {
  try { return json(req, await sendCode(await serverUser(req.headers.get("authorization")), "request_submission")); }
  catch (e) { const err = e instanceof CodeError ? e : new CodeError("The code could not be sent.", 500); return json(req, { ok: false, error: err.message }, err.status); }
}
export const OPTIONS = preflight;
