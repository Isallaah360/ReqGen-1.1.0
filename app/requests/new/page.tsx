"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

type Dept = { id: string; name: string };
type Subhead = { id: string; code: string; name: string; balance: number };

export default function NewRequestPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [subLoading, setSubLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [deptId, setDeptId] = useState<string>("");
  const [deptName, setDeptName] = useState<string>("");

  const [requestType, setRequestType] = useState<"Personal" | "Official">("Personal");
  const [personalCategory, setPersonalCategory] = useState<"Fund" | "NonFund">("NonFund");

  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [amount, setAmount] = useState<string>("");

  // Signature required (stored in profile)
  const [signaturePath, setSignaturePath] = useState<string | null>(null);

  // Subheads
  const [subheads, setSubheads] = useState<Subhead[]>([]);
  const [subheadId, setSubheadId] = useState<string>("");
  const currentSubhead = useMemo(
    () => subheads.find((s) => s.id === subheadId) || null,
    [subheads, subheadId]
  );

  const currentBalance = Number(currentSubhead?.balance || 0);

  // Load profile dept + signature, then load subheads for dept
  useEffect(() => {
    let channel: any;

    async function load() {
      setLoading(true);
      setMsg(null);

      const { data: authData } = await supabase.auth.getUser();
      const user = authData.user;
      if (!user) {
        router.push("/login");
        return;
      }

      const { data: prof, error: profErr } = await supabase
        .from("profiles")
        .select("dept_id, signature_url")
        .eq("id", user.id)
        .single();

      if (profErr) {
        setMsg("Failed to load profile: " + profErr.message);
        setLoading(false);
        return;
      }

      if (!prof?.dept_id) {
        setMsg("Profile department not set. Please contact Admin.");
        setLoading(false);
        return;
      }

      if (!prof?.signature_url) {
        setMsg("❌ You must upload your signature in Profile before submitting any request.");
        setLoading(false);
        return;
      }

      setDeptId(prof.dept_id);
      setSignaturePath(prof.signature_url);

      const { data: dept, error: deptErr } = await supabase
        .from("departments")
        .select("id,name")
        .eq("id", prof.dept_id)
        .single();

      if (!deptErr && dept) setDeptName((dept as Dept).name);

      // load subheads
      setSubLoading(true);
      const { data: sh, error: shErr } = await supabase
        .from("subheads")
        .select("id,code,name,balance")
        .eq("dept_id", prof.dept_id)
        .eq("is_active", true)
        .order("code", { ascending: true });

      if (shErr) setMsg("Failed to load subheads: " + shErr.message);
      setSubheads((sh || []) as any);
      setSubLoading(false);

      // realtime: auto refresh when any subhead in this dept changes
      channel = supabase
        .channel("subheads-live")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "subheads" },
          async () => {
            const { data: sh2 } = await supabase
              .from("subheads")
              .select("id,code,name,balance")
              .eq("dept_id", prof.dept_id)
              .eq("is_active", true)
              .order("code", { ascending: true });

            setSubheads((sh2 || []) as any);
          }
        )
        .subscribe();

      setLoading(false);
    }

    load();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [router]);

  function validate(): string | null {
    if (!signaturePath) return "Signature is required. Upload it in Profile.";
    if (!subheadId) return "Please select a subhead.";
    if (title.trim().length < 3) return "Please enter a title.";
    if (details.trim().length < 5) return "Please enter details.";

    const amt = Number(amount);
    if (Number.isNaN(amt) || amt <= 0) return "Amount must be a valid number > 0.";
    if (amt > currentBalance) return "Insufficient balance in selected subhead.";

    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);

    const err = validate();
    if (err) return setMsg("❌ " + err);

    try {
      setMsg("Submitting request...");

      const amt = Number(amount);

      // ✅ One safe RPC does: signature check + create request + deduct + history insert
      const { data: reqId, error } = await supabase.rpc("submit_request", {
        p_dept_id: deptId,
        p_subhead_id: subheadId,
        p_request_type: requestType,
        p_personal_category: requestType === "Personal" ? personalCategory : null,
        p_title: title.trim(),
        p_details: details.trim(),
        p_amount: amt,
      });

      if (error) throw new Error(error.message);

      setMsg("✅ Request submitted successfully!");
      setTimeout(() => router.push(`/requests/${reqId}`), 600);
    } catch (e: any) {
      setMsg("❌ Submit failed: " + (e?.message || "Unknown error"));
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4">
      <div className="mx-auto max-w-3xl py-10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">New Request</h1>
            <p className="mt-2 text-sm text-slate-600">
              Department: <b className="text-slate-900">{deptName || "—"}</b>
            </p>
          </div>

          <button
            onClick={() => router.push("/requests")}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100"
          >
            Back
          </button>
        </div>

        {msg && (
          <div className="mt-4 rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-800">
            {msg}
          </div>
        )}

        {loading ? (
          <div className="mt-6 text-slate-600">Loading...</div>
        ) : (
          <div className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-semibold text-slate-800">Request Type</label>
                  <select
                    value={requestType}
                    onChange={(e) => setRequestType(e.target.value as any)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
                  >
                    <option value="Personal">Personal</option>
                    <option value="Official">Official</option>
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
                      <option value="NonFund">Non-Fund</option>
                      <option value="Fund">Fund</option>
                    </select>
                  </div>
                ) : (
                  <div />
                )}
              </div>

              <div>
                <label className="text-sm font-semibold text-slate-800">Subhead</label>
                <select
                  value={subheadId}
                  onChange={(e) => setSubheadId(e.target.value)}
                  disabled={subLoading}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none focus:border-blue-500 disabled:opacity-60"
                >
                  <option value="">
                    {subLoading ? "Loading subheads..." : "-- Select Subhead --"}
                  </option>
                  {subheads.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.code} — {s.name}
                    </option>
                  ))}
                </select>

                {subheadId && (
                  <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800">
                    <div className="font-semibold text-slate-900">Balance:</div>
                    <div className="mt-1">
                      ₦{currentBalance.toLocaleString()}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="text-sm font-semibold text-slate-800">Title</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Purchase Request / Logistics / Repairs"
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-slate-800">Details</label>
                <textarea
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  placeholder="Write full details..."
                  className="mt-1 min-h-[140px] w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-slate-800">Amount (₦)</label>
                <input
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0"
                  inputMode="decimal"
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
                />
                {amount && subheadId && (
                  <div className="mt-1 text-xs text-slate-600">
                    Remaining after submit:{" "}
                    <b className="text-slate-900">
                      ₦{Math.max(0, currentBalance - Number(amount || 0)).toLocaleString()}
                    </b>
                  </div>
                )}
              </div>

              <button
                type="submit"
                className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
              >
                Submit Request (Signed)
              </button>
            </form>
          </div>
        )}
      </div>
    </main>
  );
}