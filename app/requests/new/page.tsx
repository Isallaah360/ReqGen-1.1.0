"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Dept = {
  id: string;
  name: string;
  hod_user_id: string | null;
  director_user_id: string | null;
  is_active?: boolean | null;
};

type Subhead = {
  id: string;
  dept_id: string;
  code: string | null;
  name: string;
  approved_allocation: number | null;
  balance: number | null;
  expenditure: number | null;
  reserved_amount: number | null;
  is_active: boolean | null;
};

type ProfileMini = {
  id: string;
  full_name: string | null;
  email: string | null;
  signature_url: string | null;
};

function naira(n: number) {
  return "₦" + Math.round(n || 0).toLocaleString();
}

function buildRequestNo() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const t = String(now.getTime()).slice(-6);
  return `REQ-${y}${m}-${t}`;
}

export default function NewRequestPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [checkingMfa, setCheckingMfa] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [me, setMe] = useState<ProfileMini | null>(null);
  const [mfaVerified, setMfaVerified] = useState(false);

  const [requestType, setRequestType] = useState<"Official" | "Personal">("Official");
  const [personalCategory, setPersonalCategory] = useState<"Fund" | "NonFund">("Fund");

  const [depts, setDepts] = useState<Dept[]>([]);
  const [subs, setSubs] = useState<Subhead[]>([]);

  const [deptId, setDeptId] = useState("");
  const [subheadId, setSubheadId] = useState("");
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [details, setDetails] = useState("");

  const isOfficial = requestType === "Official";
  const isPersonal = requestType === "Personal";
  const isPersonalFund = requestType === "Personal" && personalCategory === "Fund";
  const isPersonalNonFund = requestType === "Personal" && personalCategory === "NonFund";

  async function checkMfaStatus() {
    const { data: auth } = await supabase.auth.getUser();

    if (!auth.user) {
      router.push("/login");
      return false;
    }

    const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

    if (error) {
      setMfaVerified(false);
      return false;
    }

    const ok = data.currentLevel === "aal2";
    setMfaVerified(ok);
    return ok;
  }

  async function requireMfaVerified(actionLabel: string) {
    setCheckingMfa(true);
    setMsg(null);

    try {
      const ok = await checkMfaStatus();

      if (!ok) {
        setMsg(`❌ 2FA verification is required before you can ${actionLabel}.`);
        router.push("/mfa?next=/requests/new");
        return false;
      }

      return true;
    } finally {
      setCheckingMfa(false);
    }
  }

  async function loadAll() {
    setLoading(true);
    setMsg(null);

    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      router.push("/login");
      return;
    }

    const mfaOk = await checkMfaStatus();

    if (!mfaOk) {
      setMsg("❌ 2FA verification is required before creating a request.");
      router.push("/mfa?next=/requests/new");
      setLoading(false);
      return;
    }

    const { data: prof, error: profErr } = await supabase
      .from("profiles")
      .select("id,full_name,email,signature_url")
      .eq("id", auth.user.id)
      .single();

    if (profErr) {
      setMsg("Failed to load your profile: " + profErr.message);
      setLoading(false);
      return;
    }

    setMe((prof || null) as ProfileMini);

    const { data: deptRows, error: deptErr } = await supabase
      .from("departments")
      .select("id,name,hod_user_id,director_user_id,is_active")
      .eq("is_active", true)
      .order("name", { ascending: true });

    if (deptErr) {
      setMsg("Failed to load departments: " + deptErr.message);
      setLoading(false);
      return;
    }

    const deptList = (deptRows || []) as Dept[];
    setDepts(deptList);

    const { data: subRows, error: subErr } = await supabase
      .from("subheads")
      .select("id,dept_id,code,name,approved_allocation,balance,expenditure,reserved_amount,is_active")
      .eq("is_active", true)
      .order("name", { ascending: true });

    if (subErr) {
      setMsg("Failed to load subheads: " + subErr.message);
      setLoading(false);
      return;
    }

    const subList = (subRows || []) as Subhead[];
    setSubs(subList);

    if (deptList.length > 0) {
      const firstDept = deptList[0];
      setDeptId(firstDept.id);

      const firstSub = subList.find((s) => s.dept_id === firstDept.id);
      if (firstSub) setSubheadId(firstSub.id);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredSubs = useMemo(() => {
    return subs.filter((s) => s.dept_id === deptId);
  }, [subs, deptId]);

  const selectedSubhead = useMemo(() => {
    return subs.find((s) => s.id === subheadId) || null;
  }, [subs, subheadId]);

  useEffect(() => {
    if (!isOfficial) {
      setSubheadId("");
      return;
    }

    const first = filteredSubs[0];
    setSubheadId(first?.id || "");
  }, [deptId, filteredSubs, isOfficial]);

  useEffect(() => {
    if (isPersonalNonFund) {
      setAmount("");
    }
  }, [isPersonalNonFund]);

  const availableBalance = useMemo(() => {
    if (!selectedSubhead) return 0;

    const allocation = Number(selectedSubhead.approved_allocation || 0);
    const reserved = Number(selectedSubhead.reserved_amount || 0);
    const expenditure = Number(selectedSubhead.expenditure || 0);

    return allocation - reserved - expenditure;
  }, [selectedSubhead]);

  async function createRequest() {
    setMsg(null);

    const mfaOk = await requireMfaVerified("submit a request");
    if (!mfaOk) return;

    if (!me) {
      return setMsg("❌ Your profile is not loaded.");
    }

    if (!me.full_name || !me.full_name.trim()) {
      return setMsg("❌ Please update your full name in Profile before creating request.");
    }

    if (!me.signature_url || !me.signature_url.trim()) {
      return setMsg("❌ Please upload your signature in Profile before creating request.");
    }

    if (!deptId) {
      return setMsg("❌ Please select department.");
    }

    if (!title.trim()) {
      return setMsg("❌ Please enter title.");
    }

    if (!details.trim()) {
      return setMsg("❌ Please enter details.");
    }

    const amt = isPersonalNonFund ? 0 : Number(amount || 0);

    if ((isOfficial || isPersonalFund) && (!amt || amt <= 0)) {
      return setMsg("❌ Enter a valid amount.");
    }

    if (isOfficial && !subheadId) {
      return setMsg("❌ Please select subhead for Official Request.");
    }

    if (isOfficial && !selectedSubhead) {
      return setMsg("❌ Selected subhead not found.");
    }

    if (isOfficial && amt > availableBalance) {
      return setMsg(`❌ Amount exceeds available balance (${naira(availableBalance)}).`);
    }

    const dept = depts.find((d) => d.id === deptId);
    if (!dept) {
      return setMsg("❌ Department not found.");
    }

    const firstOwner = dept.director_user_id || dept.hod_user_id || null;
    const firstStage = dept.director_user_id ? "Director" : dept.hod_user_id ? "HOD" : null;

    if (!firstOwner || !firstStage) {
      return setMsg("❌ This department does not have Director/HOD routing set yet in Admin Panel.");
    }

    setSaving(true);

    try {
      const requestNo = buildRequestNo();
      const requesterName = me.full_name.trim();

      const { data, error } = await supabase.rpc("submit_request_with_reservation", {
        p_title: title.trim(),
        p_details: details.trim(),
        p_amount: amt,
        p_dept_id: deptId,
        p_subhead_id: isOfficial ? subheadId : null,
        p_request_type: requestType,
        p_personal_category: isPersonal ? personalCategory : null,
        p_created_by: me.id,
        p_requester_name: requesterName,
        p_requester_signature: me.signature_url,
        p_request_no: requestNo,
      });

      if (error) throw new Error(error.message);

      const requestId = (data as any)?.request_id;
      if (!requestId) {
        throw new Error("Request was submitted but no request ID was returned.");
      }

      setMsg(
        `✅ Request submitted successfully. Routed to ${
          (data as any)?.first_stage || "next officer"
        }.`
      );

      setTitle("");
      setAmount("");
      setDetails("");

      await loadAll();

      setTimeout(() => {
        router.push(`/requests/${requestId}`);
      }, 700);
    } catch (e: any) {
      setMsg("❌ Submit failed: " + (e?.message || "Unknown error"));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 px-4">
        <div className="mx-auto max-w-5xl py-10 text-slate-600">Loading...</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4">
      <div className="mx-auto max-w-5xl py-10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
              New Request
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Official requests are tied to subheads and reserve funds immediately.
              Personal Fund requests do not affect subhead balances. Personal NonFund requests do
              not require amount or subhead.
            </p>
          </div>

          <button
            type="button"
            onClick={() => router.push("/requests")}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100"
          >
            Back to Requests
          </button>
        </div>

        <div
          className={`mt-4 rounded-2xl border px-4 py-3 text-sm font-semibold ${
            mfaVerified
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-amber-200 bg-amber-50 text-amber-900"
          }`}
        >
          {mfaVerified
            ? "✅ 2FA verified. Request submission is enabled for this session."
            : "⚠️ 2FA verification is required before submitting a request."}

          {!mfaVerified && (
            <button
              type="button"
              onClick={() => router.push("/mfa?next=/requests/new")}
              className="ml-0 mt-3 block rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 sm:ml-3 sm:mt-0 sm:inline-block"
            >
              Verify 2FA
            </button>
          )}
        </div>

        {msg && (
          <div className="mt-4 rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-800">
            {msg}
          </div>
        )}

        <div className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-semibold text-slate-800">
                Request Type
              </label>
              <select
                value={requestType}
                onChange={(e) => {
                  const v = e.target.value as "Official" | "Personal";
                  setRequestType(v);

                  if (v === "Official") {
                    setPersonalCategory("Fund");

                    const first = filteredSubs[0];
                    setSubheadId(first?.id || "");
                  } else {
                    setSubheadId("");
                  }
                }}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
              >
                <option value="Official">Official</option>
                <option value="Personal">Personal</option>
              </select>
            </div>

            {isPersonal && (
              <div>
                <label className="text-sm font-semibold text-slate-800">
                  Personal Category
                </label>
                <select
                  value={personalCategory}
                  onChange={(e) => {
                    const v = e.target.value as "Fund" | "NonFund";
                    setPersonalCategory(v);

                    if (v === "NonFund") {
                      setAmount("");
                    }
                  }}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                >
                  <option value="Fund">Fund</option>
                  <option value="NonFund">NonFund</option>
                </select>
              </div>
            )}

            <div>
              <label className="text-sm font-semibold text-slate-800">
                Department
              </label>
              <select
                value={deptId}
                onChange={(e) => setDeptId(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
              >
                {depts.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>

            {isOfficial && (
              <div>
                <label className="text-sm font-semibold text-slate-800">
                  Subhead
                </label>
                <select
                  value={subheadId}
                  onChange={(e) => setSubheadId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                >
                  {filteredSubs.length === 0 ? (
                    <option value="">No active subhead for this department</option>
                  ) : (
                    filteredSubs.map((s) => (
                      <option key={s.id} value={s.id}>
                        {(s.code ? `${s.code} — ` : "") + s.name}
                      </option>
                    ))
                  )}
                </select>

                <div className="mt-3 grid gap-2 text-sm font-semibold text-slate-700 sm:grid-cols-4">
                  <div className="rounded-xl bg-slate-50 p-3">
                    <div className="text-xs text-slate-500">Allocation</div>
                    <div className="mt-1 text-slate-900">
                      {naira(Number(selectedSubhead?.approved_allocation || 0))}
                    </div>
                  </div>

                  <div className="rounded-xl bg-amber-50 p-3">
                    <div className="text-xs text-amber-700">Reserved</div>
                    <div className="mt-1 text-amber-800">
                      {naira(Number(selectedSubhead?.reserved_amount || 0))}
                    </div>
                  </div>

                  <div className="rounded-xl bg-red-50 p-3">
                    <div className="text-xs text-red-700">Expenditure</div>
                    <div className="mt-1 text-red-800">
                      {naira(Number(selectedSubhead?.expenditure || 0))}
                    </div>
                  </div>

                  <div className="rounded-xl bg-emerald-50 p-3">
                    <div className="text-xs text-emerald-700">Balance</div>
                    <div className="mt-1 text-emerald-800">
                      {naira(Number(selectedSubhead?.balance || 0))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {isPersonalFund && (
              <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900 md:col-span-2">
                Personal Fund Request does not use a subhead and will not deduct from departmental
                allocation. It will pass through HR, Registry, DG, and then the selected Account
                Officer for treatment.
              </div>
            )}

            {isPersonalNonFund && (
              <div className="rounded-xl border border-purple-100 bg-purple-50 px-4 py-3 text-sm text-purple-900 md:col-span-2">
                Personal NonFund Request does not use subhead or amount. It will pass through HR,
                Registry, DG, and then return to HR for final filing.
              </div>
            )}

            <div>
              <label className="text-sm font-semibold text-slate-800">
                Title
              </label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                placeholder="Request title"
              />
            </div>

            {(isOfficial || isPersonalFund) && (
              <div>
                <label className="text-sm font-semibold text-slate-800">
                  Amount (₦)
                </label>
                <input
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  type="number"
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                  placeholder="0"
                />
              </div>
            )}

            {isPersonalNonFund && (
              <div>
                <label className="text-sm font-semibold text-slate-800">
                  Amount
                </label>
                <input
                  value="Not Applicable"
                  readOnly
                  disabled
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-500"
                />
              </div>
            )}

            <div className="md:col-span-2">
              <label className="text-sm font-semibold text-slate-800">
                Details
              </label>
              <textarea
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                className="mt-1 min-h-[160px] w-full rounded-xl border border-slate-200 px-3 py-2"
                placeholder="Write request details..."
              />
            </div>
          </div>

          <button
            onClick={createRequest}
            disabled={saving || checkingMfa || !mfaVerified}
            className="mt-5 w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {saving
              ? "Submitting..."
              : checkingMfa
              ? "Checking 2FA..."
              : mfaVerified
              ? "Submit Request"
              : "Verify 2FA Before Submit"}
          </button>

          {!mfaVerified && (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Request submission is locked until 2FA is verified for this session.
            </div>
          )}
        </div>
      </div>
    </main>
  );
}