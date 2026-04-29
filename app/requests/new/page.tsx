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
  const [msg, setMsg] = useState<string | null>(null);

  const [me, setMe] = useState<ProfileMini | null>(null);

  const [requestType, setRequestType] = useState<"Official" | "Personal">("Official");
  const [personalCategory, setPersonalCategory] = useState<"Fund" | "NonFund">("Fund");

  const [depts, setDepts] = useState<Dept[]>([]);
  const [subs, setSubs] = useState<Subhead[]>([]);

  const [deptId, setDeptId] = useState("");
  const [subheadId, setSubheadId] = useState("");
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [details, setDetails] = useState("");

  async function loadAll() {
    setLoading(true);
    setMsg(null);

    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      router.push("/login");
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
    const first = filteredSubs[0];
    setSubheadId(first?.id || "");
  }, [deptId, filteredSubs]);

  const availableBalance = useMemo(() => {
    if (!selectedSubhead) return 0;

    const allocation = Number(selectedSubhead.approved_allocation || 0);
    const reserved = Number(selectedSubhead.reserved_amount || 0);
    const expenditure = Number(selectedSubhead.expenditure || 0);

    return allocation - reserved - expenditure;
  }, [selectedSubhead]);

  async function createRequest() {
    setMsg(null);

    if (!me) return setMsg("❌ Your profile is not loaded.");

    if (!me.full_name || !me.full_name.trim()) {
      return setMsg("❌ Please update your full name in Profile before creating request.");
    }

    if (!me.signature_url || !me.signature_url.trim()) {
      return setMsg("❌ Please upload your signature in Profile before creating request.");
    }

    if (!deptId) return setMsg("❌ Please select department.");
    if (!subheadId) return setMsg("❌ Please select subhead.");
    if (!title.trim()) return setMsg("❌ Please enter title.");
    if (!details.trim()) return setMsg("❌ Please enter details.");

    const amt = Number(amount || 0);
    if (!amt || amt <= 0) return setMsg("❌ Enter a valid amount.");

    if (!selectedSubhead) return setMsg("❌ Selected subhead not found.");

    if (amt > availableBalance) {
      return setMsg(`❌ Amount exceeds available balance (${naira(availableBalance)}).`);
    }

    const dept = depts.find((d) => d.id === deptId);
    if (!dept) return setMsg("❌ Department not found.");

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
        p_subhead_id: subheadId,
        p_request_type: requestType,
        p_personal_category: requestType === "Personal" ? personalCategory : null,
        p_created_by: me.id,
        p_requester_name: requesterName,
        p_requester_signature: me.signature_url,
        p_request_no: requestNo,
      });

      if (error) throw new Error(error.message);

      const requestId = (data as any)?.request_id;
      if (!requestId) throw new Error("Request was submitted but no request ID was returned.");

      setMsg(`✅ Request submitted successfully. Routed to ${(data as any)?.first_stage || "next officer"}.`);

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
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">New Request</h1>
          <p className="mt-2 text-sm text-slate-600">
            Select department and subhead, confirm available balance, then submit.
            The requested amount is reserved immediately after submission.
          </p>
        </div>

        {msg && (
          <div className="mt-4 rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-800">
            {msg}
          </div>
        )}

        <div className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-semibold text-slate-800">Request Type</label>
              <select
                value={requestType}
                onChange={(e) => setRequestType(e.target.value as "Official" | "Personal")}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
              >
                <option value="Official">Official</option>
                <option value="Personal">Personal</option>
              </select>
            </div>

            {requestType === "Personal" && (
              <div>
                <label className="text-sm font-semibold text-slate-800">Personal Category</label>
                <select
                  value={personalCategory}
                  onChange={(e) => setPersonalCategory(e.target.value as "Fund" | "NonFund")}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                >
                  <option value="Fund">Fund</option>
                  <option value="NonFund">NonFund</option>
                </select>
              </div>
            )}

            <div>
              <label className="text-sm font-semibold text-slate-800">Department</label>
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

            <div>
              <label className="text-sm font-semibold text-slate-800">Subhead</label>
              <select
                value={subheadId}
                onChange={(e) => setSubheadId(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
              >
                {filteredSubs.map((s) => (
                  <option key={s.id} value={s.id}>
                    {(s.code ? `${s.code} — ` : "") + s.name}
                  </option>
                ))}
              </select>

              <div className="mt-2 grid gap-2 text-sm font-semibold text-slate-700 sm:grid-cols-4">
                <div>
                  Allocation:{" "}
                  <span className="text-slate-900">
                    {naira(Number(selectedSubhead?.approved_allocation || 0))}
                  </span>
                </div>
                <div>
                  Reserved:{" "}
                  <span className="text-blue-700">
                    {naira(Number(selectedSubhead?.reserved_amount || 0))}
                  </span>
                </div>
                <div>
                  Expenditure:{" "}
                  <span className="text-red-700">
                    {naira(Number(selectedSubhead?.expenditure || 0))}
                  </span>
                </div>
                <div>
                  Balance:{" "}
                  <span className="text-emerald-700">
                    {naira(Number(selectedSubhead?.balance || 0))}
                  </span>
                </div>
              </div>
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-800">Title</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                placeholder="Request title"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-800">Amount (₦)</label>
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                type="number"
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                placeholder="0"
              />
            </div>

            <div className="md:col-span-2">
              <label className="text-sm font-semibold text-slate-800">Details</label>
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
            disabled={saving}
            className="mt-5 w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {saving ? "Submitting..." : "Submit Request"}
          </button>
        </div>
      </div>
    </main>
  );
}