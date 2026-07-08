"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Req = {
  id: string;
  request_no: string;
  title: string;
  details: string;
  amount: number | null;

  created_by: string;
  dept_id: string;
  dept_name: string | null;

  subhead_id: string | null;
  subhead_code: string | null;
  subhead_name: string | null;
  approved_allocation: number | null;
  reserved_amount: number | null;
  expenditure: number | null;
  balance: number | null;

  current_stage: string;
  status: string;
  created_at: string;

  request_type: "Official" | "Personal" | string;
  personal_category:
  | "Fund"
  | "Leave"
  | "Contract Renewal"
  | "Resignation"
  | "Others"
  | "NonFund"
  | string
  | null;

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

type Hist = {
  id: string;
  action_type: string | null;
  comment: string | null;
  to_stage: string | null;
  from_stage: string | null;
  created_at: string;
  actor_name: string | null;
  signature_url: string | null;
  actor_role_key: string | null;
  actor_role_name: string | null;
  actor_signature_url: string | null;
};

type ProfileMini = {
  id: string;
  role: string | null;
};

type ProfileRole = {
  id: string;
  profile_id: string;
  role_key: string;
  role_name: string;
  is_primary: boolean;
  is_active: boolean;
};

function roleKey(role: string | null | undefined) {
  return (role || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/_/g, "");
}

function normalize(v: string | null | undefined) {
  return (v || "").toLowerCase().replace(/[^a-z]/g, "");
}

function stageKey(stage: string | null | undefined) {
  return (stage || "")
    .trim()
    .toUpperCase()
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

function isCompletedOrPaid(status: string | null | undefined, stage?: string | null) {
  const s = (status || "").trim().toLowerCase();
  const stg = stageKey(stage);

  return (
    stg === "COMPLETED" ||
    s === "paid" ||
    s === "completed" ||
    s.includes("paid") ||
    s.includes("completed") ||
    s.includes("closed")
  );
}

function hasAnyRole(roleSet: Set<string>, keys: string[]) {
  return keys.some((k) => roleSet.has(roleKey(k)));
}

function isAccountRole(rk: string) {
  return ["account", "accounts", "accountofficer", "pvsigner", "pvcountersigner"].includes(rk);
}

function canRolePrintRequest(roleSet: Set<string>, req: Req | null) {
  if (!req) return false;

  const isOfficial = normalize(req.request_type) === "official";
  const isPersonalFund =
    normalize(req.request_type) === "personal" && normalize(req.personal_category) === "fund";
  const isPersonalOther = normalize(req.request_type) === "personal" && !isPersonalFund;

  if (hasAnyRole(roleSet, ["admin", "auditor"])) return true;

  const hasAccount = Array.from(roleSet).some(isAccountRole);
  const hasHR = hasAnyRole(roleSet, ["hr", "hrofficer1", "hrofficer2", "hrofficer3"]);

  if (isOfficial) return hasAccount;
  if (isPersonalFund) return hasAccount || hasHR;
  if (isPersonalOther) return hasHR;

  return false;
}

function roleCapacity(h: Hist | null | undefined, fallback: string) {
  return h?.actor_role_name || h?.actor_role_key || fallback;
}

function histSignatureUrl(h: Hist | null | undefined, fallback: string | null | undefined) {
  return getPublicSignatureUrl(h?.actor_signature_url || h?.signature_url || fallback);
}

function isApproveHistory(h: Hist) {
  return normalize(h.action_type) === "approve";
}

function isRoleOneOf(h: Hist, keys: string[]) {
  const rk = roleKey(h.actor_role_key || h.actor_role_name || "");
  return keys.map(roleKey).includes(rk);
}

function isStageOneOf(value: string | null | undefined, stages: string[]) {
  const s = stageKey(value);
  return stages.map(stageKey).includes(s);
}

function findLatestHistory(history: Hist[], predicate: (h: Hist) => boolean): Hist | null {
  return history.find(predicate) || null;
}

function requestCategoryLabel(req: Req | null) {
  if (!req) return "—";

  if (normalize(req.request_type) === "official") return "Official";

  if (normalize(req.personal_category) === "fund") return "Personal Fund";

  const cat = (req.personal_category || "").trim();
  if (cat && normalize(cat) !== "nonfund") return `Personal ${cat}`;

  return "Personal Other";
}

export default function PrintRequestPage() {
  const router = useRouter();
  const params = useParams();
  const id = String((params as any)?.id || "");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [me, setMe] = useState<ProfileMini | null>(null);
  const [myRoles, setMyRoles] = useState<ProfileRole[]>([]);
  const [req, setReq] = useState<Req | null>(null);
  const [history, setHistory] = useState<Hist[]>([]);

  const roleSet = useMemo(() => {
    const set = new Set<string>();

    if (me?.role) set.add(roleKey(me.role));

    myRoles.forEach((r) => {
      if (r.is_active) set.add(roleKey(r.role_key));
    });

    return set;
  }, [me?.role, myRoles]);

  const isOfficial = useMemo(() => {
    return normalize(req?.request_type) === "official";
  }, [req?.request_type]);

  const isPersonalFund = useMemo(() => {
    return normalize(req?.request_type) === "personal" && normalize(req?.personal_category) === "fund";
  }, [req?.request_type, req?.personal_category]);

  const isPersonalOther = useMemo(() => {
    return normalize(req?.request_type) === "personal" && !isPersonalFund;
  }, [req?.request_type, isPersonalFund]);

  const isPersonal = useMemo(() => {
    return normalize(req?.request_type) === "personal";
  }, [req?.request_type]);

  const requiresAccountLine = useMemo(() => {
    return isOfficial || isPersonalFund;
  }, [isOfficial, isPersonalFund]);

  const canOpenPrintPage = useMemo(() => {
    return canRolePrintRequest(roleSet, req);
  }, [roleSet, req]);

  const requestIsCompletedForPrint = useMemo(() => {
    return isCompletedOrPaid(req?.status, req?.current_stage);
  }, [req?.status, req?.current_stage]);

  const checkedHistory = useMemo(() => {
    return findLatestHistory(history, (h) => {
      if (!isApproveHistory(h)) return false;

      if (
        isRoleOneOf(h, [
          "po",
          "dod",
          "director",
          "dinadmin",
          "dinadmin1",
          "dinadmin2",
          "dinadmin3",
          "registrar",
          "hod",
        ])
      ) {
        return true;
      }

      return isStageOneOf(h.from_stage, ["PO", "DOD", "Director", "DIN Admin", "Registrar", "HOD"]);
    });
  }, [history]);

  const hrHistory = useMemo(() => {
    return findLatestHistory(history, (h) => {
      if (!isApproveHistory(h)) return false;

      return (
        isRoleOneOf(h, ["hr", "hrofficer1", "hrofficer2", "hrofficer3"]) &&
        isStageOneOf(h.from_stage, ["HR"])
      );
    });
  }, [history]);

  const dgHistory = useMemo(() => {
    return findLatestHistory(history, (h) => {
      if (!isApproveHistory(h)) return false;

      return isRoleOneOf(h, ["dg"]) || isStageOneOf(h.from_stage, ["DG"]);
    });
  }, [history]);

  const accountHistory = useMemo(() => {
    return findLatestHistory(history, (h) => {
      if (!isApproveHistory(h)) return false;

      return (
        isRoleOneOf(h, ["account", "accounts", "accountofficer"]) ||
        isStageOneOf(h.from_stage, ["Account"])
      );
    });
  }, [history]);

  const hrFilingHistory = useMemo(() => {
    return findLatestHistory(history, (h) => {
      if (!isApproveHistory(h)) return false;

      return isStageOneOf(h.from_stage, ["HR Filing"]) || isStageOneOf(h.to_stage, ["Completed"]);
    });
  }, [history]);

  const sigRequester = useMemo(() => {
    return getPublicSignatureUrl(req?.requester_signature_snapshot);
  }, [req?.requester_signature_snapshot]);

  const sigChecked = useMemo(() => {
    return histSignatureUrl(checkedHistory, req?.checked_signature_snapshot);
  }, [checkedHistory, req?.checked_signature_snapshot]);

  const sigHR = useMemo(() => {
    return histSignatureUrl(hrHistory, req?.hr_signature_snapshot);
  }, [hrHistory, req?.hr_signature_snapshot]);

  const sigDG = useMemo(() => {
    return histSignatureUrl(dgHistory, req?.dg_signature_snapshot);
  }, [dgHistory, req?.dg_signature_snapshot]);

  const sigAccount = useMemo(() => {
    return histSignatureUrl(accountHistory, req?.account_signature_snapshot);
  }, [accountHistory, req?.account_signature_snapshot]);

  const sigHRFiling = useMemo(() => {
    return histSignatureUrl(hrFilingHistory, null);
  }, [hrFilingHistory]);

  const load = useCallback(
    async (options?: { silent?: boolean }) => {
      if (options?.silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setMsg(null);

      if (!id) {
        setMsg("Invalid request ID.");
        setLoading(false);
        setRefreshing(false);
        return null;
      }

      const { data: auth } = await supabase.auth.getUser();

      if (!auth.user) {
        router.push("/login");
        return null;
      }

      const [profRes, rolesRes] = await Promise.all([
        supabase.from("profiles").select("id,role").eq("id", auth.user.id).maybeSingle(),

        supabase
          .from("profile_roles")
          .select("id,profile_id,role_key,role_name,is_primary,is_active")
          .eq("profile_id", auth.user.id)
          .eq("is_active", true),
      ]);

      if (profRes.error || !profRes.data) {
        setMsg("Failed to load your profile: " + (profRes.error?.message || "Profile not found."));
        setLoading(false);
        setRefreshing(false);
        return null;
      }

      const myProfile = profRes.data as ProfileMini;
      const activeRoles = (rolesRes.data || []) as ProfileRole[];

      setMe(myProfile);
      setMyRoles(activeRoles);

      const nextRoleSet = new Set<string>();

      if (myProfile.role) nextRoleSet.add(roleKey(myProfile.role));

      activeRoles.forEach((r) => {
        if (r.is_active) nextRoleSet.add(roleKey(r.role_key));
      });

      const { data: printRows, error: rErr } = await supabase.rpc("get_print_request_detail", {
        p_request_id: id,
      });

      if (rErr) {
        setMsg("Failed to load request: " + rErr.message);
        setReq(null);
        setHistory([]);
        setLoading(false);
        setRefreshing(false);
        return null;
      }

      const reqRow = Array.isArray(printRows)
        ? (printRows[0] as Req | undefined)
        : (printRows as Req | undefined);

      if (!reqRow) {
        setMsg("Request not found or you do not have access.");
        setReq(null);
        setHistory([]);
        setLoading(false);
        setRefreshing(false);
        return null;
      }

      setReq(reqRow);

      if (!canRolePrintRequest(nextRoleSet, reqRow)) {
        setMsg("Access denied. You do not have permission to print this request type.");
        setLoading(false);
        setRefreshing(false);
        return {
          req: reqRow,
          history: [] as Hist[],
          roleSet: nextRoleSet,
        };
      }

      if (!isCompletedOrPaid(reqRow.status, reqRow.current_stage)) {
        setMsg("Printing is allowed only after the request has been completed or paid.");
        setLoading(false);
        setRefreshing(false);
        return {
          req: reqRow,
          history: [] as Hist[],
          roleSet: nextRoleSet,
        };
      }

      const { data: histRows, error: histErr } = await supabase
        .from("request_history")
        .select(
          "id,action_type,comment,to_stage,from_stage,created_at,actor_name,signature_url,actor_role_key,actor_role_name,actor_signature_url"
        )
        .eq("request_id", id)
        .order("created_at", { ascending: false });

      if (histErr) {
        setMsg("Failed to load request history: " + histErr.message);
        setHistory([]);
        setLoading(false);
        setRefreshing(false);
        return {
          req: reqRow,
          history: [] as Hist[],
          roleSet: nextRoleSet,
        };
      }

      const historyRows = (histRows || []) as Hist[];
      setHistory(historyRows);

      setLoading(false);
      setRefreshing(false);

      return {
        req: reqRow,
        history: historyRows,
        roleSet: nextRoleSet,
      };
    },
    [id, router]
  );

  useEffect(() => {
    load();

    const refreshOnFocus = () => {
      load({ silent: true });
    };

    const refreshOnVisible = () => {
      if (document.visibilityState === "visible") {
        load({ silent: true });
      }
    };

    window.addEventListener("focus", refreshOnFocus);
    document.addEventListener("visibilitychange", refreshOnVisible);

    return () => {
      window.removeEventListener("focus", refreshOnFocus);
      document.removeEventListener("visibilitychange", refreshOnVisible);
    };
  }, [load]);

  useEffect(() => {
    document.title = req?.request_no || "request-print";
  }, [req?.request_no]);

  const printTitle = useMemo(() => {
    if (isPersonalFund) return "Personal Fund Request";
    if (isPersonalOther) return "Personal Request";
    return "Request for Fund";
  }, [isPersonalFund, isPersonalOther]);

  const amountText = useMemo(() => {
    if (isPersonalOther) return "Not Applicable";
    return naira(req?.amount);
  }, [isPersonalOther, req?.amount]);

  const backPath = useMemo(() => {
    if (hasAnyRole(roleSet, ["hr", "hrofficer1", "hrofficer2", "hrofficer3"]) && isPersonal) {
      return "/hr/filing";
    }

    if (hasAnyRole(roleSet, ["account", "accounts", "accountofficer", "admin", "auditor"])) {
      return "/finance";
    }

    return "/requests";
  }, [roleSet, isPersonal]);

  const backLabel = useMemo(() => {
    if (backPath === "/hr/filing") return "Back to HR Filing";
    if (backPath === "/finance") return "Back to Finance";
    return "Back to Requests";
  }, [backPath]);

  const ready = useMemo(() => {
    if (!req) return false;

    const requesterReady = !!req.requester_name && !!sigRequester;
    const checkedReady = !!(checkedHistory?.actor_name || req.checked_by_name) && !!sigChecked;
    const dgReady = !!(dgHistory?.actor_name || req.dg_name) && !!sigDG;

    const hrReady = isPersonal ? !!(hrHistory?.actor_name || req.hr_name) && !!sigHR : true;

    const accountReady = requiresAccountLine
      ? !!(accountHistory?.actor_name || req.account_name) && !!sigAccount
      : true;

    const hrFilingReady = isPersonal
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
    checkedHistory?.actor_name,
    hrHistory?.actor_name,
    dgHistory?.actor_name,
    accountHistory?.actor_name,
    hrFilingHistory?.actor_name,
    requiresAccountLine,
    canOpenPrintPage,
    requestIsCompletedForPrint,
    isPersonal,
  ]);

  async function handlePrint() {
    setPrinting(true);
    setMsg(null);

    const latest = await load({ silent: true });
    const latestReq = latest?.req || req;
    const latestRoleSet = latest?.roleSet || roleSet;

    const latestCanPrint = canRolePrintRequest(latestRoleSet, latestReq);
    const latestCompleted = isCompletedOrPaid(latestReq?.status, latestReq?.current_stage);

    if (!latestCanPrint) {
      setMsg("Access denied. You do not have permission to print this request type.");
      setPrinting(false);
      return;
    }

    if (!latestCompleted) {
      setMsg("Printing is allowed only after the request has been completed or paid.");
      setPrinting(false);
      return;
    }

    setTimeout(() => {
      window.print();
      setPrinting(false);
    }, 250);
  }

  function goBack() {
    router.push(`${backPath}?updated=${Date.now()}`);
    router.refresh();
  }

  function goDashboard() {
    router.push(`/dashboard?updated=${Date.now()}`);
    router.refresh();
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
              onClick={goBack}
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              {backLabel}
            </button>

            <button
              onClick={goDashboard}
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
        <div className="no-print mb-3 flex flex-wrap items-center justify-between gap-2">
          <button
            onClick={goBack}
            disabled={refreshing || printing}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100 disabled:opacity-60"
          >
            {backLabel}
          </button>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => load({ silent: true })}
              disabled={refreshing || printing}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100 disabled:opacity-60"
            >
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>

            <button
              onClick={handlePrint}
              disabled={!ready || refreshing || printing}
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {printing ? "Preparing Print..." : "Print"}
            </button>
          </div>
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

        <div className="no-print mb-3 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-900">
          This print page refreshes before printing so the latest approval signatures, exact actor
          roles and status are used.
        </div>

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

            <TopLineField label="Department:" value={req.dept_name || ""} className="col-span-5" />

            {isOfficial ? (
              <TopLineField
                label="Sub-Head:"
                value={`${req.subhead_code || ""} ${req.subhead_name || ""}`.trim()}
                className="col-span-4"
              />
            ) : (
              <TopLineField label="Type:" value={requestCategoryLabel(req)} className="col-span-4" />
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

          <div className="mt-1 text-center text-[11.5px] font-black uppercase">{printTitle}</div>

          {!isPersonalOther ? (
            <div className="mt-1 text-[9.5px] font-bold leading-[1.2]">
              I write to request for the release of the total sum of{" "}
              <span className="inline-block min-w-[150px] border-b border-black text-center font-bold">
                {amountText}
              </span>{" "}
              for the purpose below/attached:
            </div>
          ) : (
            <div className="mt-1 text-[9.5px] font-bold leading-[1.2]">
              I write to request consideration and approval for the personal matter stated
              below/attached:
            </div>
          )}

          <div className="mt-1 min-h-[54px] whitespace-pre-wrap text-[9px] font-semibold leading-[1.12]">
            {req.details}
          </div>

          <div className="mt-1.5 text-[10.5px] font-bold">Wassalamu` Alaikum.</div>

          {isOfficial && (
            <div className="mt-1.5 flex justify-end">
              <div className="w-[320px] space-y-1">
                <SmallFieldRow label="ALLOCATION B/D:" value={naira(req.approved_allocation)} />
                <SmallFieldRow label="RESERVED:" value={naira(req.reserved_amount)} />
                <SmallFieldRow label="EXPENDITURE:" value={naira(req.expenditure)} />
                <SmallFieldRow label="BALANCE C/D:" value={naira(req.balance)} />
              </div>
            </div>
          )}

          <div className="mt-2 h-[1px] w-full bg-blue-300" />

          <div className="mt-1.5 space-y-1 text-[9.5px] font-bold">
            <SignatureLine
              label="Requested by:"
              name={req.requester_name || ""}
              capacity="Requester / Staff"
              sigUrl={sigRequester}
              date={formatDate(req.created_at)}
            />

            <SignatureLine
              label="Recommended by:"
              name={checkedHistory?.actor_name || req.checked_by_name || ""}
              capacity={roleCapacity(checkedHistory, "Department Reviewer")}
              sigUrl={sigChecked}
              date={formatDate(checkedHistory?.created_at || req.created_at)}
            />

            {isPersonal && (
              <SignatureLine
                label="Reviewed by HR:"
                name={hrHistory?.actor_name || req.hr_name || ""}
                capacity={roleCapacity(hrHistory, "HR")}
                sigUrl={sigHR}
                date={formatDate(hrHistory?.created_at || req.created_at)}
              />
            )}

            <SignatureLine
              label="Approved by:"
              name={dgHistory?.actor_name || req.dg_name || ""}
              capacity={roleCapacity(dgHistory, "DG")}
              sigUrl={sigDG}
              date={formatDate(dgHistory?.created_at || req.created_at)}
            />

            {requiresAccountLine && (
              <SignatureLine
                label="Paid by:"
                name={accountHistory?.actor_name || req.account_name || ""}
                capacity={roleCapacity(accountHistory, "AccountOfficer")}
                sigUrl={sigAccount}
                date={formatDate(accountHistory?.created_at || req.created_at)}
              />
            )}

            {isPersonal && (
              <SignatureLine
                label="Filed by:"
                name={hrFilingHistory?.actor_name || ""}
                capacity={roleCapacity(hrFilingHistory, "HR Filing")}
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
                      name={checkedHistory?.actor_name || req.checked_by_name || "Recommended by"}
                      role={roleCapacity(checkedHistory, "Department Recommendation")}
                      comment={req.checked_comment}
                    />
                  )}

                  {req.hr_comment && isPersonal && (
                    <CompactComment
                      name={hrHistory?.actor_name || req.hr_name || "HR"}
                      role={roleCapacity(hrHistory, "HR Review")}
                      comment={req.hr_comment}
                    />
                  )}

                  {req.dg_comment && (
                    <CompactComment
                      name={dgHistory?.actor_name || req.dg_name || "DG"}
                      role={roleCapacity(dgHistory, "DG Approval")}
                      comment={req.dg_comment}
                    />
                  )}

                  {req.account_comment && requiresAccountLine && (
                    <CompactComment
                      name={accountHistory?.actor_name || req.account_name || "Account"}
                      role={roleCapacity(accountHistory, "Account Treatment")}
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
                  {commentTrail.slice(0, 6).map((h) => (
                    <div key={h.id} className="rounded border border-slate-300 px-2 py-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-[8px] font-bold">
                          {h.actor_name || "—"} • {h.action_type || "—"} •{" "}
                          {h.actor_role_name || h.actor_role_key || "Role not recorded"} •{" "}
                          {h.to_stage || "—"}
                        </div>
                        <div className="text-[7.6px] font-semibold">{formatDate(h.created_at)}</div>
                      </div>

                      <div className="mt-0.5 whitespace-pre-wrap text-[7.8px] leading-[1.1] text-slate-800">
                        {h.comment || "No comment"}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          <div className="mt-2 text-center text-[9px] italic font-medium">Building Bridges</div>
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
      <div className="min-w-0 flex-1 break-words border-b border-black px-1 pb-[1px] text-[8.5px] font-semibold leading-tight">
        {value}
      </div>
    </div>
  );
}

function SmallFieldRow({ label, value }: { label: string; value: string }) {
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
  capacity,
  sigUrl,
  date,
}: {
  label: string;
  name: string;
  capacity: string;
  sigUrl: string | null;
  date: string;
}) {
  return (
    <div>
      <div className="grid grid-cols-[108px_1.5fr_1fr_0.72fr_0.72fr] items-end gap-2">
        <div className="whitespace-nowrap">{label}</div>

        <div className="border-b border-black pb-[1px] pr-1 text-[8.4px] font-semibold">{name}</div>

        <div className="border-b border-black pb-[1px] pr-1 text-[8.2px] font-semibold">
          {capacity}
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

        <div className="border-b border-black pb-[1px] text-center text-[8.4px] font-semibold">
          {date}
        </div>
      </div>

      <div className="grid grid-cols-[108px_1.5fr_1fr_0.72fr_0.72fr] gap-2 pt-0.5 text-center text-[6.8px] font-medium text-slate-600">
        <div />
        <div>Name</div>
        <div>Capacity</div>
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
      <div className="mt-0.5 whitespace-pre-wrap text-[7.8px] leading-[1.08] text-slate-800">
        {comment}
      </div>
    </div>
  );
}