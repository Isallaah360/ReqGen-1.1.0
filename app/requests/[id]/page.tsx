"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { RequestProgress } from "../../components/RequestProgress";

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
  funds_state: string | null;
  created_at: string;

  assigned_account_officer_id: string | null;
  assigned_account_officer_name: string | null;
};

type Hist = {
  id: string;
  action_type: string;
  comment: string | null;
  to_stage: string | null;
  created_at: string;
  signature_url: string | null;
  actor_name: string | null;
};

type SubheadMini = {
  id: string;
  code: string | null;
  name: string;
};

type ProfileMini = {
  id: string;
  role: string;
  signature_url: string | null;
  full_name?: string | null;
};

type OfficerMini = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string | null;
};

type AttachmentRow = {
  id: string;
  request_id: string;
  uploaded_by: string;
  file_name: string;
  file_path: string;
  file_type: string | null;
  file_size: number | null;
  verification_status: string;
  verified_by: string | null;
  verified_at: string | null;
  verifier_comment: string | null;
  created_at: string;
  signed_url?: string | null;
};

type AttachmentCheckRow = {
  id: string;
  request_id: string;
  attachment_id: string;
  checked_by: string;
  checked_by_name: string | null;
  checked_by_role: string | null;
  check_status: string;
  check_comment: string | null;
  checked_at: string;
  created_at: string;
};

type SensitiveAction = "Approve" | "Reject" | "Delete";

function roleKey(role: string | null | undefined) {
  return (role || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/_/g, "");
}

function stageKey(stage: string | null | undefined) {
  return (stage || "").trim().toUpperCase().replace(/\s+/g, "");
}

function officerLabel(o: OfficerMini) {
  return o.full_name?.trim() || o.email?.trim() || o.id;
}

function requestTypeLabel(req: Req) {
  if (req.request_type === "Official") return "Official";
  return `Personal • ${req.personal_category || "—"}`;
}

function fileSizeLabel(bytes: number | null | undefined) {
  const n = Number(bytes || 0);

  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(2)} MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${n} B`;
}

function attachmentStatusClass(status: string | null | undefined) {
  const s = (status || "").toLowerCase();

  if (s === "verified") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (s === "rejected") return "border-red-200 bg-red-50 text-red-700";

  return "border-amber-200 bg-amber-50 text-amber-800";
}

function attachmentStatusLabel(status: string | null | undefined) {
  const s = (status || "").toLowerCase();

  if (s === "verified") return "Verified Globally ✅";
  if (s === "rejected") return "Rejected ❌";

  return "Pending General Review";
}

export default function RequestDetailsPage() {
  const router = useRouter();
  const params = useParams();

  const id =
    typeof (params as any)?.id === "string"
      ? ((params as any).id as string)
      : String((params as any)?.id || "");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [checkingAttachmentId, setCheckingAttachmentId] = useState<string | null>(null);

  const [msg, setMsg] = useState<string | null>(null);
  const [req, setReq] = useState<Req | null>(null);
  const [history, setHistory] = useState<Hist[]>([]);
  const [subhead, setSubhead] = useState<SubheadMini | null>(null);
  const [attachments, setAttachments] = useState<AttachmentRow[]>([]);
  const [attachmentChecks, setAttachmentChecks] = useState<AttachmentCheckRow[]>([]);

  const [me, setMe] = useState<ProfileMini | null>(null);
  const [comment, setComment] = useState("");

  const [accountOfficers, setAccountOfficers] = useState<OfficerMini[]>([]);
  const [selectedOfficerId, setSelectedOfficerId] = useState("");

  const [mfaVerified, setMfaVerified] = useState(false);
  const [totpFactorId, setTotpFactorId] = useState<string | null>(null);
  const [showMfaModal, setShowMfaModal] = useState(false);
  const [mfaCode, setMfaCode] = useState("");
  const [pendingAction, setPendingAction] = useState<SensitiveAction | null>(null);

  const rk = roleKey(me?.role);
  const stg = stageKey(req?.current_stage);

  const isMyRequest = useMemo(
    () => !!req && !!me && req.created_by === me.id,
    [req, me]
  );

  const requesterCanEditDeleteEarly = useMemo(() => {
    if (!req || !me) return false;

    return (
      req.created_by === me.id &&
      ["DIRECTOR", "HOD"].includes(stg) &&
      (req.funds_state || "").toLowerCase() === "reserved"
    );
  }, [req, me, stg]);

  const assignedDirectorHodHrCanEdit = useMemo(() => {
    if (!req || !me) return false;

    return ["director", "hod", "hr"].includes(rk) && req.current_owner === me.id;
  }, [req, me, rk]);

  const canEditRequest = useMemo(() => {
    return requesterCanEditDeleteEarly || assignedDirectorHodHrCanEdit;
  }, [requesterCanEditDeleteEarly, assignedDirectorHodHrCanEdit]);

  const canDeleteRequest = useMemo(() => {
    return requesterCanEditDeleteEarly;
  }, [requesterCanEditDeleteEarly]);

  const canAct = useMemo(() => {
    if (!req || !me) return false;
    return req.current_owner === me.id;
  }, [req, me]);

  const canCheckAttachments = useMemo(() => {
    if (!req || !me) return false;

    if (req.current_owner === me.id) return true;

    return [
      "admin",
      "auditor",
      "director",
      "hod",
      "hr",
      "registry",
      "dg",
      "account",
      "accounts",
      "accountofficer",
    ].includes(rk);
  }, [req, me, rk]);

  const isOfficial = useMemo(() => {
    return (req?.request_type || "").trim().toUpperCase() === "OFFICIAL";
  }, [req?.request_type]);

  const isPersonalFund = useMemo(() => {
    return (
      (req?.request_type || "").trim().toUpperCase() === "PERSONAL" &&
      (req?.personal_category || "").trim().toUpperCase() === "FUND"
    );
  }, [req?.request_type, req?.personal_category]);

  const isPersonalNonFund = useMemo(() => {
    return (
      (req?.request_type || "").trim().toUpperCase() === "PERSONAL" &&
      (req?.personal_category || "").trim().toUpperCase() === "NONFUND"
    );
  }, [req?.request_type, req?.personal_category]);

  const isHRFiling = useMemo(() => {
    const stage = (req?.current_stage || "").trim().toUpperCase().replace(/\s+/g, "");
    return stage === "HRFILING";
  }, [req?.current_stage]);

  const needsAccountOfficerSelection = useMemo(() => {
    if (!req || !canAct) return false;

    const isRegistry = (req.current_stage || "").trim().toUpperCase() === "REGISTRY";

    return isRegistry && (isOfficial || isPersonalFund);
  }, [req, canAct, isOfficial, isPersonalFund]);

  const hasAttachments = attachments.length > 0;

  const myCheckedAttachmentIds = useMemo(() => {
    if (!me) return new Set<string>();

    return new Set(
      attachmentChecks
        .filter((c) => c.checked_by === me.id && (c.check_status || "") === "Checked")
        .map((c) => c.attachment_id)
    );
  }, [attachmentChecks, me]);

  const myPendingAttachments = useMemo(() => {
    if (!me) return attachments;
    return attachments.filter((a) => !myCheckedAttachmentIds.has(a.id));
  }, [attachments, myCheckedAttachmentIds, me]);

  const allAttachmentsCheckedByMe = useMemo(() => {
    if (attachments.length === 0) return true;
    if (!me) return false;
    return myPendingAttachments.length === 0;
  }, [attachments.length, myPendingAttachments.length, me]);

  function isAttachmentCheckedByMe(attachmentId: string) {
    return myCheckedAttachmentIds.has(attachmentId);
  }

  function attachmentCheckCount(attachmentId: string) {
    return attachmentChecks.filter((c) => c.attachment_id === attachmentId).length;
  }

  async function checkMfaStatus() {
    const { data: auth } = await supabase.auth.getUser();

    if (!auth.user) {
      router.push("/login");
      return false;
    }

    const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

    if (error) {
      setMfaVerified(false);
      return false;
    }

    const ok = data.currentLevel === "aal2";
    setMfaVerified(ok);
    return ok;
  }

  async function loadMfaFactor() {
    const { data, error } = await supabase.auth.mfa.listFactors();

    if (error) {
      setTotpFactorId(null);
      return null;
    }

    const verified = data.totp.find((factor) => factor.status === "verified");
    setTotpFactorId(verified?.id || null);

    return verified?.id || null;
  }

  async function loadAttachmentsAndChecks(requestId: string) {
    const { data: attachmentRows, error: attachmentErr } = await supabase
      .from("request_attachments")
      .select(
        "id,request_id,uploaded_by,file_name,file_path,file_type,file_size,verification_status,verified_by,verified_at,verifier_comment,created_at"
      )
      .eq("request_id", requestId)
      .order("created_at", { ascending: true });

    if (attachmentErr) {
      setAttachments([]);
      setAttachmentChecks([]);
      setMsg("Failed to load attachments: " + attachmentErr.message);
      return;
    }

    const rows = (attachmentRows || []) as AttachmentRow[];

    const signedRows = await Promise.all(
      rows.map(async (row) => {
        const { data: signed } = await supabase.storage
          .from("request-attachments")
          .createSignedUrl(row.file_path, 60 * 10);

        return {
          ...row,
          signed_url: signed?.signedUrl || null,
        };
      })
    );

    setAttachments(signedRows);

    const { data: checkRows, error: checkErr } = await supabase
      .from("request_attachment_checks")
      .select(
        "id,request_id,attachment_id,checked_by,checked_by_name,checked_by_role,check_status,check_comment,checked_at,created_at"
      )
      .eq("request_id", requestId)
      .order("checked_at", { ascending: true });

    if (checkErr) {
      setAttachmentChecks([]);
      setMsg("Failed to load attachment checks: " + checkErr.message);
      return;
    }

    setAttachmentChecks((checkRows || []) as AttachmentCheckRow[]);
  }

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

      await checkMfaStatus();
      await loadMfaFactor();

      const { data: myProf, error: myErr } = await supabase
        .from("profiles")
        .select("id,role,signature_url,full_name")
        .eq("id", auth.user.id)
        .single();

      if (myErr) {
        setMsg("Failed to load your profile: " + myErr.message);
        setLoading(false);
        return;
      }

      setMe(myProf as ProfileMini);

      const { data: r, error: rErr } = await supabase
        .from("requests")
        .select(
          "id,request_no,title,details,amount,status,current_stage,current_owner,created_by,dept_id,subhead_id,request_type,personal_category,funds_state,created_at,assigned_account_officer_id,assigned_account_officer_name"
        )
        .eq("id", id)
        .single();

      if (rErr) {
        setMsg("Failed to load request: " + rErr.message);
        setLoading(false);
        return;
      }

      const requestRow = r as Req;
      setReq(requestRow);
      setSelectedOfficerId(requestRow.assigned_account_officer_id || "");

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

      const { data: h, error: hErr } = await supabase
        .from("request_history")
        .select("id,action_type,comment,to_stage,created_at,signature_url,actor_name")
        .eq("request_id", id)
        .order("created_at", { ascending: false });

      if (hErr) {
        setMsg("Failed to load history: " + hErr.message);
      } else {
        setHistory((h || []) as Hist[]);
      }

      const { data: officers, error: officerErr } = await supabase
        .from("profiles")
        .select("id,full_name,email,role")
        .order("full_name", { ascending: true });

      if (!officerErr) {
        const rows = (officers || []) as OfficerMini[];
        setAccountOfficers(
          rows.filter((o) =>
            ["accountofficer", "account", "accounts"].includes(roleKey(o.role || ""))
          )
        );
      }

      await loadAttachmentsAndChecks(id);

      setLoading(false);
    }

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function reload() {
    if (!id) return;

    await checkMfaStatus();
    await loadMfaFactor();

    const { data: r2 } = await supabase
      .from("requests")
      .select(
        "id,request_no,title,details,amount,status,current_stage,current_owner,created_by,dept_id,subhead_id,request_type,personal_category,funds_state,created_at,assigned_account_officer_id,assigned_account_officer_name"
      )
      .eq("id", id)
      .single();

    setReq((r2 as Req) || null);
    setSelectedOfficerId((r2 as any)?.assigned_account_officer_id || "");

    const { data: h2 } = await supabase
      .from("request_history")
      .select("id,action_type,comment,to_stage,created_at,signature_url,actor_name")
      .eq("request_id", id)
      .order("created_at", { ascending: false });

    setHistory((h2 || []) as Hist[]);

    const subId = (r2 as any)?.subhead_id as string | null;
    if (subId) {
      const { data: sh } = await supabase
        .from("subheads")
        .select("id,code,name")
        .eq("id", subId)
        .single();
      setSubhead((sh as any) || null);
    } else {
      setSubhead(null);
    }

    await loadAttachmentsAndChecks(id);
  }

  function goToEdit() {
    if (!req) return;

    if (!canEditRequest) {
      setMsg("❌ You cannot edit this request at its current stage.");
      return;
    }

    router.push(`/requests/${req.id}/edit`);
  }

  async function checkAttachmentPersonally(attachment: AttachmentRow) {
    if (!req || !me) return;

    if (!canCheckAttachments) {
      setMsg("❌ You are not allowed to check attachments on this request.");
      return;
    }

    if (isAttachmentCheckedByMe(attachment.id)) {
      setMsg("✅ You have already checked this attachment.");
      return;
    }

    setCheckingAttachmentId(attachment.id);
    setMsg(null);

    try {
      const { error } = await supabase.from("request_attachment_checks").upsert(
        {
          request_id: req.id,
          attachment_id: attachment.id,
          checked_by: me.id,
          checked_by_name: me.full_name || null,
          checked_by_role: me.role || null,
          check_status: "Checked",
          check_comment: `Checked by ${me.full_name || "officer"}`,
          checked_at: new Date().toISOString(),
        },
        {
          onConflict: "attachment_id,checked_by",
        }
      );

      if (error) throw new Error(error.message);

      await supabase.from("request_history").insert({
        request_id: req.id,
        action_type: "Attachment Checked",
        comment: `${attachment.file_name} was checked by ${me.full_name || "officer"} (${me.role || "Role not set"}).`,
        to_stage: req.current_stage,
        actor_name: me.full_name || null,
        actor_id: me.id,
      });

      setMsg("✅ Attachment checked successfully for your own approval stage.");
      await loadAttachmentsAndChecks(req.id);
    } catch (e: any) {
      setMsg("❌ Attachment check failed: " + (e?.message || "Unknown error"));
    } finally {
      setCheckingAttachmentId(null);
    }
  }

  function validateBeforeSensitiveAction(action: SensitiveAction) {
    if (!req || !me) return false;

    if (!totpFactorId) {
      setMsg("❌ You must set up 2FA before performing this action.");
      router.push("/mfa/setup");
      return false;
    }

    if (action === "Delete") {
      if (!canDeleteRequest) {
        setMsg("❌ Only the requester can delete while the request is still at early Director/HOD stage.");
        return false;
      }

      return true;
    }

    if (!me.signature_url) {
      setMsg("❌ You must upload your signature in Profile before taking actions.");
      return false;
    }

    if (!canAct) {
      setMsg("❌ You cannot act on this request. It is not assigned to you.");
      return false;
    }

    if (hasAttachments && !allAttachmentsCheckedByMe) {
      setMsg(
        `❌ You still have ${myPendingAttachments.length} attachment(s) unchecked. Open and check every attachment personally before you can ${action.toLowerCase()} this request.`
      );
      return false;
    }

    if (action === "Reject" && comment.trim().length < 3) {
      setMsg("❌ Please write a reason/comment for rejection.");
      return false;
    }

    if (action === "Approve" && needsAccountOfficerSelection && !selectedOfficerId) {
      setMsg("❌ Registry must select an Account Officer before sending this request to DG.");
      return false;
    }

    return true;
  }

  function openFresh2faModal(action: SensitiveAction) {
    setMsg(null);

    const ok = validateBeforeSensitiveAction(action);
    if (!ok) return;

    setPendingAction(action);
    setMfaCode("");
    setShowMfaModal(true);
  }

  async function verifyCodeAndContinue() {
    setMsg(null);

    if (!pendingAction) {
      setShowMfaModal(false);
      return;
    }

    if (!totpFactorId) {
      setMsg("❌ No verified 2FA authenticator found. Please set up 2FA again.");
      setShowMfaModal(false);
      router.push("/mfa/setup");
      return;
    }

    const code = mfaCode.trim().replace(/\s+/g, "");

    if (!/^\d{6}$/.test(code)) {
      setMsg("❌ Enter the 6-digit code from your authenticator app.");
      return;
    }

    setVerifyingCode(true);

    try {
      const { error } = await supabase.auth.mfa.challengeAndVerify({
        factorId: totpFactorId,
        code,
      });

      if (error) throw new Error(error.message);

      const actionToRun = pendingAction;

      setShowMfaModal(false);
      setMfaCode("");
      setPendingAction(null);

      if (actionToRun === "Delete") {
        await deleteRequestAfterFresh2fa();
      } else {
        await actAfterFresh2fa(actionToRun);
      }
    } catch (e: any) {
      setMsg("❌ 2FA verification failed: " + (e?.message || "Invalid code."));
    } finally {
      setVerifyingCode(false);
    }
  }

  async function actAfterFresh2fa(action: "Approve" | "Reject") {
    if (!req || !me) return;

    const stillValid = validateBeforeSensitiveAction(action);
    if (!stillValid) return;

    setSaving(true);
    setMsg(null);

    try {
      if (action === "Approve") {
        const { data, error } = await supabase.rpc("approve_request_step", {
          p_request_id: req.id,
          p_action_by: me.id,
          p_comment: comment.trim(),
          p_signature_url: me.signature_url,
          p_assigned_account_officer_id: needsAccountOfficerSelection
            ? selectedOfficerId
            : null,
        });

        if (error) throw new Error(error.message);

        const nextStage = (data as any)?.next_stage;
        const nextStatus = (data as any)?.next_status;

        if (nextStage === "Completed") {
          setMsg(
            nextStatus === "Paid"
              ? "✅ Request paid successfully and closed after your attachment checks and 2FA."
              : "✅ Request completed successfully after your attachment checks and 2FA."
          );
        } else if (isHRFiling) {
          setMsg("✅ HR filing completed successfully after your attachment checks and 2FA.");
        } else if (needsAccountOfficerSelection && nextStage === "DG") {
          setMsg("✅ Account Officer selected. Request sent to DG after your attachment checks and 2FA.");
        } else {
          setMsg(`✅ Approved after your attachment checks and 2FA. Sent to ${nextStage}.`);
        }
      } else {
        const { error } = await supabase.rpc("reject_request_step", {
          p_request_id: req.id,
          p_action_by: me.id,
          p_comment: comment.trim(),
          p_signature_url: me.signature_url,
        });

        if (error) throw new Error(error.message);

        setMsg("✅ Request rejected successfully after your attachment checks and 2FA.");
      }

      setComment("");
      await reload();
    } catch (e: any) {
      setMsg("❌ Action failed: " + (e?.message || "Unknown error"));
    } finally {
      setSaving(false);
    }
  }

  async function deleteRequestAfterFresh2fa() {
    if (!req) return;

    const stillValid = validateBeforeSensitiveAction("Delete");
    if (!stillValid) return;

    const ok = confirm("Delete this request? Any reserved funds will be restored if applicable.");
    if (!ok) return;

    setSaving(true);
    setMsg(null);

    try {
      const { error } = await supabase.rpc("delete_request_restore", {
        p_request_id: req.id,
      });

      if (error) throw new Error(error.message);

      setMsg("✅ Deleted successfully after 2FA verification.");
      setTimeout(() => router.push("/requests"), 700);
    } catch (e: any) {
      setMsg("❌ Delete failed: " + (e?.message || "Unknown error"));
    } finally {
      setSaving(false);
    }
  }

  const approveButtonText = useMemo(() => {
    if (saving || verifyingCode) return "Processing...";
    if (needsAccountOfficerSelection) return "Send to DG";
    if (isHRFiling) return "Complete Filing";
    if ((req?.current_stage || "").toUpperCase() === "ACCOUNT") return "Treat / Pay";
    return "Approve";
  }, [saving, verifyingCode, needsAccountOfficerSelection, isHRFiling, req?.current_stage]);

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
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
              Request Details
            </h1>
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
          </div>
        </div>

        <div
          className={`mt-4 rounded-2xl border px-4 py-3 text-sm font-semibold ${
            mfaVerified
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-amber-200 bg-amber-50 text-amber-900"
          }`}
        >
          {mfaVerified
            ? "✅ 2FA session is active. Fresh 2FA code is still required before approve, reject, or delete."
            : "⚠️ 2FA is required. Fresh 2FA code is required before approve, reject, or delete."}
        </div>

        {hasAttachments && !allAttachmentsCheckedByMe && canAct && (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
            ⚠️ You still have {myPendingAttachments.length} attachment(s) unchecked. You must open
            and check every attachment personally before approving or rejecting.
          </div>
        )}

        {hasAttachments && allAttachmentsCheckedByMe && canAct && (
          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
            ✅ You have personally checked all attachments for your own approval stage.
          </div>
        )}

        {msg && (
          <div className="mt-4 rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-800">
            {msg}
          </div>
        )}

        {!req ? (
          <div className="mt-6 rounded-2xl border bg-white p-6 shadow-sm text-slate-700">
            Request not found.
          </div>
        ) : (
          <>
            <div className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm text-slate-600">Request No</div>
                  <div className="text-lg font-extrabold text-slate-900">
                    {req.request_no}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <StageBadge stage={req.current_stage} />
                  <StatusBadge status={req.status} />
                </div>
              </div>

              <div className="mt-6">
                <RequestProgress stage={req.current_stage} status={req.status} />
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <Info label="Title" value={req.title} />
                <Info
                  label="Amount (₦)"
                  value={
                    isPersonalNonFund
                      ? "Not Applicable"
                      : Number(req.amount || 0).toLocaleString()
                  }
                />
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <Info label="Type" value={requestTypeLabel(req)} />

                <Info
                  label="Subhead"
                  value={
                    isOfficial
                      ? subhead
                        ? `${subhead.code ? `${subhead.code} — ` : ""}${subhead.name}`
                        : "—"
                      : "Not Applicable"
                  }
                />
              </div>

              {req.assigned_account_officer_name && (
                <div className="mt-4">
                  <Info
                    label="Selected Account Officer"
                    value={req.assigned_account_officer_name}
                  />
                </div>
              )}

              <div className="mt-5">
                <div className="text-xs font-semibold text-slate-500">Details</div>
                <div className="mt-2 whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-800">
                  {req.details}
                </div>
              </div>

              {(canEditRequest || canDeleteRequest) && (
                <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                  {canEditRequest && (
                    <button
                      onClick={goToEdit}
                      disabled={saving || verifyingCode}
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-100 disabled:opacity-60"
                    >
                      Edit
                    </button>
                  )}

                  {canDeleteRequest && (
                    <button
                      onClick={() => openFresh2faModal("Delete")}
                      disabled={saving || verifyingCode}
                      className="w-full rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                    >
                      {saving || verifyingCode ? "Working..." : "Delete"}
                    </button>
                  )}
                </div>
              )}

              {!canEditRequest && !canDeleteRequest && isMyRequest && (
                <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                  Edit/Delete is locked once the request leaves the allowed early stage.
                </div>
              )}
            </div>

            <div className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Supporting Attachments</h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Every approving officer must personally open and check all attachments before
                    approving or rejecting. One officer’s check does not count for another officer.
                  </p>
                </div>

                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold text-slate-700">
                  {attachments.length} file(s)
                </span>
              </div>

              {attachments.length === 0 ? (
                <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                  No attachment was uploaded for this request.
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  {attachments.map((a, index) => {
                    const checkedByMe = isAttachmentCheckedByMe(a.id);
                    const totalChecks = attachmentCheckCount(a.id);

                    return (
                      <div key={a.id} className="rounded-2xl border bg-white p-4 shadow-sm">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-sm font-extrabold text-slate-900">
                              {index + 1}. {a.file_name}
                            </div>
                            <div className="mt-1 text-xs font-semibold text-slate-500">
                              {a.file_type || "Unknown type"} • {fileSizeLabel(a.file_size)}
                            </div>
                            <div className="mt-1 text-xs font-semibold text-slate-500">
                              Total officer checks: {totalChecks}
                            </div>
                          </div>

                          <div className="flex flex-col items-end gap-2">
                            <span
                              className={`rounded-full border px-3 py-1 text-xs font-bold ${attachmentStatusClass(
                                a.verification_status
                              )}`}
                            >
                              {attachmentStatusLabel(a.verification_status)}
                            </span>

                            <span
                              className={`rounded-full border px-3 py-1 text-xs font-bold ${
                                checkedByMe
                                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                  : "border-amber-200 bg-amber-50 text-amber-800"
                              }`}
                            >
                              {checkedByMe ? "Checked By You ✅" : "Not Checked By You"}
                            </span>
                          </div>
                        </div>

                        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                          {a.signed_url ? (
                            <a
                              href={a.signed_url}
                              target="_blank"
                              rel="noreferrer"
                              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-center text-sm font-bold text-slate-900 hover:bg-slate-100 sm:w-auto"
                            >
                              Open Attachment
                            </a>
                          ) : (
                            <button
                              type="button"
                              disabled
                              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-400 sm:w-auto"
                            >
                              File Link Unavailable
                            </button>
                          )}

                          {canCheckAttachments && !checkedByMe && (
                            <button
                              type="button"
                              onClick={() => checkAttachmentPersonally(a)}
                              disabled={checkingAttachmentId === a.id}
                              className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60 sm:w-auto"
                            >
                              {checkingAttachmentId === a.id
                                ? "Checking..."
                                : "I Have Checked This ✅"}
                            </button>
                          )}

                          {canCheckAttachments && checkedByMe && (
                            <button
                              type="button"
                              disabled
                              className="w-full rounded-xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700 sm:w-auto"
                            >
                              Checked By You ✅
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
              <h2 className="text-lg font-bold text-slate-900">Actions</h2>
              <p className="mt-1 text-sm text-slate-600">
                Only the assigned officer can approve/reject. All actions require signature,
                your own attachment checks, and a fresh 2FA code.
              </p>

              {!canAct ? (
                <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                  View only.
                </div>
              ) : (
                <>
                  {hasAttachments && !allAttachmentsCheckedByMe && (
                    <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                      Approval/Rejection is locked until you personally check every attachment above.
                    </div>
                  )}

                  {needsAccountOfficerSelection && (
                    <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4">
                      <label className="text-sm font-semibold text-slate-800">
                        Registry: Select Account Officer before sending to DG
                      </label>
                      <select
                        value={selectedOfficerId}
                        onChange={(e) => setSelectedOfficerId(e.target.value)}
                        className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
                      >
                        <option value="">-- Select Account Officer --</option>
                        {accountOfficers.map((o) => (
                          <option key={o.id} value={o.id}>
                            {officerLabel(o)}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {isHRFiling && (
                    <div className="mt-4 rounded-xl border border-purple-200 bg-purple-50 p-4 text-sm text-purple-900">
                      HR Filing stage: review the approved Personal NonFund request and complete it
                      for filing.
                    </div>
                  )}

                  <div className="mt-4">
                    <label className="text-sm font-semibold text-slate-800">
                      Comment{" "}
                      {needsAccountOfficerSelection || isHRFiling
                        ? "(optional, but recommended)"
                        : "(required for Reject)"}
                    </label>
                    <textarea
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      className="mt-1 min-h-[90px] w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
                      placeholder="Write your comment..."
                    />
                  </div>

                  <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                    <button
                      onClick={() => openFresh2faModal("Approve")}
                      disabled={saving || verifyingCode || (hasAttachments && !allAttachmentsCheckedByMe)}
                      className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60"
                    >
                      {approveButtonText}
                    </button>

                    <button
                      onClick={() => openFresh2faModal("Reject")}
                      disabled={saving || verifyingCode || (hasAttachments && !allAttachmentsCheckedByMe)}
                      className="w-full rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-red-700 disabled:opacity-60"
                    >
                      {saving || verifyingCode ? "Processing..." : "Reject"}
                    </button>
                  </div>
                </>
              )}
            </div>

            <div className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
              <h2 className="text-lg font-bold text-slate-900">History</h2>
              <p className="mt-1 text-sm text-slate-600">
                All actions, comments, signatures and individual attachment checks are recorded.
              </p>

              {history.length === 0 ? (
                <div className="mt-4 text-sm text-slate-700">No history yet.</div>
              ) : (
                <div className="mt-4 space-y-3">
                  {history.map((h) => (
                    <div key={h.id} className="rounded-xl border border-slate-200 bg-white p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-sm font-bold text-slate-900">
                          {h.actor_name || "Officer"} • {h.action_type}
                        </div>
                        {h.to_stage && <StageBadge stage={h.to_stage} />}
                      </div>

                      {h.comment && (
                        <div className="mt-2 whitespace-pre-wrap text-sm text-slate-800">
                          {h.comment}
                        </div>
                      )}

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

      {showMfaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <div className="text-xs font-black uppercase tracking-wide text-blue-700">
              Required Security Verification
            </div>

            <h2 className="mt-1 text-2xl font-extrabold text-slate-900">
              Enter 2FA Code
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-600">
              Enter the 6-digit code from your authenticator app. This action will not continue
              until the code is verified.
            </p>

            <input
              value={mfaCode}
              onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              autoFocus
              placeholder="123456"
              className="mt-5 w-full rounded-2xl border border-slate-200 px-4 py-4 text-center text-2xl font-black tracking-[0.35em] text-slate-900 outline-none focus:border-blue-500"
            />

            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => {
                  if (verifyingCode || saving) return;
                  setShowMfaModal(false);
                  setMfaCode("");
                  setPendingAction(null);
                }}
                disabled={verifyingCode || saving}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 hover:bg-slate-100 disabled:opacity-60"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={verifyCodeAndContinue}
                disabled={verifyingCode || saving || mfaCode.trim().length !== 6}
                className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {verifyingCode || saving ? "Verifying..." : "Verify & Continue"}
              </button>
            </div>
          </div>
        </div>
      )}
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
      : s.includes("approve") ||
        s.includes("review") ||
        s.includes("complete") ||
        s.includes("paid") ||
        s.includes("filing")
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