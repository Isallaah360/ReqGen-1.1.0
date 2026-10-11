import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { PublicFoot } from "@/app/components/PublicAuthShell";
import { modernisePositionText } from "@/lib/roles";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Document check", robots: { index: false, follow: false } };

/**
 * ReqGen v4.1 — public QR check page.
 * Scanning the code on a printed request letter or payment voucher opens this
 * page. It shows ONLY the document number, its status and who signed, so a
 * forged or altered paper is caught. It never shows titles, details or amounts.
 */

type Signer = { who: string; as: string; when: string | null; what: string };
type Result = { found: false } | { found: true; kind: "Request letter" | "Payment voucher"; number: string; status: string; raised: string | null; signers: Signer[] };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function day(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Lagos" });
}

function role(text: string | null | undefined) {
  return modernisePositionText(text) || "Officer";
}

async function lookup(kind: string, id: string): Promise<Result> {
  const db = admin();
  if (!db || !UUID.test(id)) return { found: false };
  if (kind === "r") {
    const r = await db.from("requests").select("id,request_no,status,current_stage,created_at").eq("id", id).maybeSingle();
    if (r.error || !r.data) return { found: false };
    const h = await db.from("request_history").select("actor_name,actor_role_name,action_type,created_at").eq("request_id", id).order("created_at");
    const signers = ((h.data || []) as Array<{ actor_name: string | null; actor_role_name: string | null; action_type: string | null; created_at: string | null }>)
      .filter((x) => /approv|sign|treat|paid|pay|submit|stamp/i.test(String(x.action_type)))
      .map((x) => ({ who: x.actor_name || "Officer", as: role(x.actor_role_name), when: x.created_at, what: /submit/i.test(String(x.action_type)) ? "Requested" : String(x.action_type || "Signed") }));
    const req = r.data as { request_no: string | null; status: string | null; current_stage: string | null; created_at: string | null };
    return { found: true, kind: "Request letter", number: req.request_no || "—", status: [req.status, req.current_stage ? `at ${role(req.current_stage)}` : ""].filter(Boolean).join(" · "), raised: req.created_at, signers };
  }
  if (kind === "v") {
    const v = await db.from("payment_vouchers").select("*").eq("id", id).maybeSingle();
    if (v.error || !v.data) return { found: false };
    const x = v.data as Record<string, string | null>;
    const pairs: Array<[string, string, string]> = [
      ["prepared_by_name", "prepared_at", "Prepared by the Account Officer"],
      ["checked_by_name", "checked_at", "Checked by the Auditor"],
      ["cheque_counter_signed_by_name", "cheque_counter_signed_at", "Counter-signed"],
      ["authorized_by_name", "authorized_at", "Signed, stamped and authorised by the Director General"],
      ["payee_signed_name", "payee_signed_at", "Received by the payee"],
    ];
    const signers = pairs.filter(([n]) => x[n]).map(([n, d, what]) => ({ who: String(x[n]), as: "", when: x[d] || null, what }));
    return { found: true, kind: "Payment voucher", number: String(x.voucher_no || "—"), status: String(x.status || "—"), raised: x.created_at || null, signers };
  }
  return { found: false };
}

export default async function CheckPage({ params }: { params: Promise<{ kind: string; id: string }> }) {
  const { kind, id } = await params;
  const result = await lookup(kind, id);
  return (
    <main className="v4-ui v4-public">
      <Image className="v4-public-watermark" src="/v4/iet-logo.png" alt="" aria-hidden="true" width={720} height={720} />
      <section className="v4-auth-card">
        <div className="v4-auth-logo v4-small"><Image src="/v4/iet-logo.png" alt="Islamic Education Trust logo" width={92} height={92} /></div>
        <h1 className="v4-auth-title">Document check</h1>
        {result.found ? (
          <>
            <p className="v4-auth-sub">This {result.kind.toLowerCase()} is a genuine ReqGen record of the Islamic Education Trust.</p>
            <div className="v4-auth-form">
              <div className="v4-notice v4-notice-green"><span><b>{result.number}</b> · {result.kind}<br />Status: <b>{result.status}</b> · Raised {day(result.raised)}</span></div>
              <div>
                <h2 className="v4-h3" style={{ margin: "0 0 8px" }}>Who signed</h2>
                {result.signers.length ? (
                  <ul className="v4-can v4-yes">
                    {result.signers.map((s, i) => <li key={i}><span aria-hidden="true">✓</span><span><b>{s.who}</b>{s.as ? ` — ${s.as}` : ""} · {s.what} · {day(s.when)}</span></li>)}
                  </ul>
                ) : <p className="v4-muted" style={{ margin: 0 }}>No signature recorded yet.</p>}
              </div>
              <div className="v4-notice v4-notice-amber"><span>Compare these names and dates with the paper. If anything differs, the paper may have been altered — report it to the Auditor.</span></div>
            </div>
          </>
        ) : (
          <>
            <p className="v4-auth-sub">No ReqGen record matches this code.</p>
            <div className="v4-auth-form">
              <div className="v4-notice v4-notice-red"><span>This paper may not be genuine. Do not act on it. Report it to the Auditor or the Registry.</span></div>
            </div>
          </>
        )}
        <Link href="/" className="v4-back-home">ReqGen home</Link>
        <PublicFoot />
      </section>
    </main>
  );
}
