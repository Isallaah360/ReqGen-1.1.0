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
  created_by: string;
  dept_id: string;
  subhead_id: string | null;
  current_stage: string;
  status: string;
  created_at: string;
};

type Subhead = {
  id: string;
  code: string;
  name: string;
  approved_allocation: number;
  expenditure: number;
  balance: number;
};

type Profile = { id: string; full_name: string | null; signature_url: string | null };
type Hist = { action_type: string; to_stage: string | null; created_at: string; signature_url: string | null; action_by: string };

async function signedUrl(path: string | null) {
  if (!path) return null;
  const { data } = await supabase.storage.from("signatures").createSignedUrl(path, 60 * 10);
  return data?.signedUrl || null;
}

export default function PrintRequestPage() {
  const router = useRouter();
  const params = useParams();
  const id = String((params as any)?.id || "");

  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  const [req, setReq] = useState<Req | null>(null);
  const [subhead, setSubhead] = useState<Subhead | null>(null);

  const [requester, setRequester] = useState<Profile | null>(null);
  const [hist, setHist] = useState<Hist[]>([]);

  const [sigRequester, setSigRequester] = useState<string | null>(null);
  const [sigChecked, setSigChecked] = useState<string | null>(null);
  const [sigDG, setSigDG] = useState<string | null>(null);

  const checkedRecord = useMemo(() => {
    // "Checked by" usually Registry/Account approve — pick latest approve before DG
    const approvals = hist.filter((h) => (h.action_type || "").toLowerCase().includes("approve"));
    return approvals.find((h) => (h.to_stage || "").toLowerCase().includes("dg")) || approvals[0] || null;
  }, [hist]);

  const dgRecord = useMemo(() => {
    // DG approval = approve to Account or Completed
    const approvals = hist.filter((h) => (h.action_type || "").toLowerCase().includes("approve"));
    return approvals.find((h) => (h.to_stage || "").toLowerCase().includes("account")) || approvals[0] || null;
  }, [hist]);

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
        .select("id,request_no,title,details,amount,created_by,dept_id,subhead_id,current_stage,status,created_at")
        .eq("id", id)
        .single();

      if (rErr) {
        setMsg("Failed to load request: " + rErr.message);
        setLoading(false);
        return;
      }
      setReq(r as any);

      if ((r as any).subhead_id) {
        const { data: sh } = await supabase
          .from("subheads")
          .select("id,code,name,approved_allocation,expenditure,balance")
          .eq("id", (r as any).subhead_id)
          .single();
        setSubhead((sh as any) || null);
      }

      const { data: prof } = await supabase
        .from("profiles")
        .select("id,full_name,signature_url")
        .eq("id", (r as any).created_by)
        .single();
      setRequester((prof as any) || null);

      const { data: h } = await supabase
        .from("request_history")
        .select("action_type,to_stage,created_at,signature_url,action_by")
        .eq("request_id", id)
        .order("created_at", { ascending: false });
      setHist((h || []) as any);

      setLoading(false);
    }
    load();
  }, [id, router]);

  useEffect(() => {
    async function loadSigs() {
      if (!requester) return;

      setSigRequester(await signedUrl(requester.signature_url));

      // checked signature
      if (checkedRecord?.signature_url) setSigChecked(await signedUrl(checkedRecord.signature_url));
      else setSigChecked(null);

      // dg signature
      if (dgRecord?.signature_url) setSigDG(await signedUrl(dgRecord.signature_url));
      else setSigDG(null);
    }
    loadSigs();
  }, [requester, checkedRecord, dgRecord]);

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 px-4">
        <div className="mx-auto max-w-4xl py-10 text-slate-600">Loading...</div>
      </main>
    );
  }

  if (!req) {
    return (
      <main className="min-h-screen bg-slate-50 px-4">
        <div className="mx-auto max-w-4xl py-10">Not found.</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8">
      <style>{`
        @media print {
          body { background: white !important; }
          .no-print { display: none !important; }
          .sheet { box-shadow: none !important; border: none !important; margin: 0 !important; }
          @page { size: A4; margin: 12mm; }
        }
      `}</style>

      <div className="mx-auto max-w-4xl">
        <div className="no-print flex items-center justify-between mb-4">
          <button
            onClick={() => router.push(`/requests/${req.id}`)}
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

        {msg && <div className="no-print mb-4 rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-800">{msg}</div>}

        {/* SHEET */}
        <div className="sheet bg-white border shadow-sm rounded-2xl px-10 py-10">
          {/* Header */}
          <div className="text-center">
            <div className="mx-auto mb-2 h-14 w-14 rounded-full border flex items-center justify-center text-xs text-slate-500">
              LOGO
            </div>

            <div className="text-lg font-extrabold tracking-tight">ISLAMIC EDUCATION TRUST</div>
            <div className="text-xs text-slate-700">IW2, Ilmi Avenue Intermediate Housing Estate</div>
            <div className="text-xs text-slate-700">PMB 229, Minna, Niger State - Nigeria</div>
          </div>

          {/* Subhead line */}
          <div className="mt-6 flex items-center gap-3">
            <div className="text-sm font-bold">SUB-HEAD:</div>
            <div className="flex-1 border rounded-sm h-7 px-2 flex items-center text-sm">
              {subhead ? `${subhead.code} — ${subhead.name}` : ""}
            </div>
          </div>

          {/* Address */}
          <div className="mt-6 text-sm">
            <div>The Director General,</div>
            <div>Islamic Education Trust,</div>
            <div>Minna.</div>
          </div>

          <div className="mt-6 text-sm font-semibold">Assalamu’ Alaikum Sir,</div>

          <div className="mt-3 text-center font-extrabold text-sm tracking-wide">
            REQUEST FOR FUND
          </div>

          <div className="mt-4 text-sm leading-6">
            I write to request for the release of the total sum of{" "}
            <span className="inline-block min-w-[180px] border-b border-slate-600 text-center font-semibold">
              ₦{Number(req.amount || 0).toLocaleString()}
            </span>{" "}
            for the expense below/attached:
          </div>

          {/* lined area */}
          <div className="mt-3">
            <div className="text-sm whitespace-pre-wrap min-h-[240px]">
              {req.details}
            </div>
            <div className="mt-2 space-y-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="border-b border-slate-300" />
              ))}
            </div>
          </div>

          <div className="mt-6 text-sm">Wassalamu’ Alaikum.</div>

          {/* Right box */}
          <div className="mt-6 flex justify-end">
            <div className="w-72 text-sm">
              <div className="flex items-center justify-between gap-3 mb-2">
                <div className="font-semibold">ALLOCATION B/D:</div>
                <div className="w-28 border h-7 rounded-sm px-2 flex items-center justify-end">
                  ₦{Number(subhead?.approved_allocation || 0).toLocaleString()}
                </div>
              </div>
              <div className="flex items-center justify-between gap-3 mb-2">
                <div className="font-semibold">EXPENDITURE:</div>
                <div className="w-28 border h-7 rounded-sm px-2 flex items-center justify-end">
                  ₦{Number(subhead?.expenditure || 0).toLocaleString()}
                </div>
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="font-semibold">BALANCE C/D:</div>
                <div className="w-28 border h-7 rounded-sm px-2 flex items-center justify-end">
                  ₦{Number(subhead?.balance || 0).toLocaleString()}
                </div>
              </div>
            </div>
          </div>

          {/* Signatures */}
          <div className="mt-10 space-y-5 text-sm">
            <SigRow
              label="Requested by:"
              name={requester?.full_name || ""}
              sigUrl={sigRequester}
            />
            <SigRow
              label="Checked by:"
              name=""
              sigUrl={sigChecked}
            />
            <SigRow
              label="Approved by Director General, IET:"
              name=""
              sigUrl={sigDG}
            />
          </div>

          <div className="mt-8 text-center text-xs text-slate-500 italic">Building Bridges</div>
        </div>
      </div>
    </main>
  );
}

function SigRow({ label, name, sigUrl }: { label: string; name: string; sigUrl: string | null }) {
  const today = new Date().toLocaleDateString();
  return (
    <div className="grid grid-cols-12 items-end gap-3">
      <div className="col-span-4">{label}</div>

      <div className="col-span-4 border-b border-slate-400 h-7 flex items-end">
        <span className="text-xs text-slate-700">{name}</span>
      </div>

      <div className="col-span-2 border-b border-slate-400 h-7 flex items-end justify-center">
        {sigUrl ? <img src={sigUrl} alt="sig" className="h-6 object-contain" /> : <span className="text-xs text-slate-400">Signature</span>}
      </div>

      <div className="col-span-2 border-b border-slate-400 h-7 flex items-end justify-center">
        <span className="text-xs">{today}</span>
      </div>
    </div>
  );
}