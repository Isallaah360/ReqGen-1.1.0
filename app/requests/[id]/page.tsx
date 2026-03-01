"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

type Req = {
  id: string;
  request_no: string;
  title: string | null;
  details: string | null;
  request_type: "Personal" | "Official";
  personal_category: "Fund" | "NonFund" | null;
  amount: number;
  status: string;
  current_stage: string;
  current_owner: string;
  created_at: string;
};

type Hist = {
  id: string;
  action_type: string;
  comment: string | null;
  from_stage: string | null;
  to_stage: string | null;
  signature_url: string | null;
  action_at: string;
};

export default function RequestDetailsPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const requestId = params?.id;

  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  const [req, setReq] = useState<Req | null>(null);
  const [hist, setHist] = useState<Hist[]>([]);
  const [sigUrls, setSigUrls] = useState<Record<string, string>>({}); // historyId -> signedUrl

  // Action panel
  const [meId, setMeId] = useState<string | null>(null);
  const [mySignaturePath, setMySignaturePath] = useState<string | null>(null);
  const [mySignaturePreview, setMySignaturePreview] = useState<string | null>(null);

  const [nextStage, setNextStage] = useState<string>("Registry");
  const [comment, setComment] = useState<string>("");
  const [acting, setActing] = useState(false);

  const canAct = useMemo(() => {
    if (!req || !meId) return false;
    if (req.status === "Rejected" || req.status === "Completed") return false;
    return req.current_owner === meId;
  }, [req, meId]);

  async function reloadEverything() {
    setLoading(true);
    setMsg(null);

    const { data: authData } = await supabase.auth.getUser();
    const user = authData.user;
    if (!user) {
      router.push("/login");
      return;
    }
    setMeId(user.id);

    if (!requestId) {
      setMsg("Invalid request id.");
      setLoading(false);
      return;
    }

    // Load my signature
    const { data: prof, error: profErr } = await supabase
      .from("profiles")
      .select("signature_url")
      .eq("id", user.id)
      .single();

    if (profErr) {
      setMsg("Failed to load my profile: " + profErr.message);
      setLoading(false);
      return;
    }

    if (!prof?.signature_url) {
      setMsg("❌ Your signature is missing. Please re-upload signature.");
      setLoading(false);
      return;
    }

    setMySignaturePath(prof.signature_url);

    const { data: signedMe } = await supabase.storage
      .from("signatures")
      .createSignedUrl(prof.signature_url, 60 * 10);

    if (signedMe?.signedUrl) setMySignaturePreview(signedMe.signedUrl);

    // Load request
    const { data: r, error: rErr } = await supabase
      .from("requests")
      .select(
        "id,request_no,title,details,request_type,personal_category,amount,status,current_stage,current_owner,created_at"
      )
      .eq("id", requestId)
      .single();

    if (rErr) {
      setMsg("Failed to load request: " + rErr.message);
      setLoading(false);
      return;
    }

    setReq(r as Req);

    // Load history
    const { data: h, error: hErr } = await supabase
      .from("request_history")
      .select("id,action_type,comment,from_stage,to_stage,signature_url,action_at")
      .eq("request_id", requestId)
      .order("action_at", { ascending: true });

    if (hErr) {
      setMsg("Failed to load history: " + hErr.message);
      setLoading(false);
      return;
    }

    const history = (h || []) as Hist[];
    setHist(history);

    // Signed URLs for history signatures
    const urlMap: Record<string, string> = {};
    for (const item of history) {
      if (item.signature_url) {
        const { data: signed } = await supabase.storage
          .from("signatures")
          .createSignedUrl(item.signature_url, 60 * 10);

        if (signed?.signedUrl) urlMap[item.id] = signed.signedUrl;
      }
    }
    setSigUrls(urlMap);

    setLoading(false);
  }

  useEffect(() => {
    reloadEverything();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestId]);

  const stageOptions = [
    "Director",
    "HOD",
    "HR",
    "Registry",
    "DG",
    "Account",
    "Completed",
  ];

  async function takeAction(actionType: "Forward" | "Approve" | "Reject") {
    if (!req || !meId || !mySignaturePath) return;

    if (!canAct) {
      setMsg("❌ You are not the current owner of this request.");
      return;
    }

    if (actionType !== "Reject" && !nextStage) {
      setMsg("❌ Please select next stage.");
      return;
    }

    setActing(true);
    setMsg(null);

    try {
      const fromStage = req.current_stage;

      // Decide updates
      let newStatus = req.status;
      let newStage = req.current_stage;

      if (actionType === "Reject") {
        newStatus = "Rejected";
        newStage = "Rejected";
      } else if (actionType === "Forward") {
        newStatus = "InReview";
        newStage = nextStage;
      } else if (actionType === "Approve") {
        newStatus = "Approved";
        newStage = nextStage;
      }

      // For now: keep owner as self (Option A+)
      // Later: map nextStage -> actual user (Director/HOD/Registry/DG/Account)
      const newOwner = meId;

      // 1) Update request
      const { error: upErr } = await supabase
        .from("requests")
        .update({
          status: newStatus,
          current_stage: newStage,
          current_owner: newOwner,
          closed_at:
            newStatus === "Rejected" || newStage === "Completed"
              ? new Date().toISOString()
              : null,
        })
        .eq("id", req.id);

      if (upErr) throw new Error("Request update failed: " + upErr.message);

      // 2) Insert history (signed)
      const { error: histErr } = await supabase.from("request_history").insert({
        request_id: req.id,
        action_by: meId,
        from_stage: fromStage,
        to_stage: newStage,
        action_type: actionType,
        comment: comment.trim() || null,
        signature_url: mySignaturePath,
      });

      if (histErr) throw new Error("History insert failed: " + histErr.message);

      setComment("");
      setMsg("✅ Action saved successfully.");
      await reloadEverything();
    } catch (e: any) {
      setMsg("❌ " + (e?.message || "Unknown error"));
    } finally {
      setActing(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Request Details</h1>
          <p className="mt-2 text-sm text-gray-600">
            View request information and signed history.
          </p>
        </div>

        <button
          onClick={() => router.push("/requests")}
          className="rounded-xl border px-4 py-2 text-sm font-semibold hover:bg-gray-50"
        >
          Back
        </button>
      </div>

      {loading && <p className="mt-6 text-gray-600">Loading...</p>}

      {msg && (
        <div className="mt-6 rounded-xl bg-gray-100 px-3 py-2 text-sm">
          {msg}
        </div>
      )}

      {req && (
        <div className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <div className="text-xs text-gray-500">Request No</div>
              <div className="font-mono text-sm">{req.request_no}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Status / Stage</div>
              <div className="text-sm font-semibold">
                {req.status} — {req.current_stage}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Type</div>
              <div className="text-sm">
                {req.request_type}
                {req.personal_category ? ` (${req.personal_category})` : ""}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Amount</div>
              <div className="text-sm font-semibold">
                ₦{Number(req.amount || 0).toLocaleString()}
              </div>
            </div>
          </div>

          <div className="mt-5">
            <div className="text-xs text-gray-500">Title</div>
            <div className="text-base font-semibold">{req.title || "—"}</div>
          </div>

          <div className="mt-4">
            <div className="text-xs text-gray-500">Details</div>
            <div className="mt-1 whitespace-pre-wrap text-sm text-gray-800">
              {req.details || "—"}
            </div>
          </div>
        </div>
      )}

      {/* Action Panel */}
      {req && (
        <div className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold">Take Action</h2>

          {!canAct ? (
            <p className="mt-3 text-sm text-gray-600">
              You cannot act on this request (not assigned to you).
            </p>
          ) : (
            <>
              {mySignaturePreview && (
                <div className="mt-4 rounded-xl border p-3">
                  <div className="text-xs text-gray-500 mb-1">
                    Your Signature (required)
                  </div>
                  <img
                    src={mySignaturePreview}
                    alt="My signature"
                    className="h-16 w-auto rounded-lg border bg-white p-1"
                  />
                </div>
              )}

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-medium">Next Stage</label>
                  <select
                    value={nextStage}
                    onChange={(e) => setNextStage(e.target.value)}
                    className="mt-1 w-full rounded-xl border px-3 py-2 outline-none focus:ring-2 focus:ring-black/20"
                  >
                    {stageOptions.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-gray-500">
                    For now we keep owner as you (Option A+). Next step: assign to real officer.
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium">Comment</label>
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    className="mt-1 w-full rounded-xl border px-3 py-2 outline-none focus:ring-2 focus:ring-black/20"
                    rows={4}
                    placeholder="Write comment..."
                  />
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  disabled={acting}
                  onClick={() => takeAction("Forward")}
                  className="rounded-xl border px-4 py-2 text-sm font-semibold hover:bg-gray-50 disabled:opacity-50"
                >
                  Forward
                </button>

                <button
                  disabled={acting}
                  onClick={() => takeAction("Approve")}
                  className="rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-50"
                >
                  Approve
                </button>

                <button
                  disabled={acting}
                  onClick={() => takeAction("Reject")}
                  className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                >
                  Reject
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* History timeline */}
      {hist.length > 0 && (
        <div className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold">Signed History</h2>
          <div className="mt-4 space-y-4">
            {hist.map((h) => (
              <div key={h.id} className="rounded-xl border p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-sm font-semibold">
                      {h.action_type}
                      {h.to_stage ? ` → ${h.to_stage}` : ""}
                    </div>
                    <div className="text-xs text-gray-500">
                      {new Date(h.action_at).toLocaleString()}
                    </div>
                    {h.comment && (
                      <div className="mt-2 text-sm text-gray-700">
                        {h.comment}
                      </div>
                    )}
                  </div>

                  {sigUrls[h.id] ? (
                    <div className="shrink-0">
                      <div className="text-xs text-gray-500 mb-1">Signature</div>
                      <img
                        src={sigUrls[h.id]}
                        alt="Signature"
                        className="h-16 w-auto rounded-lg border bg-white p-1"
                      />
                    </div>
                  ) : (
                    <div className="text-xs text-gray-400">No signature</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}