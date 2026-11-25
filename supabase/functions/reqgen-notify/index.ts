// ReqGen Edge Function: SMS and e-mail notices for requests. Called by the app as
//   POST /functions/v1/reqgen-notify  { "kind": "alert" | "event" | "approval", ...the same body as the website route }
// The logic is the website's own (generated into _shared/gen by scripts/build-edge.mjs).
import { POST as alert } from "../_shared/gen/notify_alert.ts";
import { POST as event } from "../_shared/gen/notify_event.ts";
import { POST as approval } from "../_shared/gen/notify_approval.ts";
import { preflight, withCors } from "../_shared/http.ts";

const ROUTES: Record<string, (req: Request) => Promise<Response>> = { alert, event, approval };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight(req);
  if (req.method !== "POST") return withCors(req, Response.json({ ok: false, error: "Use POST." }, { status: 405 }));
  const text = await req.text();
  let body: Record<string, unknown> = {};
  try { body = JSON.parse(text || "{}"); } catch { return withCors(req, Response.json({ ok: false, error: "Bad request." }, { status: 400 })); }
  const run = ROUTES[String(body.kind || "")];
  if (!run) return withCors(req, Response.json({ ok: false, error: "Unknown notice kind." }, { status: 400 }));
  const { kind: _kind, ...rest } = body;
  // the website's alert route uses "kind" for waiting/answered: the app sends it as "alertKind"
  if (body.kind === "alert" && rest.alertKind) (rest as Record<string, unknown>).kind = rest.alertKind;
  const inner = new Request(req.url, { method: "POST", headers: req.headers, body: JSON.stringify(rest) });
  try {
    return withCors(req, await run(inner));
  } catch (e) {
    return withCors(req, Response.json({ ok: false, error: e instanceof Error ? e.message : "The notice could not be sent." }, { status: 500 }));
  }
});
