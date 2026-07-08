"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { RequestProgress } from "../../components/RequestProgress";

type PersonalCategory =
  | "Fund"
  | "Leave"
  | "Contract Renewal"
  | "Resignation"
  | "Others"
  | "NonFund"
  | null;

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
  personal_category: PersonalCategory;
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
  actor_role_key: string | null;
  actor_role_name: string | null;
};

type SubheadMini = {
  id: string;
  code: string | null;
  name: string;
};

type AssignableSubhead = {
  id: string;
  dept_id: string;
  code: string | null;
  name: string;
  approved_allocation: number | null;
  reserved_amount: number | null;
  expenditure: number | null;
  balance: number | null;
  is_active: boolean | null;
};

type ProfileMini = {
  id: string;
  role: string;
  signature_url: string | null;
  full_name?: string | null;
};

type ProfileRole = {
  id: string;
  profile_id: string;
  role_key: string;
  role_name: string;
  is_primary: boolean;
  is_active: boolean;
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

function categoryKey(category: string | null | undefined) {
  return (category || "").trim().toUpperCase().replace(/\s+/g, "");
}

function officerLabel(o: OfficerMini) {
  return o.full_name?.trim() || o.email?.trim() || o.id;
}

function requestTypeLabel(req: Req) {
  if (req.request_type === "Official") return "Official";

  const category = req.personal_category || "Others";
  if (category === "NonFund") return "Personal • Non-Fund";

  return `Personal • ${category}`;
}

function fileSizeLabel(bytes: number | null | undefined) {
  const n = Number(bytes || 0);

  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(2)} MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${n} B`;
}

function formatNaira(value: number | null | undefined) {
  return "₦" + Math.round(Number(value || 0)).toLocaleString();
}

function availableBalanceForSubhead(subhead: AssignableSubhead | null) {
  if (!subhead) return 0;

  return (
    Number(subhead.approved_allocation || 0) -
    Number(subhead.reserved_amount || 0) -
    Number(subhead.expenditure || 0)
  );
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

function stageBadgeClass(stage: string | null | undefined) {
  const s = stageKey(stage);

  if (["COMPLETED", "PAID"].includes(s)) return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (["REJECTED", "DELETED", "CANCELLED"].includes(s)) return "border-red-200 bg-red-50 text-red-700";
  if (s === "ACCOUNT") return "border-purple-200 bg-purple-50 text-purple-700";
  if (s === "DG") return "border-amber-200 bg-amber-50 text-amber-800";
  if (s === "HR" || s === "HRFILING") return "border-pink-200 bg-pink-50 text-pink-700";
  if (s === "DINADMIN") return "border-blue-200 bg-blue-50 text-blue-700";

  if (["DOD", "HOD", "REGISTRAR", "PO"].includes(s)) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  return "border-slate-200 bg-white text-slate-700";
}

function stageHelpText(req: Req | null) {
  if (!req) return "";

  const stage = stageKey(req.current_stage);
  const reqType = String(req.request_type || "").toUpperCase();
  const cat = categoryKey(req.personal_category);

  if (reqType === "OFFICIAL") {
    if (stage === "PO") return "Official ASAP-ALLI request is awaiting Programme Officer review.";
    if (stage === "DOD") return "Official request is awaiting Director of Department review.";
    if (stage === "DINADMIN") return "DIN Official request is awaiting DIN Admin review before Registrar.";
    if (stage === "REGISTRAR") return "DIN Official request is awaiting Registrar review as HOD of all DIN Departments.";
    if (stage === "HOD") return "Official request is awaiting HOD review. Subhead must be assigned before it can move to DG.";
    if (stage === "DG") return "Official request is awaiting DG approval and AccountOfficer designation.";
    if (stage === "ACCOUNT") return "Official request is awaiting AccountOfficer treatment/payment.";
    if (stage === "COMPLETED") return "Official request is completed.";
  }

  if (reqType === "PERSONAL") {
    if (stage === "DOD") return "Personal request is awaiting Director of Department review.";
    if (stage === "HOD") return "Personal ASAP-ALLI request is awaiting HOD review before HR.";
    if (stage === "HR") return "Personal request is awaiting HR review.";

    if (stage === "DG") {
      if (cat === "FUND") return "Personal Fund request is awaiting DG approval and AccountOfficer designation.";
      return "Personal request is awaiting DG approval before HR Filing.";
    }

    if (stage === "ACCOUNT") return "Personal Fund request is awaiting AccountOfficer payment before HR Filing.";
    if (stage === "HRFILING") return "Personal request is awaiting final HR Filing.";
    if (stage === "COMPLETED") return "Personal request is completed and filed.";
  }

  return "Request is awaiting the assigned officer.";
}

function roleDisplay(h: Hist) {
  if (h.actor_role_name) return `as ${h.actor_role_name}`;
  if (h.actor_role_key) return `as ${h.actor_role_key}`;
  return "";
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
  const [assigningSubhead, setAssigningSubhead] = useState(false);

  const [msg, setMsg] = useState<string | null>(null);
  const [req, setReq] = useState<Req | null>(null);
  const [history, setHistory] = useState<Hist[]>([]);
  const [subhead, setSubhead] = useState<SubheadMini | null>(null);
  const [assignableSubheads, setAssignableSubheads] = useState<AssignableSubhead[]>([]);
  const [selectedSubheadId, setSelectedSubheadId] = useState("");
  const [attachments, setAttachments] = useState<AttachmentRow[]>([]);
  const [attachmentChecks, setAttachmentChecks] = useState<AttachmentCheckRow[]>([]);

  const [me, setMe] = useState<ProfileMini | null>(null);
  const [myRoles, setMyRoles] = useState<ProfileRole[]>([]);
  const [comment, setComment] = useState("");

  const [accountOfficers, setAccountOfficers] = useState<OfficerMini[]>([]);
  const [selectedOfficerId, setSelectedOfficerId] = useState("");

  const [mfaVerified, setMfaVerified] = useState(false);
  const [totpFactorId, setTotpFactorId] = useState<string | null>(null);
  const [showMfaModal, setShowMfaModal] = useState(false);
  const [mfaCode, setMfaCode] = useState("");
  const [pendingAction, setPendingAction] = useState<SensitiveAction | null>(null);

  const mfaAutoSubmittingRef = useRef(false);

  const activeRoleKeys = useMemo(() => {
    const keys = new Set<string>();

    if (me?.role) keys.add(roleKey(me.role));

    myRoles.forEach((r) => {
      if (r.is_active) keys.add(roleKey(r.role_key));
    });

    return keys;
  }, [me?.role, myRoles]);

  const stg = stageKey(req?.current_stage);

  const isMyRequest = useMemo(() => {
    return !!req && !!me && req.created_by === me.id;
  }, [req, me]);

  const isOfficial = useMemo(() => {
    return (req?.request_type || "").trim().toUpperCase() === "OFFICIAL";
  }, [req?.request_type]);

  const isPersonal = useMemo(() => {
    return (req?.request_type || "").trim().toUpperCase() === "PERSONAL";
  }, [req?.request_type]);

  const isPersonalFund = useMemo(() => {
    return isPersonal && categoryKey(req?.personal_category) === "FUND";
  }, [isPersonal, req?.personal_category]);

  const isPersonalNonFund = useMemo(() => {
    return isPersonal && !isPersonalFund;
  }, [isPersonal, isPersonalFund]);

  const isHRFiling = useMemo(() => {
    return stageKey(req?.current_stage) === "HRFILING";
  }, [req?.current_stage]);

  const isAccountStage = useMemo(() => {
    return stageKey(req?.current_stage) === "ACCOUNT";
  }, [req?.current_stage]);

  const isDgStage = useMemo(() => {
    return stageKey(req?.current_stage) === "DG";
  }, [req?.current_stage]);

  const requesterCanEditDeleteEarly = useMemo(() => {
    if (!req || !me) return false;

    return (
      req.created_by === me.id &&
      ["PO", "DOD", "DIRECTOR", "DINADMIN", "REGISTRAR", "HOD", "HR"].includes(stg)
    );
  }, [req, me, stg]);

  const assignedWorkflowOfficerCanEdit = useMemo(() => {
    if (!req || !me) return false;

    const editableRoles = [
      "po",
      "dod",
      "director",
      "dinadmin",
      "dinadmin1",
      "dinadmin2",
      "dinadmin3",
      "registrar",
      "hod",
      "hr",
      "hrofficer1",
      "hrofficer2",
      "hrofficer3",
    ];

    const hasEditableRole = editableRoles.some((r) => activeRoleKeys.has(r));

    return hasEditableRole && req.current_owner === me.id;
  }, [req, me, activeRoleKeys]);

  const canEditRequest = useMemo(() => {
    return requesterCanEditDeleteEarly || assignedWorkflowOfficerCanEdit;
  }, [requesterCanEditDeleteEarly, assignedWorkflowOfficerCanEdit]);

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

    const allowed = [
      "admin",
      "auditor",
      "po",
      "dod",
      "director",
      "dinadmin",
      "dinadmin1",
      "dinadmin2",
      "dinadmin3",
      "registrar",
      "hod",
      "hr",
      "hrofficer1",
      "hrofficer2",
      "hrofficer3",
      "dg",
      "account",
      "accounts",
      "accountofficer",
    ];

    return allowed.some((r) => activeRoleKeys.has(r));
  }, [req, me, activeRoleKeys]);

  const needsSubheadAssignment = useMemo(() => {
    if (!req) return false;

    return (
      isOfficial &&
      !req.subhead_id &&
      ["HOD", "REGISTRAR"].includes(stg) &&
      !["Approved", "Rejected", "Cancelled", "Deleted", "Paid", "Closed", "Completed"].includes(
        req.status || ""
      )
    );
  }, [req, isOfficial, stg]);

  const canAssignSubhead = useMemo(() => {
    if (!req || !me) return false;

    const roleAllowed =
      activeRoleKeys.has("hod") ||
      activeRoleKeys.has("registrar") ||
      activeRoleKeys.has("admin") ||
      activeRoleKeys.has("auditor");

    const isAssignedOfficer = req.current_owner === me.id;
    const isAdminAuditor = activeRoleKeys.has("admin") || activeRoleKeys.has("auditor");

    return needsSubheadAssignment && roleAllowed && (isAssignedOfficer || isAdminAuditor);
  }, [req, me, activeRoleKeys, needsSubheadAssignment]);

  const selectedAssignableSubhead = useMemo(() => {
    return assignableSubheads.find((s) => s.id === selectedSubheadId) || null;
  }, [assignableSubheads, selectedSubheadId]);

  const selectedSubheadAvailableBalance = useMemo(() => {
    return availableBalanceForSubhead(selectedAssignableSubhead);
  }, [selectedAssignableSubhead]);

  const selectedSubheadCanCoverAmount = useMemo(() => {
    if (!req || !selectedAssignableSubhead) return false;
    return Number(req.amount || 0) <= selectedSubheadAvailableBalance;
  }, [req, selectedAssignableSubhead, selectedSubheadAvailableBalance]);

  const needsAccountOfficerSelection = useMemo(() => {
    if (!req || !canAct) return false;
    return isDgStage && (isOfficial || isPersonalFund);
  }, [req, canAct, isDgStage, isOfficial, isPersonalFund]);

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

  async function loadAssignableSubheads(deptId: string) {
    const { data, error } = await supabase
      .from("subheads")
      .select(
        "id,dept_id,code,name,approved_allocation,reserved_amount,expenditure,balance,is_active"
      )
      .eq("dept_id", deptId)
      .eq("is_active", true)
      .order("name", { ascending: true });

    if (error) {
      setAssignableSubheads([]);
      return;
    }

    const rows = (data || []) as AssignableSubhead[];
    setAssignableSubheads(rows);

    if (rows.length > 0) {
      setSelectedSubheadId((current) => current || rows[0].id);
    }
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

  async function loadMyRoles(userId: string) {
    const { data } = await supabase
      .from("profile_roles")
      .select("id,profile_id,role_key,role_name,is_primary,is_active")
      .eq("profile_id", userId)
      .eq("is_active", true);

    setMyRoles((data || []) as ProfileRole[]);
  }

  async function loadAccountOfficers() {
    const [{ data: profileRows }, { data: roleRows }] = await Promise.all([
      supabase
        .from("profiles")
        .select("id,full_name,email,role")
        .order("full_name", { ascending: true }),

      supabase
        .from("profile_roles")
        .select("profile_id,role_key")
        .eq("is_active", true)
        .in("role_key", ["accountofficer", "account", "accounts"]),
    ]);

    const profiles = (profileRows || []) as OfficerMini[];
    const roleOwnerIds = new Set((roleRows || []).map((r: any) => r.profile_id));

    setAccountOfficers(
      profiles.filter((o) => {
        return (
          ["accountofficer", "account", "accounts"].includes(roleKey(o.role || "")) ||
          roleOwnerIds.has(o.id)
        );
      })
    );
  }

  async function loadRequestPage() {
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
    await loadMyRoles(auth.user.id);

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

    if ((r as Req).dept_id) {
      await loadAssignableSubheads((r as Req).dept_id);
    }

    const { data: h, error: hErr } = await supabase
      .from("request_history")
      .select(
        "id,action_type,comment,to_stage,created_at,signature_url,actor_name,actor_role_key,actor_role_name"
      )
      .eq("request_id", id)
      .order("created_at", { ascending: false });

    if (hErr) {
      setMsg("Failed to load history: " + hErr.message);
    } else {
      setHistory((h || []) as Hist[]);
    }

    await loadAccountOfficers();
    await loadAttachmentsAndChecks(id);

    setLoading(false);
  }

  useEffect(() => {
    loadRequestPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function reload() {
    if (!id) return;

    await checkMfaStatus();
    await loadMfaFactor();

    if (me?.id) {
      await loadMyRoles(me.id);
    }

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
      .select(
        "id,action_type,comment,to_stage,created_at,signature_url,actor_name,actor_role_key,actor_role_name"
      )
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

    if ((r2 as any)?.dept_id) {
      await loadAssignableSubheads((r2 as any).dept_id);
    }

    await loadAccountOfficers();
    await loadAttachmentsAndChecks(id);
    router.refresh();
  }

  function goToEdit() {
    if (!req) return;

    if (!canEditRequest) {
      setMsg("❌ You cannot edit this request at its current stage.");
      return;
    }

    router.push(`/requests/${req.id}/edit`);
  }

  async function sendRequestApprovalNotification(requestId: string) {
    if (process.env.NEXT_PUBLIC_REQGEN_NOTIFICATIONS_ENABLED !== "true") return;

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) return;

      await fetch("/api/notifications/sms/request-approval", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ requestId }),
      });
    } catch (notifyErr) {
      console.warn("Approval notification failed:", notifyErr);
    }
  }

  async function assignSubheadAndReserve() {
    if (!req || !me) return;

    if (!canAssignSubhead) {
      setMsg("❌ You are not allowed to assign a subhead for this request.");
      return;
    }

    if (!selectedSubheadId) {
      setMsg("❌ Please select a subhead before assigning.");
      return;
    }

    if (!selectedAssignableSubhead) {
      setMsg("❌ Selected subhead could not be found.");
      return;
    }

    if (!selectedSubheadCanCoverAmount) {
      setMsg(
        `❌ Insufficient balance. Available balance is ${formatNaira(
          selectedSubheadAvailableBalance
        )}, but request amount is ${formatNaira(req.amount)}.`
      );
      return;
    }

    const ok = confirm(
      `Assign "${selectedAssignableSubhead.code ? `${selectedAssignableSubhead.code} — ` : ""
      }${selectedAssignableSubhead.name}" and reserve ${formatNaira(req.amount)} for this request?`
    );

    if (!ok) return;

    setAssigningSubhead(true);
    setMsg(null);

    try {
      const { data, error } = await supabase.rpc("assign_request_subhead_and_reserve", {
        p_request_id: req.id,
        p_subhead_id: selectedSubheadId,
        p_actor_id: me.id,
      });

      if (error) throw new Error(error.message);

      setMsg(`✅ ${(data as any)?.message || "Subhead assigned and funds reserved successfully."}`);

      await reload();
    } catch (e: any) {
      setMsg("❌ Subhead assignment failed: " + (e?.message || "Unknown error"));
    } finally {
      setAssigningSubhead(false);
    }
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
        comment: `${attachment.file_name} was checked by ${me.full_name || "officer"} (${me.role || "Role not set"
          }).`,
        to_stage: req.current_stage,
        actor_name: me.full_name || null,
        actor_role_key: me.role ? roleKey(me.role) : null,
        actor_role_name: me.role || null,
        action_by: me.id,
      });

      setMsg("✅ Attachment checked successfully for your own approval stage.");
      await loadAttachmentsAndChecks(req.id);
      router.refresh();
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
        setMsg("❌ Only the requester can delete while the request is still at an allowed early stage.");
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

    if (action === "Approve" && needsSubheadAssignment) {
      setMsg(
        "❌ This official request has no subhead yet. Assign a subhead and reserve funds before approving."
      );
      return false;
    }

    if (hasAttachments && !allAttachmentsCheckedByMe) {
      setMsg(
        `❌ You still have ${myPendingAttachments.length
        } attachment(s) unchecked. Open and check every attachment personally before you can ${action.toLowerCase()} this request.`
      );
      return false;
    }

    if (action === "Reject" && comment.trim().length < 3) {
      setMsg("❌ Please write a reason/comment for rejection.");
      return false;
    }

    if (action === "Approve" && needsAccountOfficerSelection && !selectedOfficerId) {
      setMsg("❌ DG must select an AccountOfficer before approving this request.");
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
    mfaAutoSubmittingRef.current = false;
  }

  async function verifyCodeAndContinue(codeOverride?: string) {
    if (mfaAutoSubmittingRef.current || verifyingCode || saving) return;

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

    const code = String(codeOverride || mfaCode || "")
      .trim()
      .replace(/\D/g, "")
      .slice(0, 6);

    if (!/^\d{6}$/.test(code)) {
      setMsg("❌ Enter the 6-digit code from your authenticator app.");
      return;
    }

    mfaAutoSubmittingRef.current = true;
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
      setMfaCode("");
    } finally {
      setVerifyingCode(false);

      setTimeout(() => {
        mfaAutoSubmittingRef.current = false;
      }, 800);
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
          p_actor_id: me.id,
          p_comment: comment.trim(),
          p_signature_url: me.signature_url,
          p_assigned_account_officer_id: needsAccountOfficerSelection ? selectedOfficerId : null,
        });

        if (error) throw new Error(error.message);

        const result = Array.isArray(data) ? data[0] : data;
        const nextStage = (result as any)?.new_stage;
        const nextStatus = (result as any)?.new_status;

        await sendRequestApprovalNotification(req.id);

        if (nextStage === "Completed") {
          setMsg(
            nextStatus === "Paid"
              ? "✅ Request paid successfully and closed after your attachment checks and 2FA."
              : "✅ Request completed successfully after your attachment checks and 2FA."
          );
        } else if (isHRFiling) {
          setMsg("✅ HR Filing completed successfully after your attachment checks and 2FA.");
        } else if (isAccountStage && nextStage === "HR Filing") {
          setMsg("✅ Payment treated. Request sent back to HR for final filing.");
        } else if (needsAccountOfficerSelection && nextStage === "Account") {
          setMsg("✅ AccountOfficer selected. Request sent for treatment/payment.");
        } else {
          setMsg(`✅ Approved after your attachment checks and 2FA. Sent to ${nextStage || "next stage"}.`);
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

      await reload();

      setTimeout(() => {
        router.push(`/requests?updated=${Date.now()}`);
        router.refresh();
      }, 500);
    } catch (e: any) {
      setMsg("❌ Delete failed: " + (e?.message || "Unknown error"));
    } finally {
      setSaving(false);
    }
  }

  const approveButtonText = useMemo(() => {
    if (saving || verifyingCode) return "Processing...";
    if (needsSubheadAssignment) return "Assign Subhead First";
    if (needsAccountOfficerSelection) return "Approve & Send to AccountOfficer";
    if (isHRFiling) return "Complete HR Filing";
    if (isAccountStage && isPersonalFund) return "Treat / Pay & Send to HR Filing";
    if (isAccountStage) return "Treat / Pay";
    if (stg === "DOD") return "Approve as DOD";
    if (stg === "PO") return "Approve as PO";
    if (stg === "REGISTRAR") return "Approve as Registrar";
    if (stg === "DINADMIN") return "Approve as DIN Admin";
    return "Approve";
  }, [
    saving,
    verifyingCode,
    needsSubheadAssignment,
    needsAccountOfficerSelection,
    isHRFiling,
    isAccountStage,
    isPersonalFund,
    stg,
  ]);

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
            {req && <p className="mt-1 text-xs font-semibold text-slate-500">{stageHelpText(req)}</p>}
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
          className={`mt-4 rounded-2xl border px-4 py-3 text-sm font-semibold ${mfaVerified
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-amber-200 bg-amber-50 text-amber-900"
            }`}
        >
          {mfaVerified
            ? "✅ 2FA session is active. Fresh 2FA code is still required before approve, reject, or delete."
            : "⚠️ 2FA is required. Fresh 2FA code is required before approve, reject, or delete."}
        </div>

        {isOfficial && ["PO", "DOD", "DINADMIN", "REGISTRAR", "HOD"].includes(stg) && (
          <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-900">
            Official routing is active. This request will continue through the configured department chain until DG and AccountOfficer.
          </div>
        )}

        {isPersonal && (
          <div className="mt-4 rounded-2xl border border-purple-200 bg-purple-50 px-4 py-3 text-sm font-semibold text-purple-900">
            Personal request workflow is active.
            {isPersonalFund
              ? " This Personal Fund request moves through HR/DG/AccountOfficer and returns to HR Filing."
              : " This Personal request moves through HR/DG and then HR Filing."}
          </div>
        )}

        {needsSubheadAssignment && (
          <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-900">
            ⚠️ This Official request has no subhead yet. The assigned budget authority must assign a subhead and reserve funds before approval can continue.
          </div>
        )}

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
          <div className="mt-6 rounded-2xl border bg-white p-6 text-slate-700 shadow-sm">
            Request not found.
          </div>
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

              <div className="mt-6">
                <RequestProgress
                  stage={req.current_stage}
                  status={req.status}
                  requestType={req.request_type}
                  personalCategory={req.personal_category}
                />
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <Info label="Title" value={req.title} />
                <Info
                  label="Amount (₦)"
                  value={isPersonalNonFund ? "Not Applicable" : Number(req.amount || 0).toLocaleString()}
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
                        : "Pending Assignment"
                      : "Not Applicable"
                  }
                />
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <Info label="Funds State" value={req.funds_state || "—"} />
                <Info label="Request Date" value={new Date(req.created_at).toLocaleString()} />
              </div>

              {req.assigned_account_officer_name && (
                <div className="mt-4">
                  <Info label="Selected AccountOfficer" value={req.assigned_account_officer_name} />
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
                      disabled={saving || verifyingCode || assigningSubhead}
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-100 disabled:opacity-60"
                    >
                      Edit
                    </button>
                  )}

                  {canDeleteRequest && (
                    <button
                      onClick={() => openFresh2faModal("Delete")}
                      disabled={saving || verifyingCode || assigningSubhead}
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

            {needsSubheadAssignment && (
              <div className="mt-6 rounded-2xl border border-blue-200 bg-white p-6 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-extrabold text-slate-900">
                      Budget Subhead Assignment
                    </h2>
                    <p className="mt-1 text-sm text-slate-600">
                      This Official request has no budget line yet. Select the correct subhead and
                      reserve funds before approving.
                    </p>
                  </div>

                  <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-black text-blue-800">
                    Required Before Approval
                  </span>
                </div>

                {!canAssignSubhead ? (
                  <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                    View only. Only the assigned budget authority, Admin, or Auditor can assign the
                    subhead at this stage.
                  </div>
                ) : (
                  <>
                    <div className="mt-4">
                      <label className="text-sm font-semibold text-slate-800">
                        Select Subhead / Budget Line
                      </label>
                      <select
                        value={selectedSubheadId}
                        onChange={(e) => setSelectedSubheadId(e.target.value)}
                        className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-slate-900 outline-none focus:border-blue-500"
                      >
                        <option value="">-- Select Subhead --</option>
                        {assignableSubheads.map((s) => (
                          <option key={s.id} value={s.id}>
                            {(s.code ? `${s.code} — ` : "") + s.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {selectedAssignableSubhead && (
                      <div className="mt-4 grid gap-3 sm:grid-cols-4">
                        <FinanceBox label="Allocation" value={formatNaira(selectedAssignableSubhead.approved_allocation)} />
                        <FinanceBox label="Reserved" value={formatNaira(selectedAssignableSubhead.reserved_amount)} tone="amber" />
                        <FinanceBox label="Expenditure" value={formatNaira(selectedAssignableSubhead.expenditure)} tone="red" />
                        <FinanceBox
                          label="Available"
                          value={formatNaira(selectedSubheadAvailableBalance)}
                          tone={selectedSubheadCanCoverAmount ? "emerald" : "red"}
                        />
                      </div>
                    )}

                    {selectedAssignableSubhead && !selectedSubheadCanCoverAmount && (
                      <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">
                        ❌ This subhead cannot cover the request amount. Available:{" "}
                        {formatNaira(selectedSubheadAvailableBalance)}. Required:{" "}
                        {formatNaira(req.amount)}.
                      </div>
                    )}

                    {selectedAssignableSubhead && selectedSubheadCanCoverAmount && (
                      <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
                        ✅ This subhead can cover the request amount of {formatNaira(req.amount)}.
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={assignSubheadAndReserve}
                      disabled={
                        assigningSubhead ||
                        saving ||
                        verifyingCode ||
                        !selectedSubheadId ||
                        !selectedSubheadCanCoverAmount
                      }
                      className="mt-4 w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-black text-white hover:bg-blue-700 disabled:opacity-60"
                    >
                      {assigningSubhead ? "Assigning & Reserving..." : "Assign Subhead & Reserve Funds"}
                    </button>
                  </>
                )}
              </div>
            )}

            <div className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Supporting Attachments</h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Every approving officer must personally open and check all attachments before
                    approving or rejecting.
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
                              className={`rounded-full border px-3 py-1 text-xs font-bold ${checkedByMe
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
                              {checkingAttachmentId === a.id ? "Checking..." : "I Have Checked This ✅"}
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
                Only the assigned officer can approve/reject. All actions require signature, your
                own attachment checks, and a fresh 2FA code.
              </p>

              {!canAct ? (
                <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                  View only.
                </div>
              ) : (
                <>
                  {needsSubheadAssignment && (
                    <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm font-semibold text-blue-900">
                      Approval is locked until a subhead is assigned and funds are reserved.
                    </div>
                  )}

                  {hasAttachments && !allAttachmentsCheckedByMe && (
                    <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                      Approval/Rejection is locked until you personally check every attachment above.
                    </div>
                  )}

                  {needsAccountOfficerSelection && (
                    <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4">
                      <label className="text-sm font-semibold text-slate-800">
                        DG: Select AccountOfficer
                      </label>
                      <select
                        value={selectedOfficerId}
                        onChange={(e) => setSelectedOfficerId(e.target.value)}
                        className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
                      >
                        <option value="">-- Select AccountOfficer --</option>
                        {accountOfficers.map((o) => (
                          <option key={o.id} value={o.id}>
                            {officerLabel(o)}
                          </option>
                        ))}
                      </select>
                      <p className="mt-2 text-xs font-semibold text-blue-900">
                        Required for Official requests and Personal Fund requests before moving to AccountOfficer.
                      </p>
                    </div>
                  )}

                  {isHRFiling && (
                    <div className="mt-4 rounded-xl border border-purple-200 bg-purple-50 p-4 text-sm text-purple-900">
                      HR Filing stage: review the treated/approved Personal request and complete it for filing.
                    </div>
                  )}

                  {isAccountStage && isPersonalFund && (
                    <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                      Personal Fund payment stage: after treatment/payment, the request will return to HR for final filing.
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
                      disabled={
                        saving ||
                        verifyingCode ||
                        assigningSubhead ||
                        needsSubheadAssignment ||
                        (hasAttachments && !allAttachmentsCheckedByMe)
                      }
                      className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60"
                    >
                      {approveButtonText}
                    </button>

                    <button
                      onClick={() => openFresh2faModal("Reject")}
                      disabled={
                        saving ||
                        verifyingCode ||
                        assigningSubhead ||
                        (hasAttachments && !allAttachmentsCheckedByMe)
                      }
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
                All actions, comments, signatures, exact role used and individual attachment checks are recorded.
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
                          {roleDisplay(h) && (
                            <span className="ml-2 rounded-full border border-blue-200 bg-blue-50 px-2 py-1 text-[11px] font-black text-blue-700">
                              {roleDisplay(h)}
                            </span>
                          )}
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

            <h2 className="mt-1 text-2xl font-extrabold text-slate-900">Enter 2FA Code</h2>

            <p className="mt-2 text-sm leading-6 text-slate-600">
              Enter the 6-digit code from your authenticator app. The action will continue
              automatically after the 6th digit is entered.
            </p>

            <input
              value={mfaCode}
              onChange={(e) => {
                const nextCode = e.target.value.replace(/\D/g, "").slice(0, 6);
                setMfaCode(nextCode);

                if (nextCode.length === 6 && !verifyingCode && !saving) {
                  setTimeout(() => {
                    verifyCodeAndContinue(nextCode);
                  }, 150);
                }
              }}
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              disabled={verifyingCode || saving}
              placeholder="123456"
              className="mt-5 w-full rounded-2xl border border-slate-200 px-4 py-4 text-center text-2xl font-black tracking-[0.35em] text-slate-900 outline-none focus:border-blue-500 disabled:bg-slate-100 disabled:text-slate-500"
            />

            <div className="mt-3 text-center text-xs font-semibold text-slate-500">
              {verifyingCode || saving
                ? "Verifying automatically, please wait..."
                : "Auto-submit activates immediately after 6 digits."}
            </div>

            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => {
                  if (verifyingCode || saving) return;
                  setShowMfaModal(false);
                  setMfaCode("");
                  setPendingAction(null);
                  mfaAutoSubmittingRef.current = false;
                }}
                disabled={verifyingCode || saving}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 hover:bg-slate-100 disabled:opacity-60"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => verifyCodeAndContinue()}
                disabled={verifyingCode || saving || mfaCode.trim().length !== 6}
                className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {verifyingCode || saving ? "Verifying automatically..." : "Verify & Continue"}
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

function FinanceBox({
  label,
  value,
  tone = "slate",
}: {
  label: string;
  value: string;
  tone?: "slate" | "emerald" | "amber" | "red";
}) {
  const cls =
    tone === "emerald"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : tone === "amber"
        ? "border-amber-200 bg-amber-50 text-amber-800"
        : tone === "red"
          ? "border-red-200 bg-red-50 text-red-800"
          : "border-slate-200 bg-slate-50 text-slate-800";

  return (
    <div className={`rounded-xl border p-3 ${cls}`}>
      <div className="text-xs font-semibold opacity-80">{label}</div>
      <div className="mt-1 text-sm font-black">{value}</div>
    </div>
  );
}

function StageBadge({ stage }: { stage: string }) {
  return (
    <span
      className={`inline-flex rounded-lg border px-2 py-1 text-xs font-semibold ${stageBadgeClass(
        stage
      )}`}
    >
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
        : s.includes("reject") || s.includes("delete")
          ? "bg-red-50 text-red-700 border-red-200"
          : "bg-slate-50 text-slate-700 border-slate-200";

  return (
    <span className={`inline-flex rounded-lg border px-2 py-1 text-xs font-semibold ${cls}`}>
      {status || "—"}
    </span>
  );
}