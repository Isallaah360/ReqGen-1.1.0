"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
type Req = {
  id: string;
  title: string;
  details: string;
  amount: number;
  current_stage: string;
  created_by: string;
  dept_id: string;
  subhead_id: string | null;
  funds_state: string;
};

type Subhead = { id: string; code: string; name: string; balance: number; is_active: boolean };
type Me = { id: string };

export default function EditRequestPage() {
  const router = useRouter();
  const params = useParams();
  const id = String((params as any)?.id || "");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [me, setMe] = useState<Me | null>(null);
  const [req, setReq] = useState<Req | null>(null);
  const [subheads, setSubheads] = useState<Subhead[]>([]);

  const [subheadId, setSubheadId] = useState("");
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [amount, setAmount] = useState("0");

  const canEdit = useMemo(() => {
    if (!req || !me) return false;
    const stage = (req.current_stage || "").toUpperCase();
    return req.created_by === me.id && (stage === "HOD" || stage === "DIRECTOR") && req.funds_state === "reserved";
  }, [req, me]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setMsg(null);

      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return router.push("/login");
      setMe({ id: auth.user.id });

      const { data: r, error: rErr } = await supabase
        .from("requests")
        .select("id,title,details,amount,current_stage,created_by,dept_id,subhead_id,funds_state")
        .eq("id", id)
        .single();

      if (rErr) {
        setMsg("Failed to load request: " + rErr.message);
        setLoading(false);
        return;
      }

      setReq(r as any);
      setSubheadId((r as any).subhead_id || "");
      setTitle((r as any).title || "");
      setDetails((r as any).details || "");
      setAmount(String((r as any).amount || 0));

      const deptId = (r as any).dept_id;
      const { data: sh } = await supabase
        .from("subheads")
        .select("id,code,name,balance,is_active")
        .eq("dept_id", deptId)
        .eq("is_active", true)
        .order("code", { ascending: true });

      setSubheads((sh || []) as any);

      setLoading(false);
    }
    load();
  }, [id, router]);

  async function save() {
    if (!req) return;
    if (!canEdit) {
      setMsg("❌ You can only edit while request is still at HOD/Director (and reserved).");
      return;
    }

    const amt = Number(amount);
    if (!subheadId) return setMsg("❌ Select subhead.");
    if (!title.trim()) return setMsg("❌ Title required.");
    if (!details.trim()) return setMsg("❌ Details required.");
    if (!amt || amt <= 0) return setMsg("❌ Amount must be > 0.");

    setSaving(true);
    setMsg(null);

    try {
      const { error } = await supabase.rpc("update_request_adjust_reservation", {
        p_request_id: req.id,
        p_new_subhead_id: subheadId,
        p_new_amount: amt,
        p_new_title: title.trim(),
        p_new_details: details.trim(),
      });

      if (error) throw new Error(error.message);

      setMsg("✅ Updated successfully.");
      setTimeout(() => router.push(`/requests/${req.id}`), 600);
    } catch (e: any) {
      setMsg("❌ Update failed: " + (e?.message || "Unknown error"));
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

  if (!req) {
    return (
      <main className="min-h-screen bg-slate-50 px-4">
        <div className="mx-auto max-w-3xl py-10">Not found.</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4">
      <div className="mx-auto max-w-3xl py-10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Edit Request</h1>
            <p className="mt-2 text-sm text-slate-600">Only allowed at HOD/Director stage.</p>
          </div>
          <button
            onClick={() => router.push(`/requests/${req.id}`)}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100"
          >
            Back
          </button>
        </div>

        {msg && <div className="mt-4 rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-800">{msg}</div>}

        {!canEdit ? (
          <div className="mt-6 rounded-2xl border bg-white p-6 shadow-sm text-slate-700">
            Edit is locked. This request has moved beyond HOD/Director or is not reserved.
          </div>
        ) : (
          <div className="mt-6 rounded-2xl border bg-white p-6 shadow-sm space-y-4">
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
                    {s.code} — {s.name} (Bal ₦{Number(s.balance || 0).toLocaleString()})
                  </option>
                ))}
              </select>
            </div>

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
              onClick={save}
              disabled={saving}
              className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        )}
      </div>
    </main>
  );
}