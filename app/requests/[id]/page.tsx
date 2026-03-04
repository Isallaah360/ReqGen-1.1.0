"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

type Req = {
  id: string;
  request_no: string;
  title: string;
  details: string;
  amount: number;
  status: string;
  current_stage: string;
  current_owner: string | null;
  created_by: string;
  dept_id: string;
  subhead_id: string | null;
  request_type: "Personal" | "Official";
  personal_category: "Fund" | "NonFund" | null;
  created_at: string;

  // ✅ optional (won't break if missing in DB)
  funds_state?: string | null;
};

type Hist = {
  id: string;
  action_type: string;
  comment: string | null;
  to_stage: string | null;
  created_at: string;
  signature_url: string | null;
};

type SubheadMini = { id: string; code: string; name: string };
type ProfileMini = { id: string; role: string; signature_url: string | null };

function normStage(s: string | null | undefined) {
  return (s || "").trim().toUpperCase();
}

function normStatus(s: string | null | undefined) {
  return (s || "").trim().toLowerCase();
}

export default function RequestDetailsPage() {
  const router = useRouter();
  const params = useParams();

  // ✅ safer id parsing
  const id =
    typeof (params as any)?.id === "string"
      ? ((params as any).id as string)
      : String((params as any)?.id || "");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [msg, setMsg] = useState<string | null>(null);
  const [req, setReq] = useState<Req | null>(null);
  const [history, setHistory] = useState<Hist[]>([]);
  const [subhead, setSubhead] = useState<SubheadMini | null>(null);

  const [me, setMe] = useState<ProfileMini | null>(null);
  const [comment, setComment] = useState("");

  const isMyRequest = useMemo(() => !!req && !!me && req.created_by === me.id, [req, me]);

  // ✅ creator can edit/delete only if still HOD or Director stage
  // (optional: also require funds_state still reserved; safe if missing)
  const canEditDelete = useMemo(() => {
    if (!req || !me) return false;
    const stage = normStage(req.current_stage);
    const state = (req.funds_state || "").toLowerCase(); // might be empty
    const stateOk = !state || state === "reserved"; // if you don't have funds_state, allow by stage only
    return req.created_by === me.id && (stage === "HOD" || stage === "DIRECTOR") && stateOk;
  }, [req, me]);

  // ✅ only assigned owner can Approve/Reject
  const canAct = useMemo(() => {
    if (!req || !me) return false;
    return req.current_owner === me.id;
  }, [req, me]);

  const isClosed = useMemo(() => {
    const st = normStatus(req?.status);
    const stage = normStage(req?.current_stage);
    return st.includes("reject") || stage === "COMPLETED";
  }, [req]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setMsg(null);

      if (!id) {
        setMsg("Invalid request id.");
        setLoading(false);
        return;
      }

      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        router.push("/login");
        return;
      }

      // me
      const { data: myProf, error: myErr } = await supabase
        .from("profiles")
        .select("id,role,signature_url")
        .eq("id", auth.user.id)
        .single();

      if (myErr) {
        setMsg("Failed to load your profile: " + myErr.message);
        setLoading(false);
        return;
      }
      setMe(myProf as ProfileMini);

      // request (funds_state optional)
      const { data: r, error: rErr } = await supabase
        .from("requests")
        .select(
          "id,request_no,title,details,amount,status,current_stage,current_owner,created_by,dept_id,subhead_id,request_type,personal_category,created_at,funds_state"
        )
        .eq("id", id)
        .single();

      if (rErr) {
        setMsg("Failed to load request: " + rErr.message);
        setLoading(false);
        return;
      }
      setReq(r as Req);

      // subhead
      if ((r as any)?.subhead_id) {
        const { data: sh } = await supabase
          .from("subheads")
          .select("id,code,name")
          .eq("id", (r as any).subhead_id)
          .single();
        if (sh) setSubhead(sh as SubheadMini);
      } else {
        setSubhead(null);
      }

      // history
      const { data: h, error: hErr } = await supabase
        .from("request_history")
        .select("id,action_type,comment,to_stage,created_at,signature_url")
        .eq("request_id", id)
        .order("created_at", { ascending: false });

      if (hErr) setMsg("Failed to load history: " + hErr.message);
      setHistory((h || []) as Hist[]);

      setLoading(false);
    }

    load();
  }, [id, router]);

  async function getSetting(key: string): Promise<string | null> {
    const { data, error } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", key)
      .maybeSingle();
    if (error) return null;
    return (data?.value as string) || null;
  }

  async function resolveNextOwner(currentStage: string, r: Req) {
    const stage = normStage(currentStage);

    if (r.request_type === "Official") {
      if (stage === "DIRECTOR" || stage === "HOD") {
        const reg = await getSetting("REGISTRY_USER_ID");
        if (!reg) throw new Error("REGISTRY_USER_ID not set.");
        return { nextStage: "Registry", nextOwner: reg, nextStatus: "In Review" };
      }
      if (stage === "REGISTRY") {
        const dg = await getSetting("DG_USER_ID");
        if (!dg) throw new Error("DG_USER_ID not set.");
        return { nextStage: "DG", nextOwner: dg, nextStatus: "In Review" };
      }
      if (stage === "DG") {
        const acc = await getSetting("ACCOUNT_USER_ID");
        if (!acc) throw new Error("ACCOUNT_USER_ID not set.");
        return { nextStage: "Account", nextOwner: acc, nextStatus: "Approved" };
      }
      return { nextStage: "Completed", nextOwner: null, nextStatus: "Approved" };
    }

    // Personal:
    if (stage === "DIRECTOR" || stage === "HOD") {
      const hr = await getSetting("HR_USER_ID");
      if (!hr) throw new Error("HR_USER_ID not set.");
      return { nextStage: "HR", nextOwner: hr, nextStatus: "In Review" };
    }
    if (stage === "HR") {
      const reg = await getSetting("REGISTRY_USER_ID");
      if (!reg) throw new Error("REGISTRY_USER_ID not set.");
      return { nextStage: "Registry", nextOwner: reg, nextStatus: "In Review" };
    }
    if (stage === "REGISTRY") {
      const dg = await getSetting("DG_USER_ID");
      if (!dg) throw new Error("DG_USER_ID not set.");
      return { nextStage: "DG", nextOwner: dg, nextStatus: "In Review" };
    }
    if (stage === "DG") {
      if (r.personal_category === "Fund") {
        const acc = await getSetting("ACCOUNT_USER_ID");
        if (!acc) throw new Error("ACCOUNT_USER_ID not set.");
        return { nextStage: "Account", nextOwner: acc, nextStatus: "Approved" };
      } else {
        const hr = await getSetting("HR_USER_ID");
        if (!hr) throw new Error("HR_USER_ID not set.");
        return { nextStage: "HR", nextOwner: hr, nextStatus: "Approved" };
      }
    }

    return { nextStage: "Completed", nextOwner: null, nextStatus: "Approved" };
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

  async function reload() {
    if (!id) return;

    const { data: r2 } = await supabase
      .from("requests")
      .select(
        "id,request_no,title,details,amount,status,current_stage,current_owner,created_by,dept_id,subhead_id,request_type,personal_category,created_at,funds_state"
      )
      .eq("id", id)
      .single();

    setReq((r2 as any) || null);

    const { data: h2 } = await supabase
      .from("request_history")
      .select("id,action_type,comment,to_stage,created_at,signature_url")
      .eq("request_id", id)
      .order("created_at", { ascending: false });

    setHistory((h2 || []) as Hist[]);

    const subId = (r2 as any)?.subhead_id as string | null;
    if (subId) {
      const { data: sh } = await supabase.from("subheads").select("id,code,name").eq("id", subId).single();
      setSubhead((sh as any) || null);
    } else {
      setSubhead(null);
    }
  }

  async function act(action: "Approve" | "Reject") {
    if (!req || !me) return;

    if (isClosed) {
      setMsg("❌ This request is already closed (Completed/Rejected).");
      return;
    }

    if (!me.signature_url) {
      setMsg("❌ You must upload your signature in Profile before taking actions.");
      return;
    }
    if (!canAct) {
      setMsg("❌ You cannot act on this request (not assigned to you).");
      return;
    }
    if (action === "Reject" && comment.trim().length < 3) {
      setMsg("❌ Please write a reason/comment for rejection.");
      return;
    }

    setSaving(true);
    setMsg(null);

    try {
      if (action === "Reject") {
        // ✅ restore funds + write history inside RPC
        const { error: rejErr } = await supabase.rpc("reject_request_and_restore", {
          p_request_id: req.id,
          p_comment: comment.trim(),
          p_signature_url: me.signature_url,
        });

        if (rejErr) throw new Error(rejErr.message);

        await notify(req.created_by, "Request Rejected", `${req.request_no}: ${req.title}`, `/requests/${req.id}`);

        setMsg("✅ Rejected. Funds restored to subhead.");
      } else {
        const next = await resolveNextOwner(req.current_stage, req);

        // update request
        const { error: upErr } = await supabase
          .from("requests")
          .update({
            status: next.nextStatus,
            current_stage: next.nextStage,
            current_owner: next.nextOwner,
          })
          .eq("id", req.id);

        if (upErr) throw new Error(upErr.message);

        // history
        const { error: hErr } = await supabase.from("request_history").insert({
          request_id: req.id,
          action_by: me.id,
          from_stage: req.current_stage,
          to_stage: next.nextStage,
          action_type: "Approve",
          comment: comment.trim() || "Approved",
          signature_url: me.signature_url,
        });

        if (hErr) throw new Error(hErr.message);

        // ✅ finalize funds ONLY when it becomes Completed
        if (normStage(next.nextStage) === "COMPLETED") {
          const { error: finErr } = await supabase.rpc("finalize_request_funds", {
            p_request_id: req.id,
          });
          if (finErr) throw new Error("Finalize funds failed: " + finErr.message);
        }

        // notify next owner
        if (next.nextOwner) {
          await notify(next.nextOwner, "Request Assigned", `${req.request_no}: ${req.title}`, `/requests/${req.id}`);
        }

        setMsg(`✅ Approved. Sent to ${next.nextStage}.`);
      }

      setComment("");
      await reload();
    } catch (e: any) {
      setMsg("❌ Action failed: " + (e?.message || "Unknown error"));
    } finally {
      setSaving(false);
    }
  }

  async function deleteRequest() {
    if (!req) return;
    if (!canEditDelete) {
      setMsg("❌ You can only delete while request is still at HOD/Director.");
      return;
    }

    const ok = confirm("Delete this request? Funds will be restored to the subhead.");
    if (!ok) return;

    setSaving(true);
    setMsg(null);
    try {
      const { error } = await supabase.rpc("delete_request_restore", { p_request_id: req.id });
      if (error) throw new Error(error.message);

      setMsg("✅ Deleted and funds restored.");
      setTimeout(() => router.push("/requests"), 700);
    } catch (e: any) {
      setMsg("❌ Delete failed: " + (e?.message || "Unknown error"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4">
      <div className="mx-auto max-w-4xl py-10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Request Details</h1>
            <p className="mt-2 text-sm text-slate-600">
              Current stage: <b className="text-slate-900">{req?.current_stage || "—"}</b>
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => router.push("/requests")}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100"
            >
              Back
            </button>

            {req && (
              <button
                onClick={() => router.push(`/requests/${req.id}/print`)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100"
              >
                Print
              </button>
            )}
          </div>
        </div>

        {msg && <div className="mt-4 rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-800">{msg}</div>}

        {loading ? (
          <div className="mt-6 text-slate-600">Loading...</div>
        ) : !req ? (
          <div className="mt-6 rounded-2xl border bg-white p-6 shadow-sm text-slate-700">Request not found.</div>
        ) : (
          <>
            <div className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm text-slate-600">Request No</div>
                  <div className="text-lg font-extrabold text-slate-900">{req.request_no}</div>
                </div>

                <div className="flex items-center gap-2">
                  <StageBadge stage={req.current_stage} />
                  <StatusBadge status={req.status} />
                </div>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <Info label="Title" value={req.title} />
                <Info label="Amount (₦)" value={Number(req.amount || 0).toLocaleString()} />
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <Info label="Subhead" value={subhead ? `${subhead.code} — ${subhead.name}` : "—"} />
                <Info
                  label="Type"
                  value={req.request_type === "Personal" ? `Personal • ${req.personal_category || ""}` : "Official"}
                />
              </div>

              <div className="mt-5">
                <div className="text-xs font-semibold text-slate-500">Details</div>
                <div className="mt-2 whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-800">
                  {req.details}
                </div>
              </div>

              {canEditDelete && (
                <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                  <button
                    onClick={() => router.push(`/requests/${req.id}/edit`)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-100"
                  >
                    Edit
                  </button>
                  <button
                    onClick={deleteRequest}
                    disabled={saving}
                    className="w-full rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                  >
                    {saving ? "Working..." : "Delete"}
                  </button>
                </div>
              )}

              {!canEditDelete && isMyRequest && (
                <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                  Edit/Delete is locked once the request reaches Registry/DG/Account/HR.
                </div>
              )}
            </div>

            {/* ACTIONS */}
            <div className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
              <h2 className="text-lg font-bold text-slate-900">Actions</h2>
              <p className="mt-1 text-sm text-slate-600">
                Only the assigned officer can approve/reject. All actions require signature.
              </p>

              {!canAct ? (
                <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                  View only.
                </div>
              ) : (
                <>
                  <div className="mt-4">
                    <label className="text-sm font-semibold text-slate-800">Comment (required for Reject)</label>
                    <textarea
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      className="mt-1 min-h-[90px] w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
                      placeholder="Write your comment..."
                    />
                  </div>

                  <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                    <button
                      onClick={() => act("Approve")}
                      disabled={saving}
                      className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60"
                    >
                      {saving ? "Processing..." : "Approve"}
                    </button>

                    <button
                      onClick={() => act("Reject")}
                      disabled={saving}
                      className="w-full rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-red-700 disabled:opacity-60"
                    >
                      {saving ? "Processing..." : "Reject"}
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* HISTORY */}
            <div className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
              <h2 className="text-lg font-bold text-slate-900">History</h2>
              <p className="mt-1 text-sm text-slate-600">All actions are signed and recorded.</p>

              {history.length === 0 ? (
                <div className="mt-4 text-sm text-slate-700">No history yet.</div>
              ) : (
                <div className="mt-4 space-y-3">
                  {history.map((h) => (
                    <div key={h.id} className="rounded-xl border border-slate-200 bg-white p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-sm font-bold text-slate-900">{h.action_type}</div>
                        {h.to_stage && <StageBadge stage={h.to_stage} />}
                      </div>

                      {h.comment && <div className="mt-2 text-sm text-slate-800">{h.comment}</div>}

                      <div className="mt-2 text-xs text-slate-500">
                        {new Date(h.created_at).toLocaleString()}
                        {h.signature_url ? " • Signed ✅" : " • Signature missing ⚠️"}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
      <div className="text-xs font-semibold text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-semibold text-slate-900">{value}</div>
    </div>
  );
}

function StageBadge({ stage }: { stage: string }) {
  return (
    <span className="inline-flex rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700">
      {stage || "—"}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const s = (status || "").toLowerCase();
  const cls =
    s.includes("submit")
      ? "bg-blue-50 text-blue-700 border-blue-200"
      : s.includes("approve") || s.includes("in review")
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : s.includes("reject")
      ? "bg-red-50 text-red-700 border-red-200"
      : "bg-slate-50 text-slate-700 border-slate-200";

  return (
    <span className={`inline-flex rounded-lg border px-2 py-1 text-xs font-semibold ${cls}`}>
      {status || "—"}
    </span>
  );
}