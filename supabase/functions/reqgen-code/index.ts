// ReqGen Edge Function: the 6-digit SMS and e-mail code, when a phone has no fingerprint set up.
//   POST /functions/v1/reqgen-code  { "step": "send" | "verify", "purpose": "action", "code"?: "123456" }
// The logic is the website's own (generated into _shared/gen by scripts/build-edge.mjs).
import { POST as send } from "../_shared/gen/code_send.ts";
import { POST as verify } from "../_shared/gen/code_verify.ts";
import { preflight, withCors } from "../_shared/http.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight(req);
  if (req.method !== "POST") return withCors(req, Response.json({ ok: false, error: "Use POST." }, { status: 405 }));
  let body: Record<string, unknown> = {};
  try { body = JSON.parse((await req.text()) || "{}"); } catch { return withCors(req, Response.json({ ok: false, error: "Bad request." }, { status: 400 })); }
  const run = body.step === "send" ? send : body.step === "verify" ? verify : null;
  if (!run) return withCors(req, Response.json({ ok: false, error: "Send or verify?" }, { status: 400 }));
  const { step: _step, ...rest } = body;
  const inner = new Request(req.url, { method: "POST", headers: req.headers, body: JSON.stringify(rest) });
  try { return withCors(req, await run(inner)); }
  catch (e) { return withCors(req, Response.json({ ok: false, error: e instanceof Error ? e.message : "The code could not be handled." }, { status: 500 })); }
});
