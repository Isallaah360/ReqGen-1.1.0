"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

type Dept = { id: string; name: string; hod_user_id: string | null; director_user_id: string | null };

export default function NewRequestPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  const [deptId, setDeptId] = useState<string>("");
  const [deptName, setDeptName] = useState<string>("");

  const [requestType, setRequestType] = useState<"Personal" | "Official">("Personal");
  const [personalCategory, setPersonalCategory] = useState<"Fund" | "NonFund">("NonFund");

  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [amount, setAmount] = useState<string>("0");

  const [signaturePath, setSignaturePath] = useState<string | null>(null);
  const [signaturePreviewUrl, setSignaturePreviewUrl] = useState<string | null>(null);

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

      const { data: dept, error: deptErr } = await supabase
        .from("departments")
        .select("id,name")
        .eq("id", prof.dept_id)
        .single();

      if (!deptErr && dept) setDeptName((dept as any).name);

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
    if (title.trim().length < 3) return "Please enter a title.";
    if (details.trim().length < 5) return "Please enter details.";
    const amt = Number(amount);
    if (Number.isNaN(amt) || amt < 0) return "Amount must be a valid number.";
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

  async function getSetting(key: string): Promise<string | null> {
    const { data, error } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", key)
      .maybeSingle();

    if (error) return null;
    return (data?.value as string) || null;
  }

  async function resolveInitialOwner(dept_id: string): Promise<{
    stage: "Director" | "HOD" | "Registry";
    owner: string;
  }> {
    // Load dept routing
    const { data: dept, error } = await supabase
      .from("departments")
      .select("id,name,hod_user_id,director_user_id")
      .eq("id", dept_id)
      .single();

    if (error || !dept) {
      // fallback to registry
      const reg = await getSetting("REGISTRY_USER_ID");
      if (!reg) throw new Error("REGISTRY_USER_ID not set in Admin Panel.");
      return { stage: "Registry", owner: reg };
    }

    const d = dept as Dept;

    if (d.director_user_id) return { stage: "Director", owner: d.director_user_id };
    if (d.hod_user_id) return { stage: "HOD", owner: d.hod_user_id };

    const reg = await getSetting("REGISTRY_USER_ID");
    if (!reg) throw new Error("REGISTRY_USER_ID not set in Admin Panel.");
    return { stage: "Registry", owner: reg };
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

      // ✅ NEW: Resolve initial owner + stage using Admin routing
      const routing = await resolveInitialOwner(deptId);

      const insertPayload: any = {
        request_no: requestNo,
        created_by: user.id,
        dept_id: deptId,
        request_type: requestType,
        personal_category: requestType === "Personal" ? personalCategory : null,
        amount: amt,
        title: title.trim(),
        details: details.trim(),
        status: "Submitted",
        current_stage: routing.stage,
        current_owner: routing.owner,
      };

      // Insert request and return inserted id
      const { data: inserted, error: insErr } = await supabase
        .from("requests")
        .insert(insertPayload)
        .select("id")
        .single();

      if (insErr) throw new Error(insErr.message);

      // Insert signed history entry (Submit)
      const { error: histErr } = await supabase.from("request_history").insert({
        request_id: inserted.id,
        action_by: user.id,
        from_stage: null,
        to_stage: routing.stage,
        action_type: "Submit",
        comment: "Submitted",
        signature_url: signaturePath, // REQUIRED
      });

      if (histErr) throw new Error("History insert failed: " + histErr.message);

      // ✅ NEW: Insert a notification for assigned officer
      const { error: notifErr } = await supabase.from("notifications").insert({
        user_id: routing.owner,
        title: "New Request Assigned",
        body: `${requestNo}: ${title.trim()}`,
        link: `/requests/${inserted.id}`,
        is_read: false,
      });

      if (notifErr) {
        // we won't fail the request if notification fails
        console.warn("Notification insert failed:", notifErr.message);
      }

      setMsg(`✅ Submitted! Assigned to ${routing.stage}. Notification sent.`);
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
                <label className="text-sm font-semibold text-slate-800">Title</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Leave Request / Purchase Request"
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
                Submit Request
              </button>
            </form>
          </div>
        )}
      </div>
    </main>
  );
}