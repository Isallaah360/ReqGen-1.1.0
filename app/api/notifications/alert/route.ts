import { CodeError, deliveryStatus, serverUser } from "@/lib/server/codeService";
import { json, preflight } from "@/lib/server/cors";
import { normalizeEmail, normalizeNigerianPhone, sendSendchampEmail, sendSendchampSms } from "@/lib/sendchamp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ReqGen v4.7.0: tells people at once by SMS and e-mail (the in-app notice is
 * written by the database).
 *   waiting   whoever now holds the request, or the Direct receivers still waiting
 *   answered  the sender, when a Direct receiver answers
 *   (v4.7.1) with "waiting", the sender is told too that the request moved on
 * Only the request number and what to do are sent, never the title, amount or message.
 * Used by the website and the app.
 */
type Body = { requestId?: string; kind?: "waiting" | "answered"; to?: string[] };

export async function POST(req: Request) {
  try {
    const ctx = await serverUser(req.headers.get("authorization"));
    const { admin, user } = ctx;
    const body = (await req.json().catch(() => ({}))) as Body;
    if (!body.requestId) throw new CodeError("Which request?");
    const { data: r } = await admin.from("requests").select("id,request_no,created_by,current_owner,current_stage,status").eq("id", body.requestId).maybeSingle();
    if (!r) throw new CodeError("Request not found.", 404);
    const { data: people } = await admin.from("reqgen_direct_recipients").select("user_id,status").eq("request_id", r.id);
    const receivers = (people || []) as Array<{ user_id: string; status: string }>;
    const { data: recent } = await admin.from("request_history").select("action_by").eq("request_id", r.id).gte("created_at", new Date(Date.now() - 10 * 60000).toISOString());
    const involved = r.created_by === user.id || r.current_owner === user.id || receivers.some((x) => x.user_id === user.id) || (recent || []).some((h) => h.action_by === user.id);
    if (!involved) throw new CodeError("You are not allowed to send alerts for this request.", 403);

    let to: string[] = [];
    if (body.kind === "answered") to = r.created_by ? [r.created_by] : [];
    else if (r.current_owner) to = [r.current_owner];
    else to = receivers.filter((x) => x.status === "Waiting").map((x) => x.user_id);
    const reminder = Array.isArray(body.to) && body.to.length > 0;
    if (reminder) to = to.filter((id) => body.to!.includes(id));
    to = [...new Set(to)].filter((id) => id && id !== user.id);
    // v4.7.1: when a request moves, the person who sent it is told too (not for a reminder)
    const sender = !reminder && body.kind !== "answered" && r.created_by && r.created_by !== user.id && !to.includes(r.created_by) ? r.created_by : null;
    if (!to.length && !sender) return json(req, { ok: true, told: 0 });

    const status = deliveryStatus();
    if (!status.key) return json(req, { ok: false, told: 0, error: "SMS and e-mail are not set up on the server (Sendchamp). The in-app notice was still sent." }, 503);
    const site = process.env.NEXT_PUBLIC_APP_URL || "https://ietreqgen.barderians.com.ng";
    const no = String(r.request_no || "A request");
    const mainLine = body.kind === "answered" ? `${no} has a new answer.` : `${no} is waiting for your action.`;
    const { data: rows } = await admin.from("profiles").select("id,full_name,phone,email").in("id", sender ? [...to, sender] : to);
    let told = 0;
    const problems: string[] = [];
    for (const p of (rows || []) as Array<{ id: string; full_name: string | null; phone: string | null; email: string | null }>) {
      const { data: dup } = await admin.from("sms_logs").select("id").eq("request_id", r.id).eq("recipient_user_id", p.id).gte("created_at", new Date(Date.now() - 60000).toISOString()).limit(1);
      if (dup && dup.length) continue;
      const phone = normalizeNigerianPhone(p.phone), email = normalizeEmail(p.email);
      const line = p.id === sender ? `${no} has moved on. Open ReqGen to see where it is.` : mainLine;
      let any = false;
      if (status.sms && phone) {
        try { await sendSendchampSms({ to: phone, message: `IET ReqGen: ${line} Open ReqGen: ${site}` }); any = true; }
        catch (e) { problems.push(e instanceof Error ? e.message : "SMS not sent"); }
        await admin.from("sms_logs").insert({ request_id: r.id, recipient_user_id: p.id, phone, channel: "sms", message: line, provider: "sendchamp-sms", status: any ? "sent" : "failed", sent_by: user.id });
      }
      if (status.email && email) {
        let ok = false;
        try {
          await sendSendchampEmail({ to: { email, name: p.full_name || "Staff" }, subject: `IET ReqGen | ${no}`, text: `ISLAMIC EDUCATION TRUST\nIET REQGEN\n\nAssalamu Alaikum ${p.full_name || "Staff"},\n\n${line}\n\nOpen ReqGen to see it: ${site}\n\nIET ReqGen` });
          ok = true; any = true;
        } catch (e) { problems.push(e instanceof Error ? e.message : "E-mail not sent"); }
        await admin.from("sms_logs").insert({ request_id: r.id, recipient_user_id: p.id, email, channel: "email", message: line, provider: "sendchamp-email", status: ok ? "sent" : "failed", sent_by: user.id });
      }
      if (any) told++;
    }
    return json(req, { ok: true, told, problems: problems.slice(0, 3) });
  } catch (e) {
    const err = e instanceof CodeError ? e : new CodeError("The alerts could not be sent.", 500);
    return json(req, { ok: false, error: err.message }, err.status);
  }
}
export const OPTIONS = preflight;
