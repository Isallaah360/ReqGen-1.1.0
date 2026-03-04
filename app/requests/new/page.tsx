"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

type Dept = { id: string; name: string };
type Subhead = { id: string; code: string; name: string; balance: number; is_active: boolean };

export default function NewRequestPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  const [deptId, setDeptId] = useState<string>("");
  const [deptName, setDeptName] = useState<string>("");

  const [subheads, setSubheads] = useState<Subhead[]>([]);
  const [subheadId, setSubheadId] = useState<string>("");
  const selectedSubhead = useMemo(
    () => subheads.find((s) => s.id === subheadId) || null,
    [subheads, subheadId]
  );

  const [requestType, setRequestType] = useState<"Personal" | "Official">("Official");
  const [personalCategory, setPersonalCategory] = useState<"Fund" | "NonFund">("Fund");

  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [amount, setAmount] = useState<string>("0");

  const [signaturePath, setSignaturePath] = useState<string | null>(null);
  const [signaturePreviewUrl, setSignaturePreviewUrl] = useState<string | null>(null);

  // realtime channel (selected subhead)
  useEffect(() => {
    if (!subheadId) return;

    const ch = supabase
      .channel("subhead-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "subheads", filter: `id=eq.${subheadId}` },
        async () => {
          const { data } = await supabase
            .from("subheads")
            .select("id,code,name,balance,is_active")
            .eq("id", subheadId)
            .single();
          if (data) {
            setSubheads((prev) => prev.map((x) => (x.id === subheadId ? (data as any) : x)));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, [subheadId]);

  useEffect(() => {
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

      const { data: dept } = await supabase
        .from("departments")
        .select("id,name")
        .eq("id", prof.dept_id)
        .single();
      if (dept) setDeptName((dept as Dept).name);

      // load subheads for department
      const { data: sh, error: shErr } = await supabase
        .from("subheads")
        .select("id,code,name,balance,is_active")
        .eq("dept_id", prof.dept_id)
        .eq("is_active", true)
        .order("code", { ascending: true });

      if (shErr) {
        setMsg("Failed to load subheads: " + shErr.message);
      } else {
        setSubheads((sh || []) as any);
        const first = (sh || [])[0]?.id;
        if (first) setSubheadId(first);
      }

      const { data: signed } = await supabase.storage
        .from("signatures")
        .createSignedUrl(prof.signature_url, 60 * 10);
      if (signed?.signedUrl) setSignaturePreviewUrl(signed.signedUrl);

      setLoading(false);
    }

    load();
  }, [router]);

  function validate(): string | null {
    if (!signaturePath) return "Signature is required. Upload it in Profile.";
    if (!subheadId) return "Please select a subhead.";
    if (title.trim().length < 3) return "Please enter a title.";
    if (details.trim().length < 5) return "Please enter details.";
    const amt = Number(amount);
    if (Number.isNaN(amt) || amt <= 0) return "Amount must be a valid number.";
    if (selectedSubhead && amt > Number(selectedSubhead.balance || 0)) return "Insufficient subhead balance.";
    return null;
  }

  function makeRequestNo(): string {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const rnd = Math.floor(Math.random() * 900000) + 100000;
    return `RG-${yyyy}${mm}${dd}-${rnd}`;
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);

    const err = validate();
    if (err) return setMsg("❌ " + err);

    try {
      setMsg("Submitting request...");

      const { data: authData } = await supabase.auth.getUser();
      const user = authData.user;
      if (!user) return router.push("/login");

      const requestNo = makeRequestNo();
      const amt = Number(amount);

      // initial owner: HOD or Director (your routing design)
      const firstStage = "HOD";

      const insertPayload: any = {
        request_no: requestNo,
        created_by: user.id,
        dept_id: deptId,
        subhead_id: subheadId,
        request_type: requestType,
        personal_category: requestType === "Personal" ? personalCategory : null,
        amount: amt,
        title: title.trim(),
        details: details.trim(),
        status: "Submitted",
        current_stage: firstStage,
        current_owner: user.id, // temporary until your routing sets actual HOD/Director owner
        funds_state: "reserved",
        funds_reserved_amount: amt,
      };

      const { data: inserted, error: insErr } = await supabase
        .from("requests")
        .insert(insertPayload)
        .select("id")
        .single();

      if (insErr) throw new Error(insErr.message);

      // ✅ reserve funds atomically
      const { error: resErr } = await supabase.rpc("reserve_request_funds", { p_request_id: inserted.id });
      if (resErr) throw new Error("Funds reserve failed: " + resErr.message);

      // history (submit) with requester signature
      const { error: histErr } = await supabase.from("request_history").insert({
        request_id: inserted.id,
        action_by: user.id,
        from_stage: null,
        to_stage: firstStage,
        action_type: "Submit",
        comment: "Submitted",
        signature_url: signaturePath,
      });
      if (histErr) throw new Error("History insert failed: " + histErr.message);

      // (optional) notify approvals inbox route later when you set owner properly
      // await notify(<hod_user_id>, "New Request Submitted", `${requestNo}: ${title}`, `/requests/${inserted.id}`);

      setMsg("✅ Request submitted and funds reserved!");
      setTimeout(() => router.push("/requests"), 700);
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
            onClick={() => router.push("/dashboard")}
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
            {signaturePreviewUrl && (
              <div className="mb-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm font-semibold text-slate-800">Your Signature (Required)</div>
                <img
                  src={signaturePreviewUrl}
                  alt="Signature preview"
                  className="mt-3 h-20 w-auto rounded-xl border bg-white p-2"
                />
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Subhead */}
              <div>
                <label className="text-sm font-semibold text-slate-800">Subhead</label>
                <select
                  value={subheadId}
                  onChange={(e) => setSubheadId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
                >
                  <option value="">-- Select subhead --</option>
                  {subheads.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.code} — {s.name}
                    </option>
                  ))}
                </select>

                <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                  <div className="text-slate-600">Current Balance</div>
                  <div className="text-lg font-extrabold text-slate-900">
                    ₦{Number(selectedSubhead?.balance || 0).toLocaleString()}
                  </div>
                </div>
              </div>

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
                      <option value="NonFund">Non-Fund</option>
                    </select>
                  </div>
                ) : (
                  <div />
                )}
              </div>

              <div>
                <label className="text-sm font-semibold text-slate-800">Title</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Request for Fund"
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
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
                />
              </div>

              <button
                type="submit"
                className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
              >
                Submit Request (Reserve Funds)
              </button>
            </form>
          </div>
        )}
      </div>
    </main>
  );
}