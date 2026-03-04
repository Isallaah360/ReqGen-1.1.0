"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../../lib/supabaseClient";

export default function EditRequestPage() {
  const router = useRouter();
  const params = useParams();
  const id = String((params as any)?.id || "");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [amount, setAmount] = useState<string>("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      setMsg(null);

      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return router.push("/login");

      const { data: r, error } = await supabase
        .from("requests")
        .select("id,title,details,amount,current_stage,created_by")
        .eq("id", id)
        .single();

      if (error) {
        setMsg("Failed to load request: " + error.message);
        setLoading(false);
        return;
      }

      // Basic guard: must still be HOD/Director and created_by = me
      if (r.created_by !== auth.user.id) {
        setMsg("❌ You can only edit your own request.");
        setLoading(false);
        return;
      }
      const st = String(r.current_stage || "").toUpperCase();
      if (st !== "HOD" && st !== "DIRECTOR") {
        setMsg("❌ Cannot edit. Request already progressed beyond HOD/Director.");
        setLoading(false);
        return;
      }

      setTitle(r.title || "");
      setDetails(r.details || "");
      setAmount(String(r.amount || ""));
      setLoading(false);
    }

    load();
  }, [id, router]);

  function validate() {
    if (title.trim().length < 3) return "Enter title.";
    if (details.trim().length < 5) return "Enter details.";
    const a = Number(amount);
    if (Number.isNaN(a) || a <= 0) return "Amount must be > 0.";
    return null;
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);

    const err = validate();
    if (err) return setMsg("❌ " + err);

    setSaving(true);
    try {
      const { error } = await supabase.rpc("update_request_amount", {
        p_request_id: id,
        p_new_title: title.trim(),
        p_new_details: details.trim(),
        p_new_amount: Number(amount),
      });

      if (error) throw new Error(error.message);

      setMsg("✅ Updated successfully.");
      setTimeout(() => router.push(`/requests/${id}`), 600);
    } catch (e: any) {
      setMsg("❌ Update failed: " + (e?.message || "Unknown error"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4">
      <div className="mx-auto max-w-3xl py-10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Edit Request</h1>
            <p className="mt-2 text-sm text-slate-600">Allowed only while at HOD/Director.</p>
          </div>

          <button
            onClick={() => router.push(`/requests/${id}`)}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100"
          >
            Back
          </button>
        </div>

        {msg && <div className="mt-4 rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-800">{msg}</div>}

        {loading ? (
          <div className="mt-6 text-slate-600">Loading...</div>
        ) : (
          <div className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
            <form onSubmit={save} className="space-y-4">
              <div>
                <label className="text-sm font-semibold text-slate-800">Title</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-slate-800">Details</label>
                <textarea
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  className="mt-1 min-h-[140px] w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-slate-800">Amount (₦)</label>
                <input
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
                />
              </div>

              <button
                disabled={saving}
                className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </form>
          </div>
        )}
      </div>
    </main>
  );
}