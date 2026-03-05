"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Dept = { id: string; name: string };
type Subhead = {
  id: string;
  dept_id: string;
  code: string | null;
  name: string;
  balance: number | null;
  is_active: boolean | null;
};

type ProfileMini = { id: string; full_name: string | null };

function naira(n: number) {
  return "₦" + Math.round(n).toLocaleString();
}

function safeStage(s: string) {
  return (s || "").trim();
}

function roleKey(role: string) {
  return (role || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/_/g, "");
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
  if (!userId) return;
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
  const [myRole, setMyRole] = useState<string>("Staff");

  const [depts, setDepts] = useState<Dept[]>([]);
  const [subs, setSubs] = useState<Subhead[]>([]);

  // form
  const [requestType, setRequestType] = useState<"Official" | "Personal">("Official");
  const [personalCategory, setPersonalCategory] = useState<"Fund" | "NonFund">("Fund");

  const [deptId, setDeptId] = useState<string>("");
  const [subheadId, setSubheadId] = useState<string>("");

  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState<string>("");
  const [details, setDetails] = useState("");

  const deptMap = useMemo(() => {
    const m: Record<string, Dept> = {};
    depts.forEach((d) => (m[d.id] = d));
    return m;
  }, [depts]);

  const subheadsByDept = useMemo(() => {
    if (!deptId) return [];
    return subs
      .filter((s) => s.dept_id === deptId)
      .filter((s) => Boolean(s.is_active))
      .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }, [subs, deptId]);

  const selectedSubhead = useMemo(() => {
    return subs.find((s) => s.id === subheadId) || null;
  }, [subs, subheadId]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setMsg(null);

      // auth
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        router.push("/login");
        return;
      }
      setMeId(auth.user.id);

      // role
      const { data: prof, error: profErr } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", auth.user.id)
        .maybeSingle();

      if (profErr) {
        setMsg("Failed to load your profile: " + profErr.message);
        setLoading(false);
        return;
      }
      setMyRole((prof?.role || "Staff") as string);

      // depts
      const { data: drows, error: dErr } = await supabase
        .from("departments")
        .select("id,name")
        .order("name", { ascending: true });

      if (dErr) {
        setMsg("Failed to load departments: " + dErr.message);
        setLoading(false);
        return;
      }

      // subheads
      const { data: srows, error: sErr } = await supabase
        .from("subheads")
        .select("id,dept_id,code,name,balance,is_active")
        .order("name", { ascending: true });

      if (sErr) {
        setMsg("Failed to load subheads: " + sErr.message);
        setLoading(false);
        return;
      }

      setDepts((drows || []) as Dept[]);
      setSubs((srows || []) as Subhead[]);

      // default dept + subhead
      const firstDept = (drows || [])[0]?.id || "";
      setDeptId(firstDept);

      setLoading(false);
    }

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  useEffect(() => {
    // when dept changes, auto-pick first subhead
    const list = subs.filter((s) => s.dept_id === deptId).filter((s) => Boolean(s.is_active));
    setSubheadId(list[0]?.id || "");
  }, [deptId, subs]);

  async function createRequest() {
    setMsg(null);

    if (!deptId) return setMsg("❌ Select a department.");
    if (!subheadId) return setMsg("❌ Select a subhead.");
    if (title.trim().length < 3) return setMsg("❌ Title is too short.");
    if (details.trim().length < 5) return setMsg("❌ Details is too short.");

    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) return setMsg("❌ Enter a valid amount.");

    // Balance check (client-side)
    const bal = Number(selectedSubhead?.balance || 0);
    if (amt > bal) {
      return setMsg(`❌ Amount is above subhead balance (${naira(bal)}).`);
    }

    setSaving(true);

    try {
      // ✅ First routing: HOD
      const hodId = await getSetting("HOD_USER_ID");
      if (!hodId) {
        throw new Error("HOD_USER_ID not set in app_settings");
      }

      // Generate request_no (simple)
      const reqNo = `REQ-${Date.now()}`;

      // Create request
      const { data: inserted, error: insErr } = await supabase
        .from("requests")
        .insert({
          request_no: reqNo,
          title: title.trim(),
          details: details.trim(),
          amount: amt,
          status: "Submitted",
          current_stage: "HOD",
          current_owner: hodId,
          created_by: meId,
          dept_id: deptId,
          subhead_id: subheadId,
          request_type: requestType,
          personal_category: requestType === "Personal" ? personalCategory : null,
        })
        .select("id")
        .single();

      if (insErr) throw new Error(insErr.message);

      const requestId = inserted?.id as string;

      // History
      const { error: hErr } = await supabase.from("request_history").insert({
        request_id: requestId,
        action_by: meId,
        from_stage: "Staff",
        to_stage: "HOD",
        action_type: "Submit",
        comment: "Submitted",
        signature_url: null,
      });

      if (hErr) throw new Error(hErr.message);

      // Notify HOD
      await notify(
        hodId,
        "New Request Submitted",
        `${reqNo}: ${title.trim()}`,
        `/requests/${requestId}`
      );

      setMsg("✅ Submitted successfully. Routed to HOD.");
      router.push(`/requests/${requestId}`);
    } catch (e: any) {
      setMsg("❌ Submit failed: " + (e?.message || "Unknown error"));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 px-4">
        <div className="mx-auto max-w-4xl py-10 text-slate-600">Loading...</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4">
      <div className="mx-auto max-w-4xl py-10">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">New Request</h1>
          <p className="mt-2 text-sm text-slate-600">
            Select department & subhead, confirm balance, then submit. It routes to HOD.
          </p>
        </div>

        {msg && (
          <div className="mt-4 rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-800 whitespace-pre-line">
            {msg}
          </div>
        )}

        <div className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-semibold text-slate-800">Request Type</label>
              <select
                value={requestType}
                onChange={(e) => setRequestType(e.target.value as any)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
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
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
                >
                  <option value="Fund">Fund</option>
                  <option value="NonFund">NonFund</option>
                </select>
              </div>
            ) : (
              <div />
            )}
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-semibold text-slate-800">Department</label>
              <select
                value={deptId}
                onChange={(e) => setDeptId(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
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
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
              >
                {subheadsByDept.map((s) => (
                  <option key={s.id} value={s.id}>
                    {(s.code ? `${s.code} — ` : "") + s.name}
                  </option>
                ))}
              </select>

              <div className="mt-2 text-sm text-slate-700">
                Balance:{" "}
                <b className="text-slate-900">
                  {naira(Number(selectedSubhead?.balance || 0))}
                </b>
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-semibold text-slate-800">Title</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
                placeholder="e.g. Vehicle Maintenance"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-800">Amount (₦)</label>
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
                placeholder="e.g. 250000"
                inputMode="numeric"
              />
            </div>
          </div>

          <div className="mt-5">
            <label className="text-sm font-semibold text-slate-800">Details</label>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              className="mt-1 min-h-[120px] w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
              placeholder="Write details..."
            />
          </div>

          <div className="mt-6">
            <button
              onClick={createRequest}
              disabled={saving}
              className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {saving ? "Submitting..." : "Submit Request"}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}