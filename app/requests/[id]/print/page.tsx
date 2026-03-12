"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

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

  requester_signature_url: string | null;

  checked_by_name: string | null;
  checked_by_signature_url: string | null;

  dg_approved_by_name: string | null;
  dg_approved_signature_url: string | null;

  account_paid_by_name: string | null;
  account_paid_signature_url: string | null;
};

type Dept = {
  id: string;
  name: string;
};

type Subhead = {
  id: string;
  code: string | null;
  name: string;
  approved_allocation: number | null;
  expenditure: number | null;
  balance: number | null;
};

type Profile = {
  id: string;
  full_name: string | null;
  signature_url: string | null;
};

type Hist = {
  id: string;
  action_type: string;
  comment: string | null;
  to_stage: string | null;
  created_at: string;
  actor_name: string | null;
};

function naira(n: number | null | undefined) {
  return `₦${Number(n || 0).toLocaleString()}`;
}

function formatDate(d: string | null | undefined) {
  if (!d) return "";
  return new Date(d).toLocaleDateString();
}

async function resolveSignatureUrl(value: string | null | undefined) {
  const raw = (value || "").trim();
  if (!raw) return null;

  if (
    raw.startsWith("http://") ||
    raw.startsWith("https://") ||
    raw.startsWith("data:image/") ||
    raw.startsWith("blob:")
  ) {
    return raw;
  }

  const attempts = [
    raw,
    raw.replace(/^signatures\//, ""),
    raw.replace(/^\/+/, ""),
  ];

  for (const candidate of attempts) {
    if (!candidate) continue;

    const { data, error } = await supabase.storage
      .from("signatures")
      .createSignedUrl(candidate, 60 * 10);

    if (!error && data?.signedUrl) return data.signedUrl;
  }

  return null;
}

export default function PrintRequestPage() {
  const router = useRouter();
  const params = useParams();
  const id = String((params as any)?.id || "");

  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  const [req, setReq] = useState<Req | null>(null);
  const [dept, setDept] = useState<Dept | null>(null);
  const [subhead, setSubhead] = useState<Subhead | null>(null);
  const [requester, setRequester] = useState<Profile | null>(null);
  const [hist, setHist] = useState<Hist[]>([]);

  const [sigRequester, setSigRequester] = useState<string | null>(null);
  const [sigChecked, setSigChecked] = useState<string | null>(null);
  const [sigDG, setSigDG] = useState<string | null>(null);
  const [sigAccount, setSigAccount] = useState<string | null>(null);

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
        .select(`
          id,
          request_no,
          title,
          details,
          amount,
          created_by,
          dept_id,
          subhead_id,
          current_stage,
          status,
          created_at,
          requester_signature_url,
          checked_by_name,
          checked_by_signature_url,
          dg_approved_by_name,
          dg_approved_signature_url,
          account_paid_by_name,
          account_paid_signature_url
        `)
        .eq("id", id)
        .single();

      if (rErr) {
        setMsg("Failed to load request: " + rErr.message);
        setLoading(false);
        return;
      }

      const reqRow = r as Req;
      setReq(reqRow);

      const [deptRes, subRes, requesterRes, histRes] = await Promise.all([
        supabase.from("departments").select("id,name").eq("id", reqRow.dept_id).single(),
        reqRow.subhead_id
          ? supabase
              .from("subheads")
              .select("id,code,name,approved_allocation,expenditure,balance")
              .eq("id", reqRow.subhead_id)
              .single()
          : Promise.resolve({ data: null } as any),
        supabase
          .from("profiles")
          .select("id,full_name,signature_url")
          .eq("id", reqRow.created_by)
          .single(),
        supabase
          .from("request_history")
          .select("id,action_type,comment,to_stage,created_at,actor_name")
          .eq("request_id", reqRow.id)
          .order("created_at", { ascending: true }),
      ]);

      if (deptRes.data) setDept(deptRes.data as Dept);
      if (subRes.data) setSubhead(subRes.data as Subhead);
      if (requesterRes.data) setRequester(requesterRes.data as Profile);
      setHist((histRes.data || []) as Hist[]);

      setLoading(false);
    }

    load();
  }, [id, router]);

  useEffect(() => {
    document.title = req?.request_no || "request-print";
  }, [req?.request_no]);

  useEffect(() => {
    async function loadSignatures() {
      if (!req) return;

      setResolving(true);

      const requesterSig =
        (await resolveSignatureUrl(requester?.signature_url || null)) ||
        (await resolveSignatureUrl(req.requester_signature_url));

      const checkedSig = await resolveSignatureUrl(req.checked_by_signature_url);
      const dgSig = await resolveSignatureUrl(req.dg_approved_signature_url);
      const accountSig = await resolveSignatureUrl(req.account_paid_signature_url);

      setSigRequester(requesterSig);
      setSigChecked(checkedSig);
      setSigDG(dgSig);
      setSigAccount(accountSig);

      setResolving(false);
    }

    loadSignatures();
  }, [req, requester]);

  const ready =
    !!req &&
    !!requester?.full_name &&
    !!req.checked_by_name &&
    !!req.dg_approved_by_name &&
    !!req.account_paid_by_name &&
    !!sigRequester &&
    !!sigChecked &&
    !!sigDG &&
    !!sigAccount;

  function handlePrint() {
    if (!ready) {
      setMsg("Printing is blocked until all four names and signatures are fully populated.");
      return;
    }
    window.print();
  }

  if (loading || resolving) {
    return (
      <main className="min-h-screen bg-slate-100 px-4 py-8">
        <div className="mx-auto max-w-3xl rounded-2xl border bg-white p-6 text-slate-700 shadow-sm">
          Preparing final print preview...
        </div>
      </main>
    );
  }

  if (!req) {
    return (
      <main className="min-h-screen bg-slate-100 px-4 py-8">
        <div className="mx-auto max-w-5xl text-slate-700">Request not found.</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-4">
      <style>{`
        @page {
          size: A4;
          margin: 5mm;
        }
        @media print {
          body {
            background: white !important;
          }
          .no-print {
            display: none !important;
          }
          .sheet {
            box-shadow: none !important;
            border: none !important;
            margin: 0 !important;
            width: 100% !important;
            min-height: auto !important;
            page-break-inside: avoid !important;
          }
        }
      `}</style>

      <div className="mx-auto max-w-[800px]">
        <div className="no-print mb-3 flex items-center justify-between">
          <button
            onClick={() => router.push(`/requests/${req.id}`)}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100"
          >
            Back
          </button>

          <button
            onClick={handlePrint}
            disabled={!ready}
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Print
          </button>
        </div>

        {msg && (
          <div className="no-print mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {msg}
          </div>
        )}

        <div className="sheet mx-auto w-full bg-white px-[20px] py-[14px] text-black">
          <div className="text-center">
            <div className="mx-auto flex justify-center">
              <Image
                src="/iet-logo.png"
                alt="IET Logo"
                width={52}
                height={52}
                className="h-[52px] w-auto object-contain"
                priority
              />
            </div>

            <div className="mt-1 text-[16px] font-black uppercase leading-none tracking-tight">
              Islamic Education Trust
            </div>
            <div className="mt-0.5 text-[10px] font-semibold leading-tight">
              IW2, Ilmi Avenue Intermediate Housing Estate
            </div>
            <div className="text-[10px] font-semibold leading-tight">
              PMB 229, Minna, Niger State - Nigeria
            </div>
          </div>

          <div className="mt-2 h-[2px] w-full bg-blue-500" />

          <div className="mt-2 grid grid-cols-12 gap-x-3 gap-y-1">
            <TopLineField label="Reference:" value={req.request_no} className="col-span-5" />
            <TopLineField label="Date:" value={formatDate(req.created_at)} className="col-span-4" />
            <TopLineField label="Stage:" value={req.current_stage || ""} className="col-span-3" />

            <TopLineField label="Department:" value={dept?.name || ""} className="col-span-5" />
            <TopLineField
              label="Sub-Head:"
              value={subhead ? `${subhead.code || ""} ${subhead.name}`.trim() : ""}
              className="col-span-4"
            />
            <TopLineField label="Status:" value={req.status || ""} className="col-span-3" />
          </div>

          <div className="mt-1 h-[1px] w-full bg-blue-300" />

          <div className="mt-2 text-[11px] font-bold leading-[1.25]">
            <div>The Director General,</div>
            <div>Islamic Education Trust,</div>
            <div>Minna.</div>
          </div>

          <div className="mt-3 text-[11px] font-bold">Assalamu` Alaikum Sir,</div>

          <div className="mt-1 text-center text-[12px] font-black uppercase">
            Request for Fund
          </div>

          <div className="mt-1 text-[10px] font-bold leading-[1.25]">
            I write to request for the release of the total sum of{" "}
            <span className="inline-block min-w-[160px] border-b border-black text-center font-bold">
              {naira(req.amount)}
            </span>{" "}
            for the expense below/attached:
          </div>

          <div className="mt-1.5 min-h-[72px] whitespace-pre-wrap text-[9.5px] font-semibold leading-[1.18]">
            {req.details}
          </div>

          <div className="mt-2 text-[11px] font-bold">Wassalamu` Alaikum.</div>

          <div className="mt-2 flex justify-end">
            <div className="w-[330px] space-y-1">
              <SmallFieldRow label="ALLOCATION B/D:" value={naira(subhead?.approved_allocation)} />
              <SmallFieldRow label="EXPENDITURE:" value={naira(subhead?.expenditure)} />
              <SmallFieldRow label="BALANCE C/D:" value={naira(subhead?.balance)} />
            </div>
          </div>

          <div className="mt-2 h-[1px] w-full bg-blue-300" />

          <div className="mt-2 space-y-1.5 text-[10px] font-bold">
            <SignatureLine
              label="Requested by:"
              name={requester?.full_name || ""}
              sigUrl={sigRequester}
              date={formatDate(req.created_at)}
            />

            <SignatureLine
              label="Checked by:"
              name={req.checked_by_name || ""}
              sigUrl={sigChecked}
              date={formatDate(req.created_at)}
            />

            <SignatureLine
              label="Approved by DG, IET:"
              name={req.dg_approved_by_name || ""}
              sigUrl={sigDG}
              date={formatDate(req.created_at)}
            />

            <SignatureLine
              label="Paid by Account:"
              name={req.account_paid_by_name || ""}
              sigUrl={sigAccount}
              date={formatDate(req.created_at)}
            />
          </div>

          {hist.length > 0 && (
            <>
              <div className="mt-2 h-[1px] w-full bg-blue-300" />
              <div className="mt-1.5">
                <div className="text-[10px] font-black uppercase">Comments Trail</div>

                <div className="mt-1 space-y-1">
                  {hist.slice(0, 6).map((h) => (
                    <div key={h.id} className="rounded border border-slate-300 px-2 py-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-[8.8px] font-bold">
                          {(h.actor_name || "—")} • {h.action_type || "—"} • {h.to_stage || "—"}
                        </div>
                        <div className="text-[8px] font-semibold">
                          {formatDate(h.created_at)}
                        </div>
                      </div>

                      <div className="mt-0.5 whitespace-pre-wrap text-[8.6px] text-slate-800 leading-[1.15]">
                        {h.comment || "No comment"}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          <div className="mt-2 text-center text-[10px] italic font-medium">
            Building Bridges
          </div>
        </div>
      </div>
    </main>
  );
}

function TopLineField({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={`flex items-end gap-1 ${className || ""}`}>
      <div className="shrink-0 text-[9px] font-bold">{label}</div>
      <div className="min-w-0 flex-1 border-b border-black px-1 pb-[1px] text-[9px] font-semibold leading-tight break-words">
        {value}
      </div>
    </div>
  );
}

function SmallFieldRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-end gap-2">
      <div className="w-[130px] text-right text-[9.5px] font-black">{label}</div>
      <div className="h-[19px] w-[190px] rounded border border-black px-2 text-right text-[9px] font-semibold leading-[17px]">
        {value}
      </div>
    </div>
  );
}

function SignatureLine({
  label,
  name,
  sigUrl,
  date,
}: {
  label: string;
  name: string;
  sigUrl: string | null;
  date: string;
}) {
  return (
    <div>
      <div className="grid grid-cols-[110px_2fr_0.68fr_0.68fr] items-end gap-2">
        <div className="whitespace-nowrap">{label}</div>

        <div className="border-b border-black pb-[1px] text-[9px] font-semibold pr-1">
          {name}
        </div>

        <div className="relative h-[18px] border-b border-black">
          {sigUrl ? (
            <img
              src={sigUrl}
              alt="signature"
              className="absolute bottom-0 left-1/2 h-[14px] max-w-[90%] -translate-x-1/2 object-contain"
            />
          ) : null}
        </div>

        <div className="border-b border-black pb-[1px] text-center text-[9px] font-semibold">
          {date}
        </div>
      </div>

      <div className="grid grid-cols-[110px_2fr_0.68fr_0.68fr] gap-2 pt-0.5 text-center text-[7.5px] font-medium text-slate-600">
        <div />
        <div>Name</div>
        <div>Signature</div>
        <div>Date</div>
      </div>
    </div>
  );
}