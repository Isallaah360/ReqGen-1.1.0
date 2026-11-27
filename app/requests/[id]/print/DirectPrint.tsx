"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { supabase } from "@/lib/supabaseClient";
import { extractSignatureInk } from "@/lib/signatureInk";
import { printA4Sheet, fitA4ToScreen } from "@/lib/printA4";
import { logPrint } from "@/lib/v4/reports";
import { DIRECT_CSS, directAnswers, directLetterHtml, directTo, fitDirect, type DirectHist, type DirectPerson } from "@/lib/directLetter";

/**
 * ReqGen 6.3.2: the Direct message paper on the website, the same one page the app makes
 * (lib/directLetter.ts). Sender, the people it went to, and each answer with its signature.
 */
const ukDate = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "");

function sigUrl(value: string | null | undefined) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  if (/^(https?:|data:image\/|blob:)/.test(raw)) return raw;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return base ? `${base}/storage/v1/object/public/signatures/${raw.replace(/^signatures\//, "").replace(/^\/+/, "")}` : null;
}
async function ink(url: string | null) {
  if (!url) return null;
  try { return (await extractSignatureInk(url)).url; } catch { return url; }
}

export default function DirectPrint({ id, people, senderId }: { id: string; people: DirectPerson[]; senderId: string }) {
  const router = useRouter();
  const sheet = useRef<HTMLElement>(null);
  const [html, setHtml] = useState("");
  const [no, setNo] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const [r, h, u] = await Promise.all([
        supabase.from("requests").select("request_no,title,details,amount,created_at,requester_name,requester_signature_url,created_by").eq("id", id).maybeSingle(),
        supabase.from("request_history").select("id,action_type,comment,to_stage,from_stage,created_at,actor_name,signature_url,actor_role_key,actor_role_name,actor_signature_url,action_by").eq("request_id", id).order("created_at", { ascending: true }),
        supabase.auth.getUser(),
      ]);
      if (!alive) return;
      if (r.error || !r.data) { setMsg("This message cannot be printed by you."); return; }
      const q = r.data as Record<string, string | number | null>;
      const viewer = u.data.user?.id || "";
      const sender = senderId || String(q.created_by || "");
      const raw = directAnswers((h.data || []) as DirectHist[], viewer, sender, ukDate, (x) => sigUrl(x.actor_signature_url || x.signature_url));
      const [fromSig, code, ...sigs] = await Promise.all([
        ink(sigUrl(String(q.requester_signature_url || ""))),
        QRCode.toDataURL(`${window.location.origin}/check/r/${id}`, { errorCorrectionLevel: "M", margin: 2, width: 240 }).catch(() => null),
        ...raw.map((a) => ink(a.sig)),
      ]);
      if (!alive) return;
      setNo(String(q.request_no || ""));
      setHtml(directLetterHtml({
        no: String(q.request_no || ""), title: String(q.title || ""), message: String(q.details || ""), amount: Number(q.amount || 0),
        date: ukDate(String(q.created_at || "")),
        from: { name: String(q.requester_name || ""), sig: fromSig, when: ukDate(String(q.created_at || "")) },
        to: directTo(people, viewer, sender, String(q.requester_name || "")),
        answers: raw.map((a, i) => ({ label: a.label, name: a.name, position: a.position, words: a.words, sig: sigs[i] || null, when: a.when, stamp: a.stamp })),
        qr: code, logo: "/iet-logo.png", stamp: "/v4/iet-stamp.png",
      }));
    })();
    return () => { alive = false; };
  }, [id, people, senderId]);

  useEffect(() => {
    const el = sheet.current;
    if (!el || !html) return;
    const run = () => { fitA4ToScreen(el); fitDirect(el); };
    run();
    const imgs = Array.from(el.querySelectorAll("img"));
    imgs.forEach((im) => im.addEventListener("load", run, { once: true }));
    window.addEventListener("resize", run);
    return () => window.removeEventListener("resize", run);
  }, [html]);

  async function print() {
    setPrinting(true);
    try { if (sheet.current) fitDirect(sheet.current); await printA4Sheet(sheet.current, `${no} | ReqGen`); void logPrint("request", id, no); }
    finally { setPrinting(false); }
  }

  return (
    <main className="req-family-page req-print-preview">
      <style>{DIRECT_CSS}</style>
      <div className="req-family-inner req-print-inner">
        <header className="no-print req-family-head">
          <div>
            <span className="req-family-eyebrow">Print Preview</span>
            <h1>Direct message</h1>
            <p>One A4 page: the sender, the people it went to, and their answers with signatures.</p>
            {no ? <div className="req-family-meta">{no}</div> : null}
          </div>
        </header>
        <div className="no-print req-print-actions">
          <button type="button" className="req-secondary-button" onClick={() => router.push(`/requests/${id}`)}>Back to the message</button>
          <button type="button" className="req-primary-button" disabled={!html || printing} onClick={() => void print()}>{printing ? "Preparing Print..." : "Print"}</button>
        </div>
        {msg ? <div className="no-print mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">{msg}</div> : null}
        <div className="rg-a4-stage">
          {html ? <article ref={sheet} className="rg-a4-page dl-sheet" aria-label={`Direct message ${no}`} dangerouslySetInnerHTML={{ __html: `<style>${DIRECT_CSS}</style>${html}` }} /> : !msg ? <p className="no-print">Preparing the paper…</p> : null}
        </div>
      </div>
    </main>
  );
}
