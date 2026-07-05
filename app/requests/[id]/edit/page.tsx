"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type PersonalCategory =
  | "Fund"
  | "Leave"
  | "Contract Renewal"
  | "Resignation"
  | "Others"
  | "NonFund"
  | null;

type Req = {
  id: string;
  request_no: string | null;
  title: string;
  details: string;
  amount: number | null;
  status: string | null;
  current_stage: string;
  current_owner: string | null;
  created_by: string;
  dept_id: string | null;
  subhead_id: string | null;
  funds_state: string | null;
  request_type: "Personal" | "Official" | null;
  personal_category: PersonalCategory;
};

type Subhead = {
  id: string;
  code: string | null;
  name: string;
  approved_allocation: number | null;
  reserved_amount: number | null;
  expenditure: number | null;
  balance: number | null;
  is_active: boolean | null;
};

type Me = {
  id: string;
  role: string | null;
  full_name: string | null;
};

type TotpFactor = {
  id: string;
  status: string;
};

function roleKey(role: string | null | undefined) {
  return (role || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/_/g, "");
}

function stageKey(stage: string | null | undefined) {
  return (stage || "").trim().toUpperCase().replace(/\s+/g, "");
}

function categoryKey(category: string | null | undefined) {
  return (category || "").trim().toUpperCase().replace(/\s+/g, "");
}

function naira(n: number | null | undefined) {
  return "₦" + Math.round(Number(n || 0)).toLocaleString();
}

function requestTypeLabel(req: Req) {
  if (req.request_type === "Official") return "Official";

  if (req.request_type === "Personal") {
    const cat = req.personal_category || "—";

    if (categoryKey(cat) === "FUND") return "Personal Fund";
    if (categoryKey(cat) === "NONFUND") return "Personal Other";
    if (cat && cat !== "—") return `Personal ${cat}`;

    return "Personal";
  }

  return "—";
}

function isClosed(status: string | null | undefined, stage: string | null | undefined) {
  const s = String(status || "").trim();
  const stg = stageKey(stage);

  return (
    ["Rejected", "Cancelled", "Deleted", "Paid", "Closed", "Completed"].includes(s) ||
    ["DG", "ACCOUNT", "HRFILING", "COMPLETED", "REJECTED", "DELETED"].includes(stg)
  );
}

function availableBalance(s: Subhead | null) {
  if (!s) return 0;

  return (
    Number(s.approved_allocation || 0) -
    Number(s.reserved_amount || 0) -
    Number(s.expenditure || 0)
  );
}

function amountIsApplicable(req: Req | null) {
  if (!req) return false;

  if (req.request_type === "Official") return true;

  if (req.request_type === "Personal" && categoryKey(req.personal_category) === "FUND") {
    return true;
  }

  return false;
}

function editStageNote(req: Req | null) {
  if (!req) return "";

  const stage = stageKey(req.current_stage);

  if (req.request_type === "Official") {
    if (stage === "DIRECTOR") return "Official request is still at Director review stage.";
    if (stage === "DINADMIN") return "Official DIN request is still at DIN Admin review stage.";
    if (stage === "HOD") return "Official request is still at HOD review stage.";
    return "Official request editing is locked after HOD approval.";
  }

  if (req.request_type === "Personal") {
    if (stage === "HR") return "Personal request is still at HR review stage.";
    return "Personal request editing is locked after HR review.";
  }

  return "Request editing depends on current stage and ownership.";
}

export default function EditRequestPage() {
  const router = useRouter();
  const params = useParams();
  const id = String((params as any)?.id || "");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [me, setMe] = useState<Me | null>(null);
  const [req, setReq] = useState<Req | null>(null);
  const [subheads, setSubheads] = useState<Subhead[]>([]);

  const [subheadId, setSubheadId] = useState("");
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [amount, setAmount] = useState("0");

  const [totpFactorId, setTotpFactorId] = useState<string | null>(null);
  const [showMfaModal, setShowMfaModal] = useState(false);
  const [mfaCode, setMfaCode] = useState("");

  const mfaAutoSubmittingRef = useRef(false);

  const rk = roleKey(me?.role);
  const stg = stageKey(req?.current_stage);

  const isOfficial = req?.request_type === "Official";
  const isPersonal = req?.request_type === "Personal";
  const isPersonalFund = isPersonal && categoryKey(req?.personal_category) === "FUND";
  const isPersonalOther = isPersonal && !isPersonalFund;

  const isFinancialRequest = Boolean(isOfficial || isPersonalFund);

  const requestIsClosed = useMemo(() => {
    return isClosed(req?.status, req?.current_stage);
  }, [req?.status, req?.current_stage]);

  const isRequesterEarlyEdit = useMemo(() => {
    if (!req || !me) return false;

    const allowedOfficialStages = ["DIRECTOR", "DINADMIN", "HOD"];
    const allowedPersonalStages = ["HR"];

    const allowedStage =
      req.request_type === "Official"
        ? allowedOfficialStages.includes(stg)
        : req.request_type === "Personal"
          ? allowedPersonalStages.includes(stg)
          : false;

    return req.created_by === me.id && allowedStage && !requestIsClosed;
  }, [req, me, stg, requestIsClosed]);

  const isAssignedOfficerEdit = useMemo(() => {
    if (!req || !me) return false;

    const allowedRole = ["director", "dinadmin", "hod", "hr"].includes(rk);
    const ownsCurrentStage = req.current_owner === me.id;

    const allowedStage =
      req.request_type === "Official"
        ? ["DIRECTOR", "DINADMIN", "HOD"].includes(stg)
        : req.request_type === "Personal"
          ? ["HR"].includes(stg)
          : false;

    return allowedRole && ownsCurrentStage && allowedStage && !requestIsClosed;
  }, [req, me, rk, stg, requestIsClosed]);

  const isAdminAuditorEdit = useMemo(() => {
    if (!req || !me) return false;
    return ["admin", "auditor"].includes(rk) && !requestIsClosed;
  }, [req, me, rk, requestIsClosed]);

  const canEdit = useMemo(() => {
    return isRequesterEarlyEdit || isAssignedOfficerEdit || isAdminAuditorEdit;
  }, [isRequesterEarlyEdit, isAssignedOfficerEdit, isAdminAuditorEdit]);

  const canEditFinanceFields = useMemo(() => {
    if (!req || !me) return false;

    return Boolean(isOfficial && (isAssignedOfficerEdit || isAdminAuditorEdit));
  }, [req, me, isOfficial, isAssignedOfficerEdit, isAdminAuditorEdit]);

  const requesterEditingReservedFinancial = useMemo(() => {
    if (!req || !me) return false;

    return (
      isRequesterEarlyEdit &&
      Boolean(isOfficial) &&
      String(req.funds_state || "").toLowerCase() === "reserved" &&
      !canEditFinanceFields
    );
  }, [req, me, isRequesterEarlyEdit, isOfficial, canEditFinanceFields]);

  const canEditAmount = useMemo(() => {
    if (isPersonalOther) return false;
    if (requesterEditingReservedFinancial) return false;
    return canEdit;
  }, [isPersonalOther, requesterEditingReservedFinancial, canEdit]);

  const editModeLabel = useMemo(() => {
    if (isRequesterEarlyEdit) return "Requester Early-Stage Edit";
    if (isAssignedOfficerEdit) return "Assigned Officer Edit";
    if (isAdminAuditorEdit) return "Admin/Auditor Edit";
    return "Locked";
  }, [isRequesterEarlyEdit, isAssignedOfficerEdit, isAdminAuditorEdit]);

  const selectedSubhead = useMemo(() => {
    return subheads.find((s) => s.id === subheadId) || null;
  }, [subheads, subheadId]);

  async function loadMfaFactor() {
    const { data, error } = await supabase.auth.mfa.listFactors();

    if (error) {
      setTotpFactorId(null);
      return;
    }

    const verified = (data.totp || []).find((factor: TotpFactor) => factor.status === "verified");
    setTotpFactorId(verified?.id || null);
  }

  async function load() {
    setLoading(true);
    setMsg(null);

    if (!id) {
      setMsg("Invalid request id.");
      setLoading(false);
      return;
    }

    const { data: auth } = await supabase.auth.getUser();

    if (!auth.user) {
      router.push("/login");
      return;
    }

    await loadMfaFactor();

    const { data: profileRow, error: profileErr } = await supabase
      .from("profiles")
      .select("id,role,full_name")
      .eq("id", auth.user.id)
      .single();

    if (profileErr) {
      setMsg("Failed to load your profile: " + profileErr.message);
      setLoading(false);
      return;
    }

    const { data: requestRow, error: reqErr } = await supabase
      .from("requests")
      .select(
        "id,request_no,title,details,amount,status,current_stage,current_owner,created_by,dept_id,subhead_id,funds_state,request_type,personal_category"
      )
      .eq("id", id)
      .single();

    if (reqErr) {
      setMsg("Failed to load request: " + reqErr.message);
      setLoading(false);
      return;
    }

    const loadedReq = requestRow as Req;

    setMe(profileRow as Me);
    setReq(loadedReq);

    setSubheadId(loadedReq.subhead_id || "");
    setTitle(loadedReq.title || "");
    setDetails(loadedReq.details || "");
    setAmount(String(loadedReq.amount || 0));

    if (loadedReq.dept_id) {
      const { data: sh } = await supabase
        .from("subheads")
        .select("id,code,name,approved_allocation,reserved_amount,expenditure,balance,is_active")
        .eq("dept_id", loadedReq.dept_id)
        .eq("is_active", true)
        .order("code", { ascending: true });

      setSubheads((sh || []) as Subhead[]);
    } else {
      setSubheads([]);
    }

    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function validateForm() {
    if (!req) {
      setMsg("❌ Request is not loaded.");
      return false;
    }

    if (!canEdit) {
      setMsg("❌ Edit is locked. You are not allowed to edit this request at its current stage.");
      return false;
    }

    if (!totpFactorId) {
      setMsg("❌ You must set up 2FA before editing requests.");
      router.push("/mfa/setup");
      return false;
    }

    if (!title.trim()) {
      setMsg("❌ Title is required.");
      return false;
    }

    if (!details.trim()) {
      setMsg("❌ Details are required.");
      return false;
    }

    if (isFinancialRequest) {
      const amt = Number(amount || 0);

      if (!amt || amt <= 0) {
        setMsg("❌ Amount must be greater than zero for Official and Personal Fund requests.");
        return false;
      }
    }

    if (
      canEditFinanceFields &&
      isOfficial &&
      String(req.funds_state || "").toLowerCase() === "reserved"
    ) {
      if (!subheadId) {
        setMsg("❌ Reserved official request must have a subhead.");
        return false;
      }

      const amt = Number(amount || 0);

      if (selectedSubhead && subheadId !== req.subhead_id && amt > availableBalance(selectedSubhead)) {
        setMsg(
          `❌ Amount exceeds selected subhead available balance (${naira(
            availableBalance(selectedSubhead)
          )}).`
        );
        return false;
      }
    }

    return true;
  }

  function openSaveVerification() {
    setMsg(null);

    const ok = validateForm();
    if (!ok) return;

    setMfaCode("");
    setShowMfaModal(true);
    mfaAutoSubmittingRef.current = false;
  }

  async function verifyCodeAndSave(codeOverride?: string) {
    if (mfaAutoSubmittingRef.current || verifyingCode || saving) return;

    setMsg(null);

    if (!totpFactorId) {
      setMsg("❌ No verified 2FA authenticator found. Please set up 2FA again.");
      setShowMfaModal(false);
      router.push("/mfa/setup");
      return;
    }

    const code = String(codeOverride || mfaCode || "")
      .trim()
      .replace(/\D/g, "")
      .slice(0, 6);

    if (!/^\d{6}$/.test(code)) {
      setMsg("❌ Enter the 6-digit code from your authenticator app.");
      return;
    }

    mfaAutoSubmittingRef.current = true;
    setVerifyingCode(true);

    try {
      const { error } = await supabase.auth.mfa.challengeAndVerify({
        factorId: totpFactorId,
        code,
      });

      if (error) throw new Error(error.message);

      setShowMfaModal(false);
      setMfaCode("");

      await saveAfterFresh2fa();
    } catch (e: any) {
      setMsg("❌ 2FA verification failed: " + (e?.message || "Invalid code."));
      setMfaCode("");
    } finally {
      setVerifyingCode(false);

      setTimeout(() => {
        mfaAutoSubmittingRef.current = false;
      }, 800);
    }
  }

  async function saveAfterFresh2fa() {
    if (!req) return;

    const stillValid = validateForm();
    if (!stillValid) return;

    const amt = amountIsApplicable(req) ? Number(amount || 0) : 0;

    setSaving(true);
    setMsg(null);

    try {
      const { error } = await supabase.rpc("update_request_adjust_reservation", {
        p_request_id: req.id,
        p_new_subhead_id: canEditFinanceFields ? subheadId || req.subhead_id : req.subhead_id,
        p_new_amount: canEditAmount ? amt : req.amount || 0,
        p_new_title: title.trim(),
        p_new_details: details.trim(),
      });

      if (error) throw new Error(error.message);

      setMsg("✅ Request updated successfully after 2FA verification.");

      await load();

      setTimeout(() => {
        router.push(`/requests/${req.id}?updated=${Date.now()}`);
        router.refresh();
      }, 500);
    } catch (e: any) {
      setMsg("❌ Update failed: " + (e?.message || "Unknown error"));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 px-4">
        <div className="mx-auto max-w-4xl py-10 text-slate-600">Loading request editor...</div>
      </main>
    );
  }

  if (!req) {
    return (
      <main className="min-h-screen bg-slate-50 px-4">
        <div className="mx-auto max-w-4xl py-10">
          <div className="rounded-3xl border bg-white p-6 text-sm text-slate-700 shadow-sm">
            Request not found.
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4">
      <div className="mx-auto max-w-4xl py-10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
              Edit Request
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Editing is controlled by role, current stage and fresh 2FA verification.
            </p>
            <p className="mt-1 text-xs font-semibold text-slate-500">
              {editStageNote(req)}
            </p>
          </div>

          <button
            type="button"
            onClick={() => router.push(`/requests/${req.id}?updated=${Date.now()}`)}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-900 shadow-sm hover:bg-slate-100"
          >
            Back
          </button>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <StatusCard label="Request No" value={req.request_no || "—"} />
          <StatusCard label="Current Stage" value={req.current_stage || "—"} />
          <StatusCard label="Edit Mode" value={editModeLabel} />
        </div>

        <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-900">
          A fresh 2FA code is required before changes can be saved. The code will verify
          automatically after the 6th digit is entered.
        </div>

        {isOfficial && stg === "DINADMIN" && (
          <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-900">
            DIN Admin stage is active. This is still an early Official DIN approval stage.
          </div>
        )}

        {isPersonal && (
          <div className="mt-4 rounded-2xl border border-purple-200 bg-purple-50 px-4 py-3 text-sm font-semibold text-purple-900">
            Personal request editing is allowed only while the request is still at HR stage, or by Admin/Auditor before closure.
          </div>
        )}

        {requesterEditingReservedFinancial && (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
            Funds are already reserved. As requester, you can update title/details only. Amount and
            subhead changes are locked to protect finance records.
          </div>
        )}

        {canEditFinanceFields && isOfficial && (
          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
            Assigned officer finance edit is active. Reserved amount/subhead changes will be adjusted safely.
          </div>
        )}

        {msg && (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 shadow-sm">
            {msg}
          </div>
        )}

        {!canEdit ? (
          <div className="mt-6 rounded-3xl border bg-white p-6 shadow-sm">
            <h2 className="text-xl font-extrabold text-slate-900">Edit Locked</h2>

            <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
              This request cannot be edited by your account at this stage.
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <Info label="Request Type" value={requestTypeLabel(req)} />
              <Info label="Status" value={req.status || "—"} />
              <Info label="Funds State" value={req.funds_state || "—"} />
              <Info label="Your Role" value={me?.role || "—"} />
            </div>

            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
              Requester can edit Official requests only at early Director/DIN Admin/HOD level.
              Personal requests can be edited only at HR level. Editing is locked after DG,
              AccountOfficer, HR Filing, Paid, Completed, Rejected or Deleted stage.
            </div>
          </div>
        ) : (
          <div className="mt-6 rounded-3xl border bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-extrabold text-slate-900">Request Information</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Type: <b>{requestTypeLabel(req)}</b>
                </p>
              </div>

              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                Editable
              </span>
            </div>

            <div className="mt-6 space-y-4">
              {isOfficial && canEditFinanceFields && (
                <div>
                  <label className="text-sm font-semibold text-slate-800">Subhead</label>
                  <select
                    value={subheadId}
                    onChange={(e) => setSubheadId(e.target.value)}
                    className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-base text-slate-900 outline-none focus:border-blue-500"
                  >
                    <option value="">-- No subhead selected --</option>
                    {subheads.map((s) => (
                      <option key={s.id} value={s.id}>
                        {(s.code ? `${s.code} — ` : "") + s.name} ({naira(availableBalance(s))} available)
                      </option>
                    ))}
                  </select>

                  {selectedSubhead && (
                    <div className="mt-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
                      Selected available balance: {naira(availableBalance(selectedSubhead))}
                    </div>
                  )}
                </div>
              )}

              {isOfficial && !canEditFinanceFields && (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  Subhead information is handled by assigned finance-visible officers and is not editable here.
                </div>
              )}

              {!isOfficial && (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  Subhead is not applicable for Personal requests.
                </div>
              )}

              <div>
                <label className="text-sm font-semibold text-slate-800">Title</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-base text-slate-900 outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-slate-800">Details</label>
                <textarea
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  className="mt-1 min-h-[160px] w-full rounded-2xl border border-slate-200 px-4 py-3 text-base text-slate-900 outline-none focus:border-blue-500"
                />
              </div>

              {isFinancialRequest && (
                <div>
                  <label className="text-sm font-semibold text-slate-800">Amount (₦)</label>
                  <input
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    type="number"
                    disabled={!canEditAmount}
                    className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-base text-slate-900 outline-none focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-500"
                  />
                </div>
              )}

              {isPersonalOther && (
                <div>
                  <label className="text-sm font-semibold text-slate-800">Amount</label>
                  <input
                    value="Not Applicable"
                    readOnly
                    disabled
                    className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-base text-slate-500"
                  />
                </div>
              )}

              <button
                type="button"
                onClick={openSaveVerification}
                disabled={saving || verifyingCode}
                className="w-full rounded-2xl bg-blue-600 px-4 py-3 text-sm font-bold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60"
              >
                {saving
                  ? "Saving..."
                  : verifyingCode
                    ? "Verifying automatically..."
                    : "Save Changes with 2FA"}
              </button>
            </div>
          </div>
        )}
      </div>

      {showMfaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <div className="text-xs font-black uppercase tracking-wide text-blue-700">
              Required Security Verification
            </div>

            <h2 className="mt-1 text-2xl font-extrabold text-slate-900">
              Enter 2FA Code
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-600">
              Enter the 6-digit code from your authenticator app. The request changes will save
              automatically after the 6th digit is entered.
            </p>

            <input
              value={mfaCode}
              onChange={(e) => {
                const nextCode = e.target.value.replace(/\D/g, "").slice(0, 6);
                setMfaCode(nextCode);

                if (nextCode.length === 6 && !verifyingCode && !saving) {
                  setTimeout(() => {
                    verifyCodeAndSave(nextCode);
                  }, 150);
                }
              }}
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              disabled={verifyingCode || saving}
              placeholder="123456"
              className="mt-5 w-full rounded-2xl border border-slate-200 px-4 py-4 text-center text-2xl font-black tracking-[0.35em] text-slate-900 outline-none focus:border-blue-500 disabled:bg-slate-100 disabled:text-slate-500"
            />

            <div className="mt-3 text-center text-xs font-semibold text-slate-500">
              {verifyingCode || saving
                ? "Verifying automatically, please wait..."
                : "Auto-submit activates immediately after 6 digits."}
            </div>

            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => {
                  if (verifyingCode || saving) return;
                  setShowMfaModal(false);
                  setMfaCode("");
                  mfaAutoSubmittingRef.current = false;
                }}
                disabled={verifyingCode || saving}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 hover:bg-slate-100 disabled:opacity-60"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => verifyCodeAndSave()}
                disabled={verifyingCode || saving || mfaCode.trim().length !== 6}
                className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {verifyingCode || saving ? "Verifying automatically..." : "Verify & Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function StatusCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-white px-4 py-3 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 break-words text-sm font-extrabold text-slate-900">{value}</div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 break-words text-sm font-bold text-slate-900">{value}</div>
    </div>
  );
}