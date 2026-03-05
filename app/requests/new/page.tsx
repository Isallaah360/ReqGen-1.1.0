"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

type Dept = { id: string; name: string };

type Subhead = {
  id: string;
  dept_id: string;
  code: string | null;
  name: string;
  balance: number | null;
};

function naira(n: number) {
  return "₦" + Math.round(n).toLocaleString();
}

async function getSetting(key: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();
  if (error) return null;
  return (data?.value as string) || null;
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

export default function NewRequestPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [meId, setMeId] = useState<string>("");

  const [depts, setDepts] = useState<Dept[]>([]);
  const [subs, setSubs] = useState<Subhead[]>([]);

  // form
  const [deptId, setDeptId] = useState("");
  const [subheadId, setSubheadId] = useState("");
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [amount, setAmount] = useState<number>(0);

  // type
  const [requestType, setRequestType] = useState<"Personal" | "Official">("Official");
  const [personalCategory, setPersonalCategory] = useState<"Fund" | "NonFund">("Fund");

  const filteredSubs = useMemo(() => {
    if (!deptId) return [];
    return subs.filter((s) => s.dept_id === deptId);
  }, [subs, deptId]);

  const selectedSub = useMemo(() => {
    return subs.find((s) => s.id === subheadId) || null;
  }, [subs, subheadId]);

  const balance = Number(selectedSub?.balance || 0);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setMsg(null);

      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        router.push("/login");
        return;
      }
      setMeId(auth.user.id);

      const { data: d, error: dErr } = await supabase
        .from("departments")
        .select("id,name")
        .order("name", { ascending: true });

      if (dErr) {
        setMsg("Failed to load departments: " + dErr.message);
        setLoading(false);
        return;
      }

      const { data: s, error: sErr } = await supabase
        .from("subheads")
        .select("id,dept_id,code,name,balance")
        .eq("is_active", true)
        .order("name", { ascending: true });

      if (sErr) {
        setMsg("Failed to load subheads: " + sErr.message);
        setLoading(false);
        return;
      }

      setDepts((d || []) as Dept[]);
      setSubs((s || []) as Subhead[]);

      setLoading(false);
    }

    load();
  }, [router]);

  // If dept changes reset subhead
  useEffect(() => {
    setSubheadId("");
  }, [deptId]);

  async function createRequest() {
    setMsg(null);

    if (!deptId) return setMsg("❌ Please select a department.");
    if (!subheadId) return setMsg("❌ Please select a subhead.");
    if (!title.trim()) return setMsg("❌ Title is required.");
    if (!details.trim()) return setMsg("❌ Details is required.");
    if (!amount || amount <= 0) return setMsg("❌ Amount must be greater than 0.");

    // balance check
    if (amount > balance) {
      return setMsg(`❌ Insufficient balance in this subhead. Balance is ${naira(balance)}.`);
    }

    setSaving(true);

    try {
      // 1) get HOD user
      const hodId = await getSetting("HOD_USER_ID");
      if (!hodId) throw new Error("HOD_USER_ID not set in app_settings");

      // 2) generate request number (simple)
      const requestNo = "REQ-" + Date.now();

      // 3) insert request
      const { data: created, error: insErr } = await supabase
        .from("requests")
        .insert({
          request_no: requestNo,
          title: title.trim(),
          details: details.trim(),
          amount,
          dept_id: deptId,
          subhead_id: subheadId,
          created_by: meId,
          request_type: requestType,
          personal_category: requestType === "Personal" ? personalCategory : null,
          status: "Submitted",
          current_stage: "HOD",
          current_owner: hodId,
        })
        .select("id,request_no,title,amount,dept_id,subhead_id")
        .single();

      if (insErr) throw new Error(insErr.message);

      // 4) deduct subhead balance immediately
      const newBal = balance - amount;

      const { error: balErr } = await supabase
        .from("subheads")
        .update({ balance: newBal })
        .eq("id", subheadId);

      if (balErr) throw new Error("Balance update failed: " + balErr.message);

      // 5) history record
      const { error: histErr } = await supabase.from("request_history").insert({
        request_id: created.id,
        action_by: meId,
        from_stage: null,
        to_stage: "HOD",
        action_type: "Submit",
        comment: "Submitted",
        signature_url: null,
      });

      if (histErr) throw new Error("History insert failed: " + histErr.message);

      // 6) notify HOD
      await notify(
        hodId,
        "New Request Pending",
        `${created.request_no}: ${created.title}`,
        `/requests/${created.id}`
      );

      setMsg("✅ Submitted successfully. Sent to HOD.");

      // refresh local balance view
      setSubs((prev) =>
        prev.map((s) => (s.id === subheadId ? { ...s, balance: newBal } : s))
      );

      // go to details
      setTimeout(() => router.push(`/requests/${created.id}`), 600);
    } catch (e: any) {
      setMsg("❌ Submit failed: " + (e?.message || "Unknown error"));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 px-4">
        <div className="mx-auto max-w-3xl py-10 text-slate-600">Loading...</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4">
      <div className="mx-auto max-w-3xl py-10">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">New Request</h1>
        <p className="mt-2 text-sm text-slate-600">
          Select subhead, see balance, submit request and it will route to HOD.
        </p>

        {msg && <div className="mt-4 rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-800">{msg}</div>}

        <div className="mt-6 rounded-2xl border bg-white p-6 shadow-sm space-y-4">
          {/* Type */}
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-semibold text-slate-800">Request Type</label>
              <select
                value={requestType}
                onChange={(e) => setRequestType(e.target.value as any)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none"
              >
                <option value="Official">Official</option>
                <option value="Personal">Personal</option>
              </select>
            </div>

            {requestType === "Personal" ? (
              <div>
                <label className="text-sm font-semibold text-slate-800">Personal Category</label>
                <select
                  value={personalCategory}
                  onChange={(e) => setPersonalCategory(e.target.value as any)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none"
                >
                  <option value="Fund">Fund</option>
                  <option value="NonFund">Non-Fund</option>
                </select>
              </div>
            ) : (
              <div />
            )}
          </div>

          {/* Department/Subhead */}
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-semibold text-slate-800">Department</label>
              <select
                value={deptId}
                onChange={(e) => setDeptId(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none"
              >
                <option value="">-- Select Department --</option>
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
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none"
                disabled={!deptId}
              >
                <option value="">{deptId ? "-- Select Subhead --" : "Select department first"}</option>
                {filteredSubs.map((s) => (
                  <option key={s.id} value={s.id}>
                    {(s.code ? s.code + " — " : "") + s.name}
                  </option>
                ))}
              </select>

              {subheadId && (
                <div className="mt-2 text-sm">
                  Balance: <b className="text-slate-900">{naira(balance)}</b>
                </div>
              )}
            </div>
          </div>

          {/* Title/Amount */}
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-semibold text-slate-800">Title</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none"
                placeholder="e.g. Stationeries Purchase"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-800">Amount (₦)</label>
              <input
                value={amount || ""}
                onChange={(e) => setAmount(Number(e.target.value || 0))}
                type="number"
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none"
                placeholder="e.g. 50000"
              />
            </div>
          </div>

          {/* Details */}
          <div>
            <label className="text-sm font-semibold text-slate-800">Details</label>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              className="mt-1 min-h-[120px] w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none"
              placeholder="Describe the request..."
            />
          </div>

          <button
            onClick={createRequest}
            disabled={saving}
            className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {saving ? "Submitting..." : "Submit Request"}
          </button>
        </div>
      </div>
    </main>
  );
}