"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

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
  personal_category: "Fund" | "NonFund" | null;
};

type Subhead = {
  id: string;
  code: string | null;
  name: string;
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

function naira(n: number | null | undefined) {
  return "₦" + Math.round(Number(n || 0)).toLocaleString();
}

function requestTypeLabel(req: Req) {
  if (req.request_type === "Official") return "Official";
  if (req.personal_category === "Fund") return "Personal Fund";
  if (req.personal_category === "NonFund") return "Personal NonFund";
  return req.request_type || "—";
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

  const rk = roleKey(me?.role);
  const stg = stageKey(req?.current_stage);

  const isOfficial = req?.request_type === "Official";
  const isPersonalFund = req?.request_type === "Personal" && req?.personal_category === "Fund";
  const isPersonalNonFund =
    req?.request_type === "Personal" && req?.personal_category === "NonFund";

  const isFinancialRequest = Boolean(isOfficial || isPersonalFund);

  const isRequesterEarlyEdit = useMemo(() => {
    if (!req || !me) return false;

    return (
      req.created_by === me.id &&
      ["DIRECTOR", "HOD"].includes(stg) &&
      (req.funds_state || "").toLowerCase() === "reserved"
    );
  }, [req, me, stg]);

  const isDirectorHodHrCurrentOwnerEdit = useMemo(() => {
    if (!req || !me) return false;

    const allowedRole = ["director", "hod", "hr"].includes(rk);
    const ownsCurrentStage = req.current_owner === me.id;

    return allowedRole && ownsCurrentStage;
  }, [req, me, rk]);

  const canEdit = useMemo(() => {
    return isRequesterEarlyEdit || isDirectorHodHrCurrentOwnerEdit;
  }, [isRequesterEarlyEdit, isDirectorHodHrCurrentOwnerEdit]);

  const editModeLabel = useMemo(() => {
    if (isRequesterEarlyEdit) return "Requester Early-Stage Edit";
    if (isDirectorHodHrCurrentOwnerEdit) return "Assigned Officer Edit";
    return "Locked";
  }, [isRequesterEarlyEdit, isDirectorHodHrCurrentOwnerEdit]);

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

    const [profileRes, reqRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("id,role,full_name")
        .eq("id", auth.user.id)
        .single(),
      supabase
        .from("requests")
        .select(
          "id,request_no,title,details,amount,status,current_stage,current_owner,created_by,dept_id,subhead_id,funds_state,request_type,personal_category"
        )
        .eq("id", id)
        .single(),
      loadMfaFactor(),
    ]);

    if (profileRes.error) {
      setMsg("Failed to load your profile: " + profileRes.error.message);
      setLoading(false);
      return;
    }

    if (reqRes.error) {
      setMsg("Failed to load request: " + reqRes.error.message);
      setLoading(false);
      return;
    }

    const profileRow = profileRes.data as Me;
    const requestRow = reqRes.data as Req;

    setMe(profileRow);
    setReq(requestRow);

    setSubheadId(requestRow.subhead_id || "");
    setTitle(requestRow.title || "");
    setDetails(requestRow.details || "");
    setAmount(String(requestRow.amount || 0));

    if (requestRow.dept_id) {
      const { data: sh } = await supabase
        .from("subheads")
        .select("id,code,name,balance,is_active")
        .eq("dept_id", requestRow.dept_id)
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

    if (isOfficial && !subheadId) {
      setMsg("❌ Select subhead for this official request.");
      return false;
    }

    if (isFinancialRequest) {
      const amt = Number(amount || 0);

      if (!amt || amt <= 0) {
        setMsg("❌ Amount must be greater than zero.");
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
  }

  async function verifyCodeAndSave() {
    setMsg(null);

    if (!totpFactorId) {
      setMsg("❌ No verified 2FA authenticator found. Please set up 2FA again.");
      setShowMfaModal(false);
      router.push("/mfa/setup");
      return;
    }

    const code = mfaCode.trim().replace(/\s+/g, "");

    if (!/^\d{6}$/.test(code)) {
      setMsg("❌ Enter the 6-digit code from your authenticator app.");
      return;
    }

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
    } finally {
      setVerifyingCode(false);
    }
  }

  async function saveAfterFresh2fa() {
    if (!req) return;

    const stillValid = validateForm();
    if (!stillValid) return;

    const amt = isPersonalNonFund ? 0 : Number(amount || 0);

    setSaving(true);
    setMsg(null);

    try {
      if (isOfficial && (req.funds_state || "").toLowerCase() === "reserved") {
        const { error } = await supabase.rpc("update_request_adjust_reservation", {
          p_request_id: req.id,
          p_new_subhead_id: subheadId,
          p_new_amount: amt,
          p_new_title: title.trim(),
          p_new_details: details.trim(),
        });

        if (error) throw new Error(error.message);
      } else {
        const updatePayload: Record<string, any> = {
          title: title.trim(),
          details: details.trim(),
          amount: amt,
        };

        if (isOfficial) {
          updatePayload.subhead_id = subheadId;
        }

        const { error } = await supabase
          .from("requests")
          .update(updatePayload)
          .eq("id", req.id);

        if (error) throw new Error(error.message);

        await supabase.from("request_history").insert({
          request_id: req.id,
          action_type: "Edited",
          comment: `Request edited by ${me?.full_name || "user"} with fresh 2FA verification.`,
          to_stage: req.current_stage,
          actor_name: me?.full_name || null,
          actor_id: me?.id || null,
        });
      }

      setMsg("✅ Request updated successfully after 2FA verification.");

      setTimeout(() => {
        router.push(`/requests/${req.id}`);
      }, 700);
    } catch (e: any) {
      setMsg("❌ Update failed: " + (e?.message || "Unknown error"));
    } finally {
      setSaving(false);
    }
  }

  const selectedSubhead = useMemo(() => {
    return subheads.find((s) => s.id === subheadId) || null;
  }, [subheads, subheadId]);

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
          </div>

          <button
            type="button"
            onClick={() => router.push(`/requests/${req.id}`)}
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
          A fresh 2FA code is required before changes can be saved.
        </div>

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
              Requester can edit only at early Director/HOD level while reserved. Director, HOD and
              HR can edit only while the request is currently assigned to them. Account Officers
              cannot edit requests from this page.
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
              {isOfficial && (
                <div>
                  <label className="text-sm font-semibold text-slate-800">Subhead</label>
                  <select
                    value={subheadId}
                    onChange={(e) => setSubheadId(e.target.value)}
                    className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-base text-slate-900 outline-none focus:border-blue-500"
                  >
                    <option value="">-- Select subhead --</option>
                    {subheads.map((s) => (
                      <option key={s.id} value={s.id}>
                        {(s.code ? `${s.code} — ` : "") + s.name} ({naira(s.balance)})
                      </option>
                    ))}
                  </select>

                  {selectedSubhead && (
                    <div className="mt-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
                      Selected balance: {naira(selectedSubhead.balance)}
                    </div>
                  )}
                </div>
              )}

              {!isOfficial && (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  Subhead is not applicable for this request type.
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
                    className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-base text-slate-900 outline-none focus:border-blue-500"
                  />
                </div>
              )}

              {isPersonalNonFund && (
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
                  ? "Verifying 2FA..."
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
              Enter the 6-digit code from your authenticator app. The request changes will not be
              saved until this code is verified.
            </p>

            <input
              value={mfaCode}
              onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              autoFocus
              placeholder="123456"
              className="mt-5 w-full rounded-2xl border border-slate-200 px-4 py-4 text-center text-2xl font-black tracking-[0.35em] text-slate-900 outline-none focus:border-blue-500"
            />

            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => {
                  if (verifyingCode || saving) return;
                  setShowMfaModal(false);
                  setMfaCode("");
                }}
                disabled={verifyingCode || saving}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 hover:bg-slate-100 disabled:opacity-60"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={verifyCodeAndSave}
                disabled={verifyingCode || saving || mfaCode.trim().length !== 6}
                className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {verifyingCode || saving ? "Verifying..." : "Verify & Save"}
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