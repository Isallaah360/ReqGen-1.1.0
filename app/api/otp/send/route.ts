import { CODE_PURPOSES, CodeError, sendCode, serverUser, type CodePurpose } from "@/lib/server/codeService";
import { json, preflight } from "@/lib/server/cors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** ReqGen v4.7.0: sends a 6-digit code by SMS and e-mail (website and app). */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { purpose?: string };
    const purpose = (CODE_PURPOSES.includes(body.purpose as CodePurpose) ? body.purpose : "action") as CodePurpose;
    const ctx = await serverUser(req.headers.get("authorization"));
    return json(req, await sendCode(ctx, purpose));
  } catch (e) {
    const err = e instanceof CodeError ? e : new CodeError("The code could not be sent. Try again.", 500);
    return json(req, { ok: false, error: err.message }, err.status);
  }
}
export const OPTIONS = preflight;
