"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
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
  request_type: "Official" | "Personal";
  personal_category: "Fund" | "NonFund" | null;

  requester_name: string | null;
  requester_comment: string | null;
  requester_signature_snapshot: string | null;

  checked_by_name: string | null;
  checked_comment: string | null;
  checked_signature_snapshot: string | null;

  hr_name: string | null;
  hr_comment: string | null;
  hr_signature_snapshot: string | null;

  dg_name: string | null;
  dg_comment: string | null;
  dg_signature_snapshot: string | null;

  account_name: string | null;
  account_comment: string | null;
  account_signature_snapshot: string | null;

  assigned_account_officer_name: string | null;
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

type Hist = {
  id: string;
  action_type: string;
  comment: string | null;
  to_stage: string | null;
  from_stage: string | null;
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

function getPublicSignatureUrl(value: string | null | undefined) {
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

  const cleaned = raw.replace(/^signatures\//, "").replace(/^\/+/, "");
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!base) return null;

  return `${base}/storage/v1/object/public/signatures/${cleaned}`;
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

  const [sigRequester, setSigRequester] = useState<string | null>(null);
  const [sigChecked, setSigChecked] = useState<string | null>(null);
  const [sigHR, setSigHR] = useState<string | null>(null);
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
          request_type,
          personal_category,
          requester_name,
          requester_comment,
          requester_signature_snapshot,
          checked_by_name,
          checked_comment,
          checked_signature_snapshot,
          hr_name,
          hr_comment,
          hr_signature_snapshot,
          dg_name,
          dg_comment,
          dg_signature_snapshot,
          account_name,
          account_comment,
          account_signature_snapshot,
          assigned_account_officer_name
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

      const [deptRes, subRes, histRes] = await Promise.all([
        supabase
          .from("departments")
          .select("id,name")
          .eq("id", reqRow.dept_id)
          .single(),

        reqRow.subhead_id
          ? supabase
              .from("subheads")
              .select("id,code,name,approved_allocation,expenditure,balance")
              .eq("id", reqRow.subhead_id)
              .single()
          : Promise.resolve({ data: null } as any),

        supabase
          .from("request_history")
          .select("id,action_type,comment,to_stage,from_stage,created_at,actor_name")
          .eq("request_id", reqRow.id)
          .order("created_at", { ascending: true }),
      ]);

      if (deptRes.data) setDept(deptRes.data as Dept);
      if (subRes.data) setSubhead(subRes.data as Subhead);
      if (histRes.data) setHistory((histRes.data || []) as Hist[]);

      setSigRequester(getPublicSignatureUrl(reqRow.requester_signature_snapshot));
      setSigChecked(getPublicSignatureUrl(reqRow.checked_signature_snapshot));
      setSigHR(getPublicSignatureUrl(reqRow.hr_signature_snapshot));
      setSigDG(getPublicSignatureUrl(reqRow.dg_signature_snapshot));
      setSigAccount(getPublicSignatureUrl(reqRow.account_signature_snapshot));

      setLoading(false);
    }

    load();
  }, [id, router]);

  useEffect(() => {
    document.title = req?.request_no || "request-print";
  }, [req?.request_no]);

  const requiresAccountLine = useMemo(() => {
    if (!req) return false;
    if ((req.request_type || "").toUpperCase() === "OFFICIAL") return true;
    return (req.personal_category || "").toUpperCase() === "FUND";
  }, [req]);

  const ready = useMemo(() => {
    if (!req) return false;

    const requesterReady = !!req.requester_name && !!sigRequester;
    const checkedReady = !!req.checked_by_name && !!sigChecked;
    const dgReady = !!req.dg_name && !!sigDG;
    const accountReady = requiresAccountLine ? !!req.account_name && !!sigAccount : true;

    return requesterReady && checkedReady && dgReady && accountReady;
  }, [req, sigRequester, sigChecked, sigDG, sigAccount, requiresAccountLine]);

  function handlePrint() {
    if (!ready) {
      setMsg("Printing is blocked until the required request signatures are fully available.");
      return;
    }
    window.print();
  }

  const commentTrail = useMemo(() => {
    return history.filter((h) => (h.comment || "").trim().length > 0);
  }, [history]);

  if (loading) {
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
          margin: 6mm;
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

      <div className="mx-auto max-w-[820px]">
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

        {!ready && (
          <div className="no-print mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Printing is blocked until the required request signatures are fully available.
          </div>
        )}

        <div className="sheet mx-auto w-full bg-white px-[18px] py-[12px] text-black">
          <div className="text-center">
            <div className="mx-auto flex justify-center">
              <Image
                src="/iet-logo.png"
                alt="IET Logo"
                width={48}
                height={48}
                className="h-[48px] w-auto object-contain"
                priority
              />
            </div>

            <div className="mt-1 text-[15px] font-black uppercase leading-none tracking-tight">
              Islamic Education Trust
            </div>
            <div className="mt-0.5 text-[9.5px] font-semibold leading-tight">
              IW2, Ilmi Avenue Intermediate Housing Estate
            </div>
            <div className="text-[9.5px] font-semibold leading-tight">
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

          <div className="mt-2 text-[10.5px] font-bold leading-[1.2]">
            <div>The Director General,</div>
            <div>Islamic Education Trust,</div>
            <div>Minna.</div>
          </div>

          <div className="mt-2.5 text-[10.5px] font-bold">Assalamu` Alaikum Sir,</div>

          <div className="mt-1 text-center text-[11.5px] font-black uppercase">
            Request for Fund
          </div>

          <div className="mt-1 text-[9.5px] font-bold leading-[1.2]">
            I write to request for the release of the total sum of{" "}
            <span className="inline-block min-w-[150px] border-b border-black text-center font-bold">
              {naira(req.amount)}
            </span>{" "}
            for the expense below/attached:
          </div>

          <div className="mt-1 min-h-[54px] whitespace-pre-wrap text-[9px] font-semibold leading-[1.12]">
            {req.details}
          </div>

          <div className="mt-1.5 text-[10.5px] font-bold">Wassalamu` Alaikum.</div>

          <div className="mt-1.5 flex justify-end">
            <div className="w-[320px] space-y-1">
              <SmallFieldRow label="ALLOCATION B/D:" value={naira(subhead?.approved_allocation)} />
              <SmallFieldRow label="EXPENDITURE:" value={naira(subhead?.expenditure)} />
              <SmallFieldRow label="BALANCE C/D:" value={naira(subhead?.balance)} />
            </div>
          </div>

          <div className="mt-2 h-[1px] w-full bg-blue-300" />

          <div className="mt-1.5 space-y-1 text-[9.5px] font-bold">
            <SignatureLine
              label="Requested by:"
              name={req.requester_name || ""}
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
              name={req.dg_name || ""}
              sigUrl={sigDG}
              date={formatDate(req.created_at)}
            />

            {requiresAccountLine && (
              <SignatureLine
                label="Paid by Account:"
                name={req.account_name || ""}
                sigUrl={sigAccount}
                date={formatDate(req.created_at)}
              />
            )}
          </div>

          {(req.checked_comment || req.hr_comment || req.dg_comment || req.account_comment) && (
            <>
              <div className="mt-2 h-[1px] w-full bg-blue-300" />
              <div className="mt-1">
                <div className="text-[9px] font-black uppercase">Approval Notes</div>

                <div className="mt-1 space-y-1">
                  {req.checked_comment && (
                    <CompactComment
                      name={req.checked_by_name || "Checked by"}
                      role="Department Recommendation"
                      comment={req.checked_comment}
                    />
                  )}

                  {req.hr_comment && (
                    <CompactComment
                      name={req.hr_name || "HR"}
                      role="HR"
                      comment={req.hr_comment}
                    />
                  )}

                  {req.dg_comment && (
                    <CompactComment
                      name={req.dg_name || "DG"}
                      role="DG"
                      comment={req.dg_comment}
                    />
                  )}

                  {req.account_comment && (
                    <CompactComment
                      name={req.account_name || "Account"}
                      role="Account"
                      comment={req.account_comment}
                    />
                  )}
                </div>
              </div>
            </>
          )}

          {commentTrail.length > 0 && (
            <>
              <div className="mt-2 h-[1px] w-full bg-blue-300" />
              <div className="mt-1">
                <div className="text-[9px] font-black uppercase">Workflow Trail</div>

                <div className="mt-1 space-y-1">
                  {commentTrail.slice(0, 5).map((h) => (
                    <div key={h.id} className="rounded border border-slate-300 px-2 py-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-[8px] font-bold">
                          {h.actor_name || "—"} • {h.action_type || "—"} • {h.to_stage || "—"}
                        </div>
                        <div className="text-[7.6px] font-semibold">
                          {formatDate(h.created_at)}
                        </div>
                      </div>

                      <div className="mt-0.5 whitespace-pre-wrap text-[7.8px] text-slate-800 leading-[1.1]">
                        {h.comment || "No comment"}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          <div className="mt-2 text-center text-[9px] italic font-medium">
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
      <div className="shrink-0 text-[8.5px] font-bold">{label}</div>
      <div className="min-w-0 flex-1 border-b border-black px-1 pb-[1px] text-[8.5px] font-semibold leading-tight break-words">
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
      <div className="w-[128px] text-right text-[8.8px] font-black">{label}</div>
      <div className="h-[18px] w-[185px] rounded border border-black px-2 text-right text-[8.5px] font-semibold leading-[16px]">
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
      <div className="grid grid-cols-[120px_2fr_0.72fr_0.72fr] items-end gap-2">
        <div className="whitespace-nowrap">{label}</div>

        <div className="border-b border-black pb-[1px] text-[8.8px] font-semibold pr-1">
          {name}
        </div>

        <div className="relative h-[18px] border-b border-black">
          {sigUrl ? (
            <img
              src={sigUrl}
              alt="signature"
              className="absolute bottom-0 left-1/2 h-[13px] max-w-[90%] -translate-x-1/2 object-contain"
            />
          ) : null}
        </div>

        <div className="border-b border-black pb-[1px] text-center text-[8.8px] font-semibold">
          {date}
        </div>
      </div>

      <div className="grid grid-cols-[120px_2fr_0.72fr_0.72fr] gap-2 pt-0.5 text-center text-[7px] font-medium text-slate-600">
        <div />
        <div>Name</div>
        <div>Signature</div>
        <div>Date</div>
      </div>
    </div>
  );
}

function CompactComment({
  name,
  role,
  comment,
}: {
  name: string;
  role: string;
  comment: string;
}) {
  return (
    <div className="rounded border border-slate-300 px-2 py-1">
      <div className="text-[7.8px] font-bold">
        {name} • {role}
      </div>
      <div className="mt-0.5 whitespace-pre-wrap text-[7.8px] text-slate-800 leading-[1.08]">
        {comment}
      </div>
    </div>
  );
}