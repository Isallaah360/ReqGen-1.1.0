"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Dept = {
  id: string;
  name: string;
  hod_user_id: string | null;
  director_user_id: string | null;
};

type Subhead = {
  id: string;
  dept_id: string;
  code: string | null;
  name: string;
  balance: number | null;
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

    setMe((prof || null) as any);

    const { data: drows, error: dErr } = await supabase
      .from("departments")
      .select("id,name,hod_user_id,director_user_id")
      .eq("is_active", true)
      .order("name", { ascending: true });

    if (dErr) {
      setMsg("Failed to load departments: " + dErr.message);
      setLoading(false);
      return;
    }

    const deptList = (drows || []) as Dept[];
    setDepts(deptList);

    const { data: srows, error: sErr } = await supabase
      .from("subheads")
      .select("id,dept_id,code,name,balance,is_active")
      .eq("is_active", true)
      .order("name", { ascending: true });

    if (sErr) {
      setMsg("Failed to load subheads: " + sErr.message);
      setLoading(false);
      return;
    }

    setSubs((srows || []) as Subhead[]);

    if (deptList.length > 0) {
      const firstDeptId = deptList[0].id;
      setDeptId(firstDeptId);

      const firstSub = ((srows || []) as Subhead[]).find((s) => s.dept_id === firstDeptId);
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

  function buildRequestNo() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const t = String(now.getTime()).slice(-6);
    return `REQ-${y}${m}-${t}`;
  }

  async function notify(userId: string, title: string, body: string, link: string) {
    await supabase.from("notifications").insert({
      user_id: userId,
      title,
      body,
      link,
      is_read: false,
    });
  }

  async function createRequest() {
    setMsg(null);

    if (!me) {
      setMsg("❌ Your profile is not loaded.");
      return;
    }

    if (!me.signature_url) {
      setMsg("❌ Please upload your signature in Profile before creating request.");
      return;
    }

    if (!deptId) {
      setMsg("❌ Please select department.");
      return;
    }

    if (!subheadId) {
      setMsg("❌ Please select subhead.");
      return;
    }

    if (!title.trim()) {
      setMsg("❌ Please enter title.");
      return;
    }

    if (!details.trim()) {
      setMsg("❌ Please enter details.");
      return;
    }

    const amt = Number(amount || 0);
    if (!amt || amt <= 0) {
      setMsg("❌ Enter a valid amount.");
      return;
    }

    if (!selectedSubhead) {
      setMsg("❌ Selected subhead not found.");
      return;
    }

    const subBal = Number(selectedSubhead.balance || 0);
    if (amt > subBal) {
      setMsg(`❌ Amount exceeds subhead balance (${naira(subBal)}).`);
      return;
    }

    const dept = depts.find((d) => d.id === deptId);
    if (!dept) {
      setMsg("❌ Department not found.");
      return;
    }

    // ✅ PROFESSIONAL FIX:
    // Route first to department HOD, else Director
    const firstOwner = dept.hod_user_id || dept.director_user_id || null;
    const firstStage = dept.hod_user_id ? "HOD" : dept.director_user_id ? "Director" : null;

    if (!firstOwner || !firstStage) {
      setMsg("❌ This department does not have HOD/Director routing set yet in Admin Panel.");
      return;
    }

    setSaving(true);

    try {
      const requestNo = buildRequestNo();

      // 1) Create request
      const { data: created, error: reqErr } = await supabase
        .from("requests")
        .insert({
          request_no: requestNo,
          title: title.trim(),
          details: details.trim(),
          amount: amt,
          status: "Submitted",
          current_stage: firstStage,
          current_owner: firstOwner,
          created_by: me.id,
          dept_id: deptId,
          subhead_id: subheadId,
          request_type: requestType,
          personal_category: requestType === "Personal" ? personalCategory : null,
          funds_state: "reserved",
          requester_signature_url: me.signature_url,
        })
        .select("id")
        .single();

      if (reqErr) throw new Error(reqErr.message);

      const requestId = created?.id;
      if (!requestId) throw new Error("Request created without ID.");

      // 2) Reserve amount on subhead immediately
      const newBalance = subBal - amt;
      const { error: subErr } = await supabase
        .from("subheads")
        .update({
          expenditure: Number(selectedSubhead.balance || 0) + 0 - newBalance,
          balance: newBalance,
        })
        .eq("id", subheadId);

      if (subErr) throw new Error(subErr.message);

      // 3) History
      const { error: histErr } = await supabase.from("request_history").insert({
        request_id: requestId,
        action_by: me.id,
        from_stage: "Draft",
        to_stage: firstStage,
        action_type: "Submit",
        comment: "Request submitted",
        signature_url: me.signature_url,
      });

      if (histErr) throw new Error(histErr.message);

      // 4) Notify first approver
      await notify(
        firstOwner,
        "New Request Submitted",
        `${requestNo}: ${title.trim()}`,
        `/requests/${requestId}`
      );

      setMsg(`✅ Request submitted successfully. Routed to ${firstStage}.`);

      setTitle("");
      setAmount("");
      setDetails("");

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
            Select department & subhead, confirm balance, then submit. It routes to the department HOD/Director.
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
              <div className="mt-2 text-sm font-semibold text-slate-700">
                Balance: <span className="text-slate-900">{naira(Number(selectedSubhead?.balance || 0))}</span>
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