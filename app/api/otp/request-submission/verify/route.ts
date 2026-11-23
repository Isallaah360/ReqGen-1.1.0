import { CodeError, serverUser, verifyCode } from "@/lib/server/codeService";
import { json, preflight } from "@/lib/server/cors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Kept for pages opened before v4.7.0: the same code service as /api/otp/verify. */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { code?: string };
    return json(req, await verifyCode(await serverUser(req.headers.get("authorization")), "request_submission", body.code));
  } catch (e) { const err = e instanceof CodeError ? e : new CodeError("The code could not be checked.", 500); return json(req, { ok: false, error: err.message }, err.status); }
}
export const OPTIONS = preflight;
