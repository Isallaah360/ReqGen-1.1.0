"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../../lib/supabaseClient";

type Req = {
  id: string;
  request_no: string;
  title: string;
  details: string;
  amount: number;
  status: string;
  current_stage: string;
  created_by: string;
  dept_id: string;
  subhead_id: string | null;
  request_type: string;
  personal_category: string | null;
  created_at: string;
};

type Hist = {
  id: string;
  action_type: string;
  comment: string | null;
  to_stage: string | null;
  created_at: string;
  signature_url: string | null;
  action_by: string;
};

type Dept = { id: string; name: string };
type Subhead = { id: string; code: string; name: string };
type Profile = { id: string; full_name: string; email: string | null };

async function signedUrl(path: string | null) {
  if (!path) return null;
  const { data } = await supabase.storage.from("signatures").createSignedUrl(path, 60 * 20);
  return data?.signedUrl || null;
}

export default function PrintRequestPage() {
  const router = useRouter();
  const params = useParams();
  const id = String((params as any)?.id || "");

  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  const [req, setReq] = useState<Req | null>(null);
  const [dept, setDept] = useState<Dept | null>(null);
  const [subhead, setSubhead] = useState<Subhead | null>(null);

  const [history, setHistory] = useState<Hist[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [sigUrls, setSigUrls] = useState<Record<string, string>>({}); // signature_url -> signedUrl

  const createdAt = useMemo(() => (req?.created_at ? new Date(req.created_at) : null), [req]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setMsg(null);

      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        router.push("/login");
        return;
      }

      const { data: r, error: rErr } = await supabase
        .from("requests")
        .select("id,request_no,title,details,amount,status,current_stage,created_by,dept_id,subhead_id,request_type,personal_category,created_at")
        .eq("id", id)
        .single();

      if (rErr) {
        setMsg("Failed to load request: " + rErr.message);
        setLoading(false);
        return;
      }
      setReq(r as any);

      const { data: d } = await supabase.from("departments").select("id,name").eq("id", r.dept_id).single();
      if (d) setDept(d as any);

      if (r.subhead_id) {
        const { data: sh } = await supabase.from("subheads").select("id,code,name").eq("id", r.subhead_id).single();
        if (sh) setSubhead(sh as any);
      }

      const { data: h, error: hErr } = await supabase
        .from("request_history")
        .select("id,action_type,comment,to_stage,created_at,signature_url,action_by")
        .eq("request_id", id)
        .order("created_at", { ascending: true });

      if (hErr) setMsg("Failed to load history: " + hErr.message);
      const hist = (h || []) as Hist[];
      setHistory(hist);

      // load profiles for names
      const ids = Array.from(new Set([r.created_by, ...hist.map((x) => x.action_by)]));
      const { data: ps } = await supabase.from("profiles").select("id,full_name,email").in("id", ids);
      const map: Record<string, Profile> = {};
      (ps || []).forEach((p: any) => (map[p.id] = p));
      setProfiles(map);

      // signed urls for signatures used in history
      const sigSet = Array.from(new Set(hist.map((x) => x.signature_url).filter(Boolean) as string[]));
      const urlMap: Record<string, string> = {};
      for (const s of sigSet) {
        const u = await signedUrl(s);
        if (u) urlMap[s] = u;
      }
      setSigUrls(urlMap);

      setLoading(false);
    }

    load();
  }, [id, router]);

  return (
    <main className="min-h-screen bg-slate-50 px-4 print:bg-white print:px-0">
      <style>{`
        @media print {
          .no-print { display:none !important; }
          .page { box-shadow:none !important; border:none !important; margin:0 !important; }
          body { background:white !important; }
        }
      `}</style>

      <div className="mx-auto max-w-4xl py-10 print:py-0">
        <div className="no-print flex items-center justify-between">
          <button
            onClick={() => router.push(`/requests/${id}`)}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100"
          >
            Back
          </button>
          <button
            onClick={() => window.print()}
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Print
          </button>
        </div>

        {msg && <div className="no-print mt-4 rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-800">{msg}</div>}

        {loading || !req ? (
          <div className="mt-6 text-slate-600 no-print">Loading...</div>
        ) : (
          <div className="page mt-6 rounded-2xl border bg-white p-8 shadow-sm print:mt-0 print:rounded-none print:border-0 print:p-10">
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-2xl font-extrabold text-slate-900">Islamic Education Trust (IET)</div>
                <div className="mt-1 text-sm text-slate-600">ReqGen Official Request Printout</div>
                <div className="mt-2 text-xs text-slate-500">
                  Generated: {new Date().toLocaleString()}
                </div>
              </div>

              <div className="text-right">
                <div className="text-sm text-slate-600">Request No</div>
                <div className="text-lg font-extrabold text-slate-900">{req.request_no}</div>
                <div className="mt-1 text-xs text-slate-500">
                  Created: {createdAt ? createdAt.toLocaleString() : "—"}
                </div>
              </div>
            </div>

            <hr className="my-6 border-slate-200" />

            {/* Request Info */}
            <div className="grid gap-4 md:grid-cols-2">
              <KV label="Department" value={dept?.name || "—"} />
              <KV label="Subhead" value={subhead ? `${subhead.code} — ${subhead.name}` : "—"} />
              <KV label="Type" value={req.request_type === "Personal" ? `Personal • ${req.personal_category || ""}` : "Official"} />
              <KV label="Amount" value={`₦${Number(req.amount || 0).toLocaleString()}`} />
              <KV label="Status" value={req.status || "—"} />
              <KV label="Current Stage" value={req.current_stage || "—"} />
            </div>

            <div className="mt-6">
              <div className="text-xs font-semibold text-slate-500">Title</div>
              <div className="mt-2 text-sm font-bold text-slate-900">{req.title}</div>
            </div>

            <div className="mt-4">
              <div className="text-xs font-semibold text-slate-500">Details</div>
              <div className="mt-2 whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-800 print:bg-white">
                {req.details}
              </div>
            </div>

            {/* History */}
            <div className="mt-8">
              <div className="text-lg font-bold text-slate-900">Approval History (Signed)</div>
              <div className="mt-2 overflow-hidden rounded-xl border border-slate-200">
                <div className="grid grid-cols-12 bg-slate-100 px-4 py-3 text-xs font-semibold text-slate-600 print:bg-white">
                  <div className="col-span-2">Date</div>
                  <div className="col-span-2">Action</div>
                  <div className="col-span-3">Officer</div>
                  <div className="col-span-3">Comment</div>
                  <div className="col-span-2">Signature</div>
                </div>

                {history.map((h) => {
                  const officer = profiles[h.action_by]?.full_name || profiles[h.action_by]?.email || h.action_by;
                  const sig = h.signature_url ? sigUrls[h.signature_url] : null;

                  return (
                    <div key={h.id} className="grid grid-cols-12 border-t px-4 py-3 text-xs text-slate-800">
                      <div className="col-span-2">{new Date(h.created_at).toLocaleDateString()}</div>
                      <div className="col-span-2 font-semibold">{h.action_type}</div>
                      <div className="col-span-3">{officer}</div>
                      <div className="col-span-3">{h.comment || "—"}</div>
                      <div className="col-span-2">
                        {sig ? (
                          <img src={sig} alt="signature" className="h-10 w-auto" />
                        ) : (
                          <span className="text-red-600">Missing</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Footer */}
            <div className="mt-10 text-xs text-slate-500">
              This printout is generated by ReqGen 1.1.0 and contains electronic signatures stored in the system.
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 print:border-slate-300">
      <div className="text-xs font-semibold text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-semibold text-slate-900">{value}</div>
    </div>
  );
}