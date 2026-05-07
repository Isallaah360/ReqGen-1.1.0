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
  reserved_amount: number | null;
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
  signature_url: string | null;
};

type ProfileMini = {
  id: string;
  role: string | null;
};

function roleKey(role: string | null | undefined) {
  return (role || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/_/g, "");
}

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

function isCompletedOrPaid(status: string | null | undefined) {
  const s = (status || "").trim().toLowerCase();
  return s === "paid" || s === "completed" || s.includes("paid") || s.includes("completed");
}

function isAccountRole(rk: string) {
  return ["account", "accounts", "accountofficer"].includes(rk);
}

function canRolePrintRequest(rk: string, req: Req | null) {
  if (!req) return false;

  const isOfficial = (req.request_type || "").toUpperCase() === "OFFICIAL";
  const isPersonalFund =
    (req.request_type || "").toUpperCase() === "PERSONAL" &&
    (req.personal_category || "").toUpperCase() === "FUND";
  const isPersonalNonFund =
    (req.request_type || "").toUpperCase() === "PERSONAL" &&
    (req.personal_category || "").toUpperCase() === "NONFUND";

  if (["admin", "auditor"].includes(rk)) return true;

  if (isOfficial) {
    return isAccountRole(rk);
  }

  if (isPersonalFund) {
    return isAccountRole(rk) || rk === "hr";
  }

  if (isPersonalNonFund) {
    return rk === "hr";
  }

  return false;
}

export default function PrintRequestPage() {
  const router = useRouter();
  const params = useParams();
  const id = String((params as any)?.id || "");

  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  const [me, setMe] = useState<ProfileMini | null>(null);
  const [req, setReq] = useState<Req | null>(null);
  const [dept, setDept] = useState<Dept | null>(null);
  const [subhead, setSubhead] = useState<Subhead | null>(null);
  const [history, setHistory] = useState<Hist[]>([]);

  const [sigRequester, setSigRequester] = useState<string | null>(null);
  const [sigChecked, setSigChecked] = useState<string | null>(null);
  const [sigHR, setSigHR] = useState<string | null>(null);
  const [sigDG, setSigDG] = useState<string | null>(null);
  const [sigAccount, setSigAccount] = useState<string | null>(null);
  const [sigHRFiling, setSigHRFiling] = useState<string | null>(null);

  const rk = roleKey(me?.role);

  const isOfficial = useMemo(() => {
    return (req?.request_type || "").toUpperCase() === "OFFICIAL";
  }, [req?.request_type]);

  const isPersonalFund = useMemo(() => {
    return (
      (req?.request_type || "").toUpperCase() === "PERSONAL" &&
      (req?.personal_category || "").toUpperCase() === "FUND"
    );
  }, [req?.request_type, req?.personal_category]);

  const isPersonalNonFund = useMemo(() => {
    return (
      (req?.request_type || "").toUpperCase() === "PERSONAL" &&
      (req?.personal_category || "").toUpperCase() === "NONFUND"
    );
  }, [req?.request_type, req?.personal_category]);

  const canOpenPrintPage = useMemo(() => {
    return canRolePrintRequest(rk, req);
  }, [rk, req]);

  const requestIsCompletedForPrint = useMemo(() => {
    return isCompletedOrPaid(req?.status);
  }, [req?.status]);

  const hrFilingHistory = useMemo(() => {
    return history.find((h) => {
      const from = (h.from_stage || "").toUpperCase().replace(/\s+/g, "");
      const to = (h.to_stage || "").toUpperCase().replace(/\s+/g, "");
      const action = (h.action_type || "").toUpperCase();

      return (
        action === "APPROVE" &&
        (from === "HRFILING" || to === "COMPLETED")
      );
    });
  }, [history]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setMsg(null);

      if (!id) {
        setMsg("Invalid request ID.");
        setLoading(false);
        return;
      }

      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        router.push("/login");
        return;
      }

      const { data: prof, error: profErr } = await supabase
        .from("profiles")
        .select("id,role")
        .eq("id", auth.user.id)
        .single();

      if (profErr) {
        setMsg("Failed to load your profile: " + profErr.message);
        setLoading(false);
        return;
      }

      const myProfile = prof as ProfileMini;
      setMe(myProfile);

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

      const myRole = roleKey(myProfile.role);
      const allowedRole = canRolePrintRequest(myRole, reqRow);

      if (!allowedRole) {
        setMsg(
          "Access denied. You do not have permission to print this request type."
        );
        setLoading(false);
        return;
      }

      if (!isCompletedOrPaid(reqRow.status)) {
        setMsg("Printing is allowed only after the request has been completed or paid.");
        setLoading(false);
        return;
      }

      const [deptRes, subRes, histRes] = await Promise.all([
        supabase
          .from("departments")
          .select("id,name")
          .eq("id", reqRow.dept_id)
          .single(),

        reqRow.subhead_id
          ? supabase
              .from("subheads")
              .select("id,code,name,approved_allocation,reserved_amount,expenditure,balance")
              .eq("id", reqRow.subhead_id)
              .single()
          : Promise.resolve({ data: null } as any),

        supabase
          .from("request_history")
          .select("id,action_type,comment,to_stage,from_stage,created_at,actor_name,signature_url")
          .eq("request_id", reqRow.id)
          .order("created_at", { ascending: true }),
      ]);

      if (deptRes.data) setDept(deptRes.data as Dept);
      if (subRes.data) setSubhead(subRes.data as Subhead);

      const histRows = (histRes.data || []) as Hist[];
      setHistory(histRows);

      const filingHist = histRows.find((h) => {
        const from = (h.from_stage || "").toUpperCase().replace(/\s+/g, "");
        const to = (h.to_stage || "").toUpperCase().replace(/\s+/g, "");
        const action = (h.action_type || "").toUpperCase();

        return action === "APPROVE" && (from === "HRFILING" || to === "COMPLETED");
      });

      setSigRequester(getPublicSignatureUrl(reqRow.requester_signature_snapshot));
      setSigChecked(getPublicSignatureUrl(reqRow.checked_signature_snapshot));
      setSigHR(getPublicSignatureUrl(reqRow.hr_signature_snapshot));
      setSigDG(getPublicSignatureUrl(reqRow.dg_signature_snapshot));
      setSigAccount(getPublicSignatureUrl(reqRow.account_signature_snapshot));
      setSigHRFiling(getPublicSignatureUrl(filingHist?.signature_url));

      setLoading(false);
    }

    load();
  }, [id, router]);

  useEffect(() => {
    document.title = req?.request_no || "request-print";
  }, [req?.request_no]);

  const requiresAccountLine = useMemo(() => {
    return isOfficial || isPersonalFund;
  }, [isOfficial, isPersonalFund]);

  const printTitle = useMemo(() => {
    if (isPersonalFund) return "Personal Fund Request";
    if (isPersonalNonFund) return "Personal Non-Fund Request";
    return "Request for Fund";
  }, [isPersonalFund, isPersonalNonFund]);

  const amountText = useMemo(() => {
    if (isPersonalNonFund) return "Not Applicable";
    return naira(req?.amount);
  }, [isPersonalNonFund, req?.amount]);

  const ready = useMemo(() => {
    if (!req) return false;

    const requesterReady = !!req.requester_name && !!sigRequester;
    const checkedReady = !!req.checked_by_name && !!sigChecked;
    const dgReady = !!req.dg_name && !!sigDG;

    const hrReady = isPersonalFund || isPersonalNonFund ? !!req.hr_name && !!sigHR : true;
    const accountReady = requiresAccountLine ? !!req.account_name && !!sigAccount : true;

    const hrFilingReady = isPersonalNonFund
      ? !!hrFilingHistory?.actor_name && !!sigHRFiling
      : true;

    return (
      canOpenPrintPage &&
      requestIsCompletedForPrint &&
      requesterReady &&
      checkedReady &&
      hrReady &&
      dgReady &&
      accountReady &&
      hrFilingReady
    );
  }, [
    req,
    sigRequester,
    sigChecked,
    sigHR,
    sigDG,
    sigAccount,
    sigHRFiling,
    hrFilingHistory?.actor_name,
    requiresAccountLine,
    canOpenPrintPage,
    requestIsCompletedForPrint,
    isPersonalFund,
    isPersonalNonFund,
  ]);

  function handlePrint() {
    if (!canOpenPrintPage) {
      setMsg("Access denied. You do not have permission to print this request type.");
      return;
    }

    if (!requestIsCompletedForPrint) {
      setMsg("Printing is allowed only after the request has been completed or paid.");
      return;
    }

    if (!ready) {
      setMsg("Printing is blocked until the required request signatures are fully available.");
      return;
    }

    window.print();
  }

  const commentTrail = useMemo(() => {
    return history.filter((h) => (h.comment || "").trim().length > 0);
  }, [history]);

  const backPath = useMemo(() => {
    if (isPersonalNonFund && rk === "hr") return "/approvals";
    return "/finance/subheads";
  }, [isPersonalNonFund, rk]);

  const backLabel = useMemo(() => {
    if (isPersonalNonFund && rk === "hr") return "Back to Approvals";
    return "Back to Finance";
  }, [isPersonalNonFund, rk]);

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-100 px-4 py-8">
        <div className="mx-auto max-w-3xl rounded-2xl border bg-white p-6 text-slate-700 shadow-sm">
          Preparing final print preview...
        </div>
      </main>
    );
  }

  if (msg && (!req || !canOpenPrintPage || !requestIsCompletedForPrint)) {
    return (
      <main className="min-h-screen bg-slate-100 px-4 py-8">
        <div className="mx-auto max-w-3xl rounded-2xl border bg-white p-6 shadow-sm">
          <div className="text-lg font-bold text-slate-900">Print Access</div>
          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {msg}
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <button
              onClick={() => router.push(backPath)}
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              {backLabel}
            </button>

            <button
              onClick={() => router.push("/dashboard")}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100"
            >
              Dashboard
            </button>
          </div>
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
            onClick={() => router.push(backPath)}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100"
          >
            {backLabel}
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
            <TopLineField label="Status:" value={req.status || ""} className="col-span-3" />

            <TopLineField label="Department:" value={dept?.name || ""} className="col-span-5" />

            {isOfficial ? (
              <TopLineField
                label="Sub-Head:"
                value={subhead ? `${subhead.code || ""} ${subhead.name}`.trim() : ""}
                className="col-span-4"
              />
            ) : (
              <TopLineField
                label="Type:"
                value={
                  isPersonalFund
                    ? "Personal Fund"
                    : isPersonalNonFund
                    ? "Personal Non-Fund"
                    : "Personal"
                }
                className="col-span-4"
              />
            )}

            <TopLineField label="Stage:" value={req.current_stage || ""} className="col-span-3" />
          </div>

          <div className="mt-1 h-[1px] w-full bg-blue-300" />

          <div className="mt-2 text-[10.5px] font-bold leading-[1.2]">
            <div>The Director General,</div>
            <div>Islamic Education Trust,</div>
            <div>Minna.</div>
          </div>

          <div className="mt-2.5 text-[10.5px] font-bold">Assalamu` Alaikum Sir,</div>

          <div className="mt-1 text-center text-[11.5px] font-black uppercase">
            {printTitle}
          </div>

          {!isPersonalNonFund ? (
            <div className="mt-1 text-[9.5px] font-bold leading-[1.2]">
              I write to request for the release of the total sum of{" "}
              <span className="inline-block min-w-[150px] border-b border-black text-center font-bold">
                {amountText}
              </span>{" "}
              for the purpose below/attached:
            </div>
          ) : (
            <div className="mt-1 text-[9.5px] font-bold leading-[1.2]">
              I write to request consideration and approval for the personal non-fund matter
              stated below/attached:
            </div>
          )}

          <div className="mt-1 min-h-[54px] whitespace-pre-wrap text-[9px] font-semibold leading-[1.12]">
            {req.details}
          </div>

          <div className="mt-1.5 text-[10.5px] font-bold">Wassalamu` Alaikum.</div>

          {isOfficial && (
            <div className="mt-1.5 flex justify-end">
              <div className="w-[320px] space-y-1">
                <SmallFieldRow label="ALLOCATION B/D:" value={naira(subhead?.approved_allocation)} />
                <SmallFieldRow label="RESERVED:" value={naira(subhead?.reserved_amount)} />
                <SmallFieldRow label="EXPENDITURE:" value={naira(subhead?.expenditure)} />
                <SmallFieldRow label="BALANCE C/D:" value={naira(subhead?.balance)} />
              </div>
            </div>
          )}

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

            {(isPersonalFund || isPersonalNonFund) && (
              <SignatureLine
                label="Reviewed by HR:"
                name={req.hr_name || ""}
                sigUrl={sigHR}
                date={formatDate(req.created_at)}
              />
            )}

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

            {isPersonalNonFund && (
              <SignatureLine
                label="Filed by HR:"
                name={hrFilingHistory?.actor_name || ""}
                sigUrl={sigHRFiling}
                date={formatDate(hrFilingHistory?.created_at)}
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
                      role="HR Review"
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

                  {req.account_comment && requiresAccountLine && (
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