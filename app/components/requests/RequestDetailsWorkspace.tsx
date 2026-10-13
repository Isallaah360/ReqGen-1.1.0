"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { confirmDialog, promptDialog } from "@/lib/dialog";
import { isAwaitingUser } from "@/lib/approvalQueue";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { nameWithRole } from "@/lib/userIdentity";
import { APPROVAL_QUEUE_CHANGED_EVENT } from "@/lib/approvalQueue";
import Link from "next/link";
import Icon from "@/app/components/v4/Icon";
import { Select } from "@/app/components/v4/Select";
import { Notice, Skeleton, V4Page } from "@/app/components/v4/ui";
import { canSeeBudgetBalances } from "@/lib/v4/budgetVisibility";
import { nairaExact, nairaInWords } from "@/lib/v4/money";
import { stageTitle, stageWords, statusChip, waitedFor } from "@/lib/v4/requestText";
import { fingerprintAvailable, fingerprintStepUp } from "@/lib/v4/deviceSignIn";


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
  assigned_account_officer_user_id?: string | null;
  assigned_account_officer_name: string | null;
  requester_name?: string | null;
  updated_at?: string | null;
};

type ChainRow = { step_order: number; stage: string; owner_name: string | null; state: "done" | "now" | "wait" | "skipped"; acted_by_name: string | null; acted_role: string | null; acted_at: string | null; comment: string | null; signed: boolean };

type Hist = {
  id: string;
  action_type: string;
  from_stage?: string | null;
  action_by?: string | null;
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
  const key = (stage || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/_/g, "");
  // v4: the PO stage is now PD (Program Director). Old records still say PO.
  return key === "PO" || key === "PROGRAMOFFICER" || key === "PROGRAMMEOFFICER" ? "PD" : key;
}

function categoryKey(category: string | null | undefined) {
  return (category || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/_/g, "");
}

function requestTypeLabel(req: Req) {
  if (req.request_type === "Official") return "Official";

  const category = req.personal_category || "Others";
  if (category === "NonFund") return "Personal • Other";

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

function primaryOrFirstRole(roles: ProfileRole[], fallbackRole?: string | null) {
  const active = roles.filter((r) => r.is_active);

  const primary = active.find((r) => r.is_primary);
  const first = active[0];

  return {
    role_key: primary?.role_key || first?.role_key || (fallbackRole ? roleKey(fallbackRole) : null),
    role_name: primary?.role_name || first?.role_name || fallbackRole || null,
  };
}

type RequestActionResult = {
  message?: string | null;
  new_stage?: string | null;
  new_status?: string | null;
};

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error";
}

type RequestDetailsWorkspaceProps = {
  requestId?: string;
  embedded?: boolean;
  onClose?: () => void;
  onProcessed?: () => void;
};

export default function RequestDetailsWorkspace({ requestId, embedded = false, onClose, onProcessed }: RequestDetailsWorkspaceProps) {
  const router = useRouter();
  const params = useParams();

  const rawId = params?.id;
  const routeId = Array.isArray(rawId) ? rawId[0] || "" : typeof rawId === "string" ? rawId : "";
  const id = requestId || routeId;

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
  const [activeRoleKey, setActiveRoleKey] = useState<string>("");
  const [comment, setComment] = useState("");

  const [mfaVerified, setMfaVerified] = useState(false);
  const [totpFactorId, setTotpFactorId] = useState<string | null>(null);
  const [showMfaModal, setShowMfaModal] = useState(false);
  const [mfaCode, setMfaCode] = useState("");
  const [pendingAction, setPendingAction] = useState<SensitiveAction | null>(null);

  const mfaAutoSubmittingRef = useRef(false);

  // v4.1.2: route chain, department name, decision choice, subhead change
  const [chain, setChain] = useState<ChainRow[]>([]);
  const [deptName, setDeptName] = useState("");
  const [decision, setDecision] = useState<"approve" | "reject">("approve");
  const [changeSubTo, setChangeSubTo] = useState("");
  const [canUseFingerprint, setCanUseFingerprint] = useState(false);

  async function loadChain(requestId: string) {
    const { data, error } = await supabase.rpc("reqgen_request_chain", { p_request_id: requestId });
    setChain(error ? [] : ((data || []) as ChainRow[]));
  }

  async function loadDeptName(deptId: string | null | undefined) {
    if (!deptId) { setDeptName(""); return; }
    const { data } = await supabase.from("departments").select("name").eq("id", deptId).maybeSingle();
    setDeptName(String((data as { name?: string | null } | null)?.name || ""));
  }

  const activeRoleKeys = useMemo(() => {
    const keys = new Set<string>();

    if (me?.role) keys.add(roleKey(me.role));

    myRoles.forEach((r) => {
      if (r.is_active) keys.add(roleKey(r.role_key));
    });

    return keys;
  }, [me?.role, myRoles]);

  const isHRContext = useMemo(() => {
    return [...activeRoleKeys].some((role) =>
      role === "hr" ||
      role === "hrboss" ||
      role === "hrcoordinator" ||
      role.startsWith("hrofficer") ||
      role.startsWith("hr:")
    );
  }, [activeRoleKeys]);

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
      ["PD", "DOD", "DIRECTOR", "DINADMIN", "REGISTRAR", "HOD", "HR"].includes(stg)
    );
  }, [req, me, stg]);

  const assignedWorkflowOfficerCanEdit = useMemo(() => {
    if (!req || !me) return false;

    const editableOfficialStages = [
      "PD",
      "DOD",
      "DIRECTOR",
      "DINADMIN",
      "REGISTRAR",
      "HOD",
    ];

    const editablePersonalStages = ["DOD", "HOD", "HR"];

    const stageIsEditable =
      isOfficial
        ? editableOfficialStages.includes(stg)
        : isPersonal
          ? editablePersonalStages.includes(stg)
          : false;

    return req.current_owner === me.id && stageIsEditable;
  }, [req, me, isOfficial, isPersonal, stg]);

  const canEditRequest = useMemo(() => {
    return requesterCanEditDeleteEarly || assignedWorkflowOfficerCanEdit;
  }, [requesterCanEditDeleteEarly, assignedWorkflowOfficerCanEdit]);

  const canDeleteRequest = useMemo(() => {
    return requesterCanEditDeleteEarly;
  }, [requesterCanEditDeleteEarly]);

  // v3.1.5: the SAME rule as the Approvals list, bell and access gate
  // (lib/approvalQueue.ts) — a request shown as waiting can always be acted on.
  const canAct = useMemo(() => {
    if (!req || !me) return false;
    return isAwaitingUser(req, me.id, activeRoleKey || me.role || "staff");
  }, [req, me, activeRoleKey]);

  const canCheckAttachments = useMemo(() => {
    if (!req || !me) return false;
    if (req.current_owner === me.id) return true;

    const allowed = [
      "admin",
      "auditor",
      "po",
      "pd",
      "dod",
      "director",
      "dinadmin",
      "dinadmin1",
      "dinadmin2",
      "dinadmin3",
      "deanadmin",
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
    if (!req || req.subhead_id) return false;

    const requestIsClosed = [
      "APPROVED",
      "REJECTED",
      "CANCELLED",
      "DELETED",
      "PAID",
      "CLOSED",
      "COMPLETED",
    ].includes(stageKey(req.status));

    if (requestIsClosed) return false;

    const officialNeedsBudgetLine =
      isOfficial && ["DIRECTOR", "DINADMIN", "HOD", "REGISTRAR", "HR", "DG"].includes(stg);

    const personalFundNeedsHRRecommendation =
      isPersonalFund && stg === "HR";

    return officialNeedsBudgetLine || personalFundNeedsHRRecommendation;
  }, [req, isOfficial, isPersonalFund, stg]);

  const canAssignSubhead = useMemo(() => {
    if (!req || !me || !needsSubheadAssignment) return false;

    // Locked ReqGen workflow rule: DG, Admin, Auditor and Finance roles never
    // assign request subheads. Subhead assignment belongs only to the active
    // Director, DIN Admin, HOD, Registrar or HR workflow authority.
    const assignmentRole = roleKey(activeRoleKey || me.role);
    const permittedRoles = new Set(["director", "dinadmin", "hod", "registrar", "hr"]);
    if (!permittedRoles.has(assignmentRole)) return false;

    // Assignment is an operational workflow action, not an oversight action.
    // The officer must own the request at the current stage.
    return req.current_owner === me.id;
  }, [req, me, needsSubheadAssignment, activeRoleKey]);

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

  const usesAutomaticAccountOfficerRouting = useMemo(() => {
    if (!req || !canAct || !isDgStage) return false;

    if (isOfficial) {
      return Boolean(req.subhead_id && req.assigned_account_officer_id);
    }

    return isPersonalFund;
  }, [
    req,
    canAct,
    isDgStage,
    isOfficial,
    isPersonalFund,
  ]);

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
    let rows: AssignableSubhead[] = [];

    if (isHRContext && id) {
      const { data, error } = await supabase.rpc(
        "get_hr_personal_fund_subhead_summary",
        { p_request_id: id }
      );

      if (error) {
        setAssignableSubheads([]);
        return;
      }

      rows = (data || []) as AssignableSubhead[];
    } else {
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

      rows = (data || []) as AssignableSubhead[];
    }

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
    const [rolesResult, activeRoleResult] = await Promise.all([
      supabase
        .from("profile_roles")
        .select("id,profile_id,role_key,role_name,is_primary,is_active")
        .eq("profile_id", userId)
        .eq("is_active", true),
      supabase.rpc("get_my_active_role"),
    ]);

    setMyRoles((rolesResult.data || []) as ProfileRole[]);

    const activeData = activeRoleResult.data as
      | { active_role_key?: string | null; role_key?: string | null; get_my_active_role?: string | null }
      | Array<{ active_role_key?: string | null; role_key?: string | null; get_my_active_role?: string | null }>
      | string
      | null;
    const activeRecord = Array.isArray(activeData) ? activeData[0] : activeData;
    const resolved = typeof activeRecord === "string"
      ? activeRecord
      : activeRecord?.active_role_key || activeRecord?.role_key || activeRecord?.get_my_active_role || "";
    setActiveRoleKey(roleKey(resolved));
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
        "id,request_no,title,details,amount,status,current_stage,current_owner,created_by,dept_id,subhead_id,request_type,personal_category,funds_state,created_at,updated_at,requester_name,assigned_account_officer_id,assigned_account_officer_user_id,assigned_account_officer_name"
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

    if (requestRow.subhead_id) {
      const { data: sh } = await supabase
        .from("subheads")
        .select("id,code,name")
        .eq("id", requestRow.subhead_id)
        .single();

      if (sh) setSubhead(sh as SubheadMini);
    } else {
      setSubhead(null);
    }

    if (requestRow.dept_id) {
      await loadAssignableSubheads(requestRow.dept_id);
    }

    const { data: h, error: hErr } = await supabase
      .from("request_history")
      .select(
        "id,action_type,comment,from_stage,to_stage,created_at,signature_url,actor_name,actor_role_key,actor_role_name,action_by"
      )
      .eq("request_id", id)
      .order("created_at", { ascending: false });

    if (hErr) {
      setMsg("Failed to load history: " + hErr.message);
    } else {
      setHistory((h || []) as Hist[]);
    }

    await loadAttachmentsAndChecks(id);
    await Promise.all([loadChain(id), loadDeptName(requestRow.dept_id)]);
    void fingerprintAvailable().then(setCanUseFingerprint);

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
        "id,request_no,title,details,amount,status,current_stage,current_owner,created_by,dept_id,subhead_id,request_type,personal_category,funds_state,created_at,updated_at,requester_name,assigned_account_officer_id,assigned_account_officer_user_id,assigned_account_officer_name"
      )
      .eq("id", id)
      .single();

    const reloadedRequest = (r2 as Req | null) || null;
    setReq(reloadedRequest);

    const { data: h2 } = await supabase
      .from("request_history")
      .select(
        "id,action_type,comment,from_stage,to_stage,created_at,signature_url,actor_name,actor_role_key,actor_role_name,action_by"
      )
      .eq("request_id", id)
      .order("created_at", { ascending: false });

    setHistory((h2 || []) as Hist[]);

    const subId = reloadedRequest?.subhead_id || null;

    if (subId) {
      const { data: sh } = await supabase
        .from("subheads")
        .select("id,code,name")
        .eq("id", subId)
        .single();

      setSubhead((sh as SubheadMini | null) || null);
    } else {
      setSubhead(null);
    }

    if (reloadedRequest?.dept_id) {
      await loadAssignableSubheads(reloadedRequest.dept_id);
    }

    await loadAttachmentsAndChecks(id);
    await loadChain(id);
    router.refresh();
  }

  function goToEdit() {
    if (!req) return;

    if (!canEditRequest) {
      setMsg("✕ You cannot edit this request at its current stage.");
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
      setMsg("✕ You are not allowed to assign a subhead for this request.");
      return;
    }

    if (!selectedSubheadId) {
      setMsg("✕ Please select a subhead before assigning.");
      return;
    }

    if (!selectedAssignableSubhead) {
      setMsg("✕ Selected subhead could not be found.");
      return;
    }

    if (!selectedSubheadCanCoverAmount) {
      setMsg(
        `✕ Insufficient balance. Available balance is ${formatNaira(
          selectedSubheadAvailableBalance
        )}, but request amount is ${formatNaira(req.amount)}.`
      );
      return;
    }

    const ok = await confirmDialog({
      title: "Assign subhead and reserve funds?",
      message: `Assign "${selectedAssignableSubhead.code ? `${selectedAssignableSubhead.code} — ` : ""
      }${selectedAssignableSubhead.name}" and reserve ${formatNaira(req.amount)} for this request?`,
      confirmLabel: "Assign and reserve",
    });

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

      setMsg(`✓ ${((data as RequestActionResult | null)?.message) || "Subhead assigned and funds reserved successfully."}`);

      await reload();
    } catch (e: unknown) {
      setMsg("✕ Subhead assignment failed: " + errorMessage(e));
    } finally {
      setAssigningSubhead(false);
    }
  }

  async function checkAttachmentPersonally(attachment: AttachmentRow) {
    if (!req || !me) return;

    if (!canCheckAttachments) {
      setMsg("✕ You are not allowed to check attachments on this request.");
      return;
    }

    if (isAttachmentCheckedByMe(attachment.id)) {
      setMsg("✓ You have already checked this attachment.");
      return;
    }

    const roleInfo = primaryOrFirstRole(myRoles, me.role);

    setCheckingAttachmentId(attachment.id);
    setMsg(null);

    try {
      const { error } = await supabase.from("request_attachment_checks").upsert(
        {
          request_id: req.id,
          attachment_id: attachment.id,
          checked_by: me.id,
          checked_by_name: me.full_name || null,
          checked_by_role: roleInfo.role_name,
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
        comment: `${attachment.file_name} was checked by ${me.full_name || "officer"} (${roleInfo.role_name || "Role not set"
          }).`,
        to_stage: req.current_stage,
        actor_name: me.full_name || null,
        actor_role_key: roleInfo.role_key,
        actor_role_name: roleInfo.role_name,
        action_by: me.id,
      });

      setMsg("✓ Attachment checked successfully for your own approval stage.");
      await loadAttachmentsAndChecks(req.id);
      router.refresh();
    } catch (e: unknown) {
      setMsg("✕ Attachment check failed: " + errorMessage(e));
    } finally {
      setCheckingAttachmentId(null);
    }
  }

  function validateBeforeSensitiveAction(action: SensitiveAction) {
    if (!req || !me) return false;

    if (!totpFactorId) {
      setMsg("✕ You must set up 2FA before performing this action.");
      router.push("/mfa/setup");
      return false;
    }

    if (action === "Delete") {
      if (!canDeleteRequest) {
        setMsg("✕ Only the requester can delete while the request is still at an allowed early stage.");
        return false;
      }

      return true;
    }

    if (!me.signature_url) {
      setMsg("✕ You must upload your signature in Profile before taking actions.");
      return false;
    }

    if (!canAct) {
      setMsg("✕ You cannot act on this request. It is not assigned to you.");
      return false;
    }

    if (action === "Approve" && needsSubheadAssignment) {
      setMsg(
        "✕ This official request has no subhead yet. Assign a subhead and reserve funds before approving."
      );
      return false;
    }

    if (action === "Approve" && isDgStage && isOfficial && !req.assigned_account_officer_id) {
      setMsg(
        "✕ This request cannot leave DG because the selected subhead has no Account Officer routing. Configure the subhead/account routing first."
      );
      return false;
    }

    if (hasAttachments && !allAttachmentsCheckedByMe) {
      setMsg(
        `✕ You still have ${myPendingAttachments.length
        } attachment(s) unchecked. Open and check every attachment personally before you can ${action.toLowerCase()} this request.`
      );
      return false;
    }

    if (action === "Reject" && comment.trim().length < 3) {
      setMsg("✕ Write the reason for sending this request back.");
      return false;
    }

    return true;
  }

  async function openFresh2faModal(action: SensitiveAction) {
    setMsg(null);

    const ok = validateBeforeSensitiveAction(action);
    if (!ok) return;

    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    const sessionIsAal2 = aal?.currentLevel === "aal2";

    // v4.1.2 (Build Reference §10): the DG's signature + IET stamp and the
    // Account Officer's payment always need a fresh fingerprint or 2FA code —
    // never a passcode session alone. Other steps reuse the verified session.
    const mustConfirmFresh = action === "Approve" && (isDgStage || isAccountStage);

    if (mustConfirmFresh && canUseFingerprint) {
      try {
        await fingerprintStepUp();
        await actAfterFresh2fa(action);
        return;
      } catch (e: unknown) {
        const m = errorMessage(e);
        if (!/no fingerprint/i.test(m)) { setMsg("✕ " + m + " You can use your 2FA code instead."); }
      }
    }

    // ReqGen already requires MFA for authenticated workspaces. Reuse that secure
    // AAL2 session for normal request work so users are not challenged repeatedly.
    if (!mustConfirmFresh && (sessionIsAal2 || mfaVerified)) {
      if (action === "Delete") {
        await deleteRequestAfterFresh2fa();
      } else {
        await actAfterFresh2fa(action);
      }
      return;
    }

    // Fallback only when the secure session has expired or dropped below AAL2.
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
      setMsg("✕ No verified 2FA authenticator found. Please set up 2FA again.");
      setShowMfaModal(false);
      router.push("/mfa/setup");
      return;
    }

    const code = String(codeOverride || mfaCode || "")
      .trim()
      .replace(/\D/g, "")
      .slice(0, 6);

    if (!/^\d{6}$/.test(code)) {
      setMsg("✕ Enter the 6-digit code from your authenticator app.");
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
    } catch (e: unknown) {
      setMsg("✕ 2FA verification failed: " + (e instanceof Error ? e.message : "Invalid code."));
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
        // v4.1.2: keep B/D, expenditure and C/D as this officer saw them, for the letter.
        if (req.subhead_id && !isDgStage && !isAccountStage && !isHRFiling) {
          const conf = await supabase.rpc("reqgen_confirm_request_budget", { p_request_id: req.id });
          if (conf.error && !/could not find the function|schema cache/i.test(conf.error.message)) throw new Error(conf.error.message);
        }
        const { data, error } = await supabase.rpc("approve_request_step", {
          p_request_id: req.id,
          p_actor_id: me.id,
          p_comment: comment.trim(),
          p_signature_url: me.signature_url,
        });

        if (error) throw new Error(error.message);

        const result = Array.isArray(data) ? data[0] : data;
        const nextStage = (result as RequestActionResult | null)?.new_stage;
        const nextStatus = (result as RequestActionResult | null)?.new_status;

        await sendRequestApprovalNotification(req.id);

        if (nextStage === "Completed") {
          setMsg(
            nextStatus === "Paid"
              ? "✓ Request paid successfully and closed after your attachment checks."
              : "✓ Request completed successfully after your attachment checks."
          );
        } else if (isHRFiling) {
          setMsg("✓ HR review completed successfully after your attachment checks.");
        } else if (isAccountStage && nextStage === "HR Filing") {
          setMsg("✓ Payment treated. Request sent for final HR review.");
        } else if (usesAutomaticAccountOfficerRouting && nextStage === "Account") {
          setMsg(
            "✓ Approved by DG. The request was automatically sent to the AccountOfficer already attached from the selected subhead."
          );
        } else {
          setMsg(`✓ Approved after your attachment checks. Sent to ${nextStage || "next stage"}.`);
        }
      } else {
        // v4.1.1: "Reject" sends the request back (Build Reference §5): from the DG to the
        // officer whose approval sent it there; from any other officer to the requester.
        let back = await supabase.rpc("reqgen_return_request", {
          p_request_id: req.id,
          p_comment: comment.trim(),
          p_signature_url: me.signature_url,
        });
        if (back.error && /could not find the function|schema cache/i.test(back.error.message)) {
          // Before the v4.1.1 database step: the old rule (request closes as rejected).
          back = await supabase.rpc("reject_request_step", {
            p_request_id: req.id,
            p_actor_id: me.id,
            p_comment: comment.trim(),
            p_signature_url: me.signature_url,
          });
        }
        if (back.error) throw new Error(back.error.message);

        const result = (Array.isArray(back.data) ? back.data[0] : back.data) as (RequestActionResult & { new_owner?: string | null }) | null;
        const status = String(result?.new_status || "");
        setMsg(
          /director general/i.test(status)
            ? "✓ Sent back to the officer who approved it before you, with your reason."
            : /returned/i.test(status)
              ? "✓ Sent back to the requester to correct, with your reason."
              : `✓ Request ${String(result?.new_stage || "rejected").toLowerCase()}.`
        );
      }

      setComment("");
      await reload();
      // Tell every approval badge in this browser to refresh immediately.
      window.dispatchEvent(new Event(APPROVAL_QUEUE_CHANGED_EVENT));
      if (embedded) onProcessed?.();
    } catch (e: unknown) {
      setMsg("✕ Action failed: " + errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  // v4.1.1: requester actions on a request that was sent back.
  const backWithMe = !!req && !!me && req.created_by === me.id && req.current_owner === me.id && /returned for correction/i.test(String(req.status || ""));
  const lastReturn = useMemo(() => history.filter((h) => String(h.action_type || "").toLowerCase() === "return").slice(-1)[0] || null, [history]);
  const canWithdraw = !!req && !!me && req.created_by === me.id && !["DG", "ACCOUNT", "HRFILING", "COMPLETED", "REJECTED", "DELETED", "CANCELLED"].includes(stageKey(req.current_stage));

  async function resubmitReturned() {
    if (!req) return;
    const note = await promptDialog({ title: "Send the corrected request back?", message: "It goes back to the officer who returned it.", label: "Note for the officer (optional)", required: false, confirmLabel: "Send back" });
    if (note === null) return;
    setSaving(true); setMsg(null);
    try {
      const { error } = await supabase.rpc("reqgen_resubmit_request", { p_request_id: req.id, p_comment: note || null });
      if (error) throw new Error(error.message);
      setMsg("✓ Sent back to the officer who returned it.");
      await reload();
      window.dispatchEvent(new Event(APPROVAL_QUEUE_CHANGED_EVENT));
    } catch (e: unknown) { setMsg("✕ " + errorMessage(e)); } finally { setSaving(false); }
  }

  async function withdrawMine() {
    if (!req) return;
    const reason = await promptDialog({ title: "Withdraw this request?", message: "It closes and any reserved fund is released. This cannot be undone.", label: "Why are you withdrawing it?", confirmLabel: "Withdraw", tone: "danger" });
    if (!reason) return;
    setSaving(true); setMsg(null);
    try {
      const { error } = await supabase.rpc("reqgen_withdraw_request", { p_request_id: req.id, p_reason: reason });
      if (error) throw new Error(error.message);
      setMsg("✓ Request withdrawn.");
      await reload();
      window.dispatchEvent(new Event(APPROVAL_QUEUE_CHANGED_EVENT));
    } catch (e: unknown) { setMsg("✕ " + errorMessage(e)); } finally { setSaving(false); }
  }

  async function confirmWithFingerprint() {
    const action = pendingAction;
    if (!action) return;
    try {
      await fingerprintStepUp();
      setShowMfaModal(false);
      setPendingAction(null);
      if (action === "Delete") await deleteRequestAfterFresh2fa();
      else await actAfterFresh2fa(action);
    } catch (e: unknown) {
      setMsg("✕ " + errorMessage(e));
    }
  }

  // v4.1.2: reopen a withdrawn or rejected request (Build Reference §5)
  async function reopenRequest() {
    if (!req) return;
    const reason = await promptDialog({
      title: `Reopen ${req.request_no}?`,
      message: "It goes back to the requester to correct and send again, along its original route. The reason is written in the history.",
      label: "Why is it being reopened?",
      confirmLabel: "Reopen",
    });
    if (!reason) return;
    setSaving(true); setMsg(null);
    try {
      const { error } = await supabase.rpc("reqgen_reopen_request", { p_request_id: req.id, p_reason: reason });
      if (error) throw new Error(error.message);
      setMsg("✓ Reopened. The requester has been told and can correct it and send it again.");
      await reload();
      window.dispatchEvent(new Event(APPROVAL_QUEUE_CHANGED_EVENT));
    } catch (e: unknown) { setMsg("✕ " + errorMessage(e)); } finally { setSaving(false); }
  }

  // v4.1.2: the approving officer confirms the subhead; changing it needs a reason
  async function changeConfirmedSubhead() {
    if (!req || !changeSubTo || changeSubTo === req.subhead_id) return;
    const target = assignableSubheads.find((s) => s.id === changeSubTo);
    const reason = await promptDialog({
      title: "Change the subhead?",
      message: `Move ${formatNaira(req.amount)} to ${target ? `${target.code ? `${target.code} — ` : ""}${target.name}` : "the chosen subhead"}. The fund is reserved there and released from the old one.`,
      label: "Reason for the change",
      confirmLabel: "Change subhead",
    });
    if (!reason) return;
    setAssigningSubhead(true); setMsg(null);
    try {
      const { error } = await supabase.rpc("update_request_adjust_reservation", {
        p_request_id: req.id,
        p_new_subhead_id: changeSubTo,
        p_new_amount: Number(req.amount || 0),
        p_new_title: req.title,
        p_new_details: req.details,
      });
      if (error) throw new Error(error.message);
      await supabase.from("request_history").insert({
        request_id: req.id,
        action_type: "Subhead changed",
        comment: `Subhead changed to ${target ? `${target.code ? `${target.code} — ` : ""}${target.name}` : "another subhead"}. Reason: ${reason}`,
        from_stage: req.current_stage,
        to_stage: req.current_stage,
        actor_name: me?.full_name || null,
        action_by: me?.id,
      });
      setChangeSubTo("");
      setMsg("✓ Subhead changed and the fund reserved there.");
      await reload();
    } catch (e: unknown) { setMsg("✕ Subhead change failed: " + errorMessage(e)); } finally { setAssigningSubhead(false); }
  }

  async function deleteRequestAfterFresh2fa() {
    if (!req) return;

    const stillValid = validateBeforeSensitiveAction("Delete");
    if (!stillValid) return;

    const ok = await confirmDialog({
      title: "Delete this request?",
      message: "Any reserved funds will be restored if applicable. This cannot be undone.",
      confirmLabel: "Delete request",
      tone: "danger",
    });
    if (!ok) return;

    setSaving(true);
    setMsg(null);

    try {
      const { error } = await supabase.rpc("delete_request_restore", {
        p_request_id: req.id,
      });

      if (error) throw new Error(error.message);

      setMsg("✓ Deleted successfully successfully.");

      await reload();

      setTimeout(() => {
        router.push(`/requests/mine?updated=${Date.now()}`);
        router.refresh();
      }, 500);
    } catch (e: unknown) {
      setMsg("✕ Delete failed: " + errorMessage(e));
    } finally {
      setSaving(false);
    }
  }


  const balanceViewer = canSeeBudgetBalances(activeRoleKey || me?.role);
  const currentFigures = useMemo(() => assignableSubheads.find((s) => s.id === req?.subhead_id) || null, [assignableSubheads, req?.subhead_id]);
  const isClosedForReopen = !!req && (["CANCELLED", "REJECTED"].includes(stageKey(req.current_stage)) || /^(withdrawn|rejected)/i.test(String(req.status || "")));
  const reopenRole = ["account", "accounts", "accountofficer", "auditor", "admin"].includes(roleKey(activeRoleKey));
  const canReopen = isClosedForReopen && (isMyRequest || reopenRole);

  if (loading) return <V4Page><div className="v4-card v4-card-pad"><Skeleton lines={4} /></div><div className="v4-card"><Skeleton lines={6} /></div></V4Page>;

  // v3.0.2: Registry tracks request MOVEMENT only and never sees request content.
  if (roleKey(activeRoleKey) === "registry") {
    return (
      <V4Page>
        <Notice tone="amber" title="Request contents are not available to Registry.">
          Registry follows where a request is, who acted and when — never its title, amount or balance. Use Registry › Request Tracking.
          To open your own requests, switch “Acting as” to Staff.
        </Notice>
        <div><Link className="v4-btn v4-btn-secondary" href="/registry">Open Registry</Link></div>
      </V4Page>
    );
  }

  if (!req) {
    return (
      <V4Page>
        {msg ? <Notice tone="red">{msg.replace(/^✕\s*/, "")}</Notice> : null}
        <div className="v4-card v4-card-pad"><strong>Request not found.</strong> It may have been deleted, or it is not shared with you.</div>
        <div><Link className="v4-btn v4-btn-secondary" href="/requests/mine">Back to My Requests</Link></div>
      </V4Page>
    );
  }

  const chip = statusChip(req.status, req.current_stage);
  const isOpen = !["COMPLETED", "REJECTED", "CANCELLED", "DELETED"].includes(stageKey(req.current_stage));
  const stageName = stageTitle(req.current_stage);
  const headChip = canAct
    ? { tone: "brand", text: `Your step: ${stageName}${isDgStage ? " · final approval" : ""}` }
    : backWithMe
      ? { tone: "red", text: "Sent back to you to correct" }
      : isOpen
        ? { tone: "amber", text: `${stageWords(req.current_stage)} · ${waitedFor(req.updated_at || req.created_at)}` }
        : { tone: chip.tone, text: chip.label };
  const amountWords = !isPersonalNonFund && Number(req.amount) > 0 ? nairaInWords(req.amount) : "";
  const subText = subhead ? `${subhead.code ? `${subhead.code} — ` : ""}${subhead.name}` : isOfficial || isPersonalFund ? "To be confirmed by the officer" : "Not needed";
  const requester = req.requester_name || (isMyRequest ? me?.full_name : "") || "Requester";
  const submitRow = [...history].reverse().find((h) => String(h.action_type || "").toLowerCase() === "submit");
  const nextStop = chain.find((c) => c.state === "wait" && c.owner_name) || chain.find((c) => c.state === "wait");
  const lastApprover = [...history].find((h) => /^approv/i.test(String(h.action_type || "")) && h.action_by !== req.created_by);
  const notice = msg ? { tone: (msg.startsWith("✕") ? "red" : "green") as "red" | "green", text: msg.replace(/^[✓✕]\s*/, "") } : null;
  const actingLocked = saving || verifyingCode || assigningSubhead;
  const attachmentsLocked = hasAttachments && !allAttachmentsCheckedByMe;
  const fig = currentFigures;
  const figAllocation = fig ? Number(fig.approved_allocation || 0) : 0;
  const figExpenditure = fig ? Number(fig.expenditure || 0) : 0;
  const figReservedAll = fig ? Number(fig.reserved_amount || 0) : 0;
  const thisAmount = Number(req.amount || 0);
  const mineReserved = /^reserved$/i.test(String(req.funds_state || "")) ? thisAmount : 0;
  const figReservedOthers = Math.max(0, figReservedAll - mineReserved);
  // Letter figures (Build Reference §5): B/D = what the subhead had before this request,
  // EXPENDITURE = this request, C/D = what is left after it.
  const figBD = figAllocation - figExpenditure - figReservedOthers;
  const figCD = figBD - thisAmount;
  const usedPct = figAllocation > 0 ? Math.min(100, Math.round(((figExpenditure + figReservedOthers + thisAmount) / figAllocation) * 100)) : 0;

  const historyLook = (h: Hist) => {
    const a = String(h.action_type || "").toLowerCase();
    if (a === "submit") return { icon: "send", tone: "blue", text: `Submitted by ${h.action_by === me?.id ? "you" : h.actor_name || "the requester"}` };
    if (a.startsWith("approv")) return { icon: "check", tone: "green", text: `Approved by ${h.actor_name || "officer"}${h.actor_role_name ? ` (${h.actor_role_name})` : ""}` };
    if (a === "return") return { icon: "returned", tone: "amber", text: `Sent back by ${h.actor_name || "officer"}${h.actor_role_name ? ` (${h.actor_role_name})` : ""}` };
    if (a.startsWith("reject")) return { icon: "x", tone: "red", text: `Rejected by ${h.actor_name || "officer"}` };
    if (a === "withdraw") return { icon: "x", tone: "red", text: "Withdrawn by the requester" };
    if (a === "reopen") return { icon: "returned", tone: "blue", text: `Reopened by ${h.actor_name || "officer"}${h.actor_role_name ? ` (${h.actor_role_name})` : ""}` };
    if (a === "resubmit") return { icon: "send", tone: "blue", text: "Corrected and sent again" };
    if (a.includes("attachment")) return { icon: "eye", tone: "blue", text: "Attachment checked" };
    if (a.includes("subhead") || a === "edited") return { icon: "pen", tone: "amber", text: h.action_type === "Edited" ? "Edited" : "Subhead changed" };
    if (/treat|paid|pay|complete/.test(a)) return { icon: "wallet", tone: "green", text: `${h.action_type} by ${h.actor_name || "Account"}` };
    return { icon: "info", tone: "blue", text: `${h.action_type} · ${h.actor_name || ""}` };
  };

  const chainItems = [
    submitRow
      ? { key: "submit", cls: "v4-done", st: "1 · Submitted", who: submitRow.actor_name || requester, r: `Requester${deptName ? ` · ${deptName}` : ""}`, em: shortWhen(submitRow.created_at), ink: !!submitRow.signature_url }
      : null,
    ...chain.filter((c) => c.state !== "skipped").map((c, i) => {
      const label = stageTitle(c.stage);
      const isMeNow = c.state === "now" && canAct;
      return {
        key: `${c.stage}-${i}`,
        cls: c.state === "done" ? "v4-done" : c.state === "now" ? "v4-now" : "v4-wait",
        st: `${i + (submitRow ? 2 : 1)} · ${label}`,
        who: c.state === "done" ? c.acted_by_name || c.owner_name || label : isMeNow ? "You" : c.owner_name || (stageKey(c.stage) === "ACCOUNT" ? req.assigned_account_officer_name || "Account Officer" : "Vacant — skipped"),
        r: c.state === "done" ? c.acted_role || label : c.state === "now" ? (stageKey(c.stage) === "DG" ? "Sign + IET stamp" : `Waiting · ${waitedFor(req.updated_at || req.created_at)}`) : stageKey(c.stage) === "ACCOUNT" ? "Releases the fund" : stageKey(c.stage) === "DG" ? "Sign + IET stamp" : "",
        em: c.state === "done" ? shortWhen(c.acted_at) : "",
        ink: c.state === "done" && c.signed,
      };
    }),
  ].filter(Boolean) as Array<{ key: string; cls: string; st: string; who: string; r: string; em: string; ink: boolean }>;

  return (
    <V4Page className="v4-reqrec">
      {embedded ? <div><button type="button" className="v4-btn v4-btn-ghost" onClick={() => onClose?.()}><Icon name="left" />Close</button></div> : null}

      <section className="v4-card v4-card-pad">
        <div className="v4-rec">
          <div>
            <span className={`v4-chip v4-chip-${headChip.tone}`}><Icon name={canAct ? "pen" : isOpen ? "clock" : "check"} size="sm" />{headChip.text}</span>
            <h1 className="v4-page-title" style={{ marginTop: 8 }}>{req.request_no} · {req.title}</h1>
            <div className="v4-meta">
              {!isMyRequest ? <span>From <b>{requester}</b></span> : null}
              <span>Type <b>{requestTypeLabel(req)}</b></span>
              {deptName ? <span>Department <b>{deptName}</b></span> : null}
              {isOfficial || isPersonalFund ? <span>Subhead <b>{subText}</b></span> : null}
              <span>Submitted <b>{new Date(req.created_at).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</b></span>
            </div>
          </div>
          <div className="v4-right">
            <div className="v4-label">Amount</div>
            <div className="v4-amount-big">{isPersonalNonFund ? "—" : nairaExact(req.amount)}</div>
            {amountWords ? <span className="v4-help" style={{ fontSize: 12.5, color: "var(--v4-muted)" }}>{amountWords}</span> : null}
            <div className="v4-btns">
              {canWithdraw && !canAct ? <button className="v4-btn v4-btn-secondary" type="button" onClick={() => void withdrawMine()} disabled={actingLocked}><Icon name="x" />Withdraw</button> : null}
              {canEditRequest ? <button className="v4-btn v4-btn-secondary" type="button" onClick={goToEdit} disabled={actingLocked}><Icon name="pen" />Edit</button> : null}
              {canDeleteRequest ? <button className="v4-btn v4-btn-secondary" type="button" style={{ color: "var(--v4-red)" }} onClick={() => openFresh2faModal("Delete")} disabled={actingLocked}>Delete</button> : null}
              {canReopen ? <button className="v4-btn v4-btn-secondary" type="button" onClick={() => void reopenRequest()} disabled={actingLocked}><Icon name="returned" />Reopen</button> : null}
              <Link className="v4-btn v4-btn-secondary" href={`/requests/${req.id}/print`}><Icon name="printer" />Print</Link>
            </div>
          </div>
        </div>
      </section>

      {notice ? <Notice tone={notice.tone}>{notice.text}</Notice> : null}

      {backWithMe && !canAct ? (
        <section className="v4-action-card v4-card-pad">
          <h2 className="v4-h2" style={{ marginBottom: 4 }}>{lastReturn && String(lastReturn.action_type).toLowerCase() === "return" ? "This request was sent back to you" : "This request was reopened"}</h2>
          {lastReturn ? <p className="v4-help" style={{ margin: "0 0 14px" }}>“{lastReturn.comment}” — {lastReturn.actor_name || "Officer"}{lastReturn.actor_role_name ? `, ${lastReturn.actor_role_name}` : ""}</p> : null}
          <div className="v4-form-actions" style={{ borderTop: 0, paddingTop: 0, justifyContent: "flex-start" }}>
            <Link className="v4-btn v4-btn-primary" href={`/requests/${req.id}/edit`}><Icon name="pen" />Correct the request</Link>
            <button type="button" className="v4-btn v4-btn-secondary" onClick={() => void resubmitReturned()} disabled={saving}><Icon name="send" />Send it again as it is</button>
            <button type="button" className="v4-btn v4-btn-ghost" style={{ color: "var(--v4-red)" }} onClick={() => void withdrawMine()} disabled={saving}>Withdraw</button>
          </div>
        </section>
      ) : null}

      {canAct ? (
        <section className="v4-action-card v4-card-pad">
          <h2 className="v4-h2" style={{ marginBottom: 4 }}>{isAccountStage ? "Treat this request" : isHRFiling ? "HR review and filing" : "Your decision"}</h2>
          <p className="v4-help" style={{ margin: "0 0 14px" }}>
            {isDgStage
              ? <>Approving puts your signature <b>and the IET stamp</b> on the letter in one step{req.assigned_account_officer_name ? <>, then sends it to Account ({req.assigned_account_officer_name}) to release the fund</> : null}.</>
              : isAccountStage
                ? isPersonalFund ? "Record the payment; the request then goes to HR for filing." : "Record that the fund has been released. Your signature is added."
                : "Your saved signature is added. The requester and the next officer are told at once."}
          </p>

          {!isAccountStage && !isHRFiling ? (
            <div className="v4-decide" role="radiogroup" aria-label="Decision" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
              <label className="v4-ok"><input type="radio" name="rg-decision" checked={decision === "approve"} onChange={() => setDecision("approve")} />
                <span><strong>{isDgStage ? "Approve, sign and stamp" : "Approve"}</strong>
                  <span>{isDgStage ? "Send to Account to release the fund" : nextStop ? `Send to the ${stageTitle(nextStop.stage)}${nextStop.owner_name ? ` (${nextStop.owner_name})` : ""}` : "Send to the next officer"}</span></span></label>
              <label className="v4-no"><input type="radio" name="rg-decision" checked={decision === "reject"} onChange={() => setDecision("reject")} />
                <span><strong>Reject</strong>
                  <span>{isDgStage && lastApprover ? `Back to ${lastApprover.actor_name || "the previous officer"}${lastApprover.actor_role_name ? ` (${lastApprover.actor_role_name})` : ""} with your reason. They correct and send it back to you, or send it to the requester.` : `Back to ${requester} with your reason, to correct and resubmit`}</span></span></label>
            </div>
          ) : null}

          {needsSubheadAssignment ? (
            <div className="v4-subconfirm">
              {canAssignSubhead ? (
                <>
                  <div className="v4-subconfirm-row">
                    <div className="v4-field" style={{ flex: "1 1 260px" }}>
                      <label className="v4-flabel" htmlFor="rq-assign-sub" style={{ fontSize: 13, fontWeight: 700 }}>{isPersonalFund ? "Recommend a subhead" : "Choose the subhead"} <span className="v4-req">*</span></label>
                      <Select id="rq-assign-sub" value={selectedSubheadId} onChange={setSelectedSubheadId} placeholder="Choose the subhead"
                        options={assignableSubheads.map((s) => ({ value: s.id, label: `${s.code ? `${s.code} — ` : ""}${s.name}`, hint: `Available ${formatNaira(availableBalanceForSubhead(s))}` }))} menuMinWidth={300} />
                      <span className="v4-help">The request has no subhead yet. The fund is reserved when you assign it.</span>
                    </div>
                    {selectedAssignableSubhead ? (
                      <div className="v4-balbox" style={{ flex: "1 1 300px" }}>
                        <div><span>ALLOCATION B/D:</span><span>{nairaExact(selectedSubheadAvailableBalance)}</span></div>
                        <div><span>EXPENDITURE:</span><span>{nairaExact(req.amount)}</span></div>
                        <div><span>BALANCE C/D:</span><span>{nairaExact(selectedSubheadAvailableBalance - Number(req.amount || 0))}</span></div>
                      </div>
                    ) : null}
                  </div>
                  {selectedAssignableSubhead && !selectedSubheadCanCoverAmount ? <p className="v4-error" style={{ margin: "10px 0 0" }}>This subhead cannot cover {formatNaira(req.amount)}.</p> : null}
                  <div style={{ marginTop: 12 }}><button type="button" className="v4-btn v4-btn-secondary" onClick={() => void assignSubheadAndReserve()} disabled={actingLocked || !selectedSubheadId || !selectedSubheadCanCoverAmount}>
                    {assigningSubhead ? "Reserving…" : isPersonalFund ? "Recommend and reserve" : "Assign and reserve the fund"}</button></div>
                </>
              ) : <p className="v4-help" style={{ margin: 0 }}>This request has no subhead yet. Only the officer at the department step (DOD, DIN Admin, HOD, Registrar or HR) assigns it.</p>}
            </div>
          ) : (isOfficial || isPersonalFund) && subhead && balanceViewer && !isAccountStage && !isHRFiling ? (
            <div className="v4-subconfirm">
              <div className="v4-subconfirm-row">
                <div className="v4-field" style={{ flex: "1 1 260px" }}>
                  <label className="v4-flabel" htmlFor="rq-confirm-sub" style={{ fontSize: 13, fontWeight: 700 }}>Confirm subhead</label>
                  <Select id="rq-confirm-sub" value={changeSubTo || req.subhead_id || ""} onChange={setChangeSubTo} menuMinWidth={300}
                    options={assignableSubheads.map((s) => ({ value: s.id, label: `${s.code ? `${s.code} — ` : ""}${s.name}${s.id === req.subhead_id ? ` (chosen by ${requester.split(" ")[0]})` : ""}`, hint: `Available ${formatNaira(availableBalanceForSubhead(s))}` }))} />
                  <span className="v4-help">Change it if the requester chose the wrong one. A change needs a reason.</span>
                </div>
                {fig ? (
                  <div className="v4-balbox" style={{ flex: "1 1 300px" }}>
                    <div><span>ALLOCATION B/D:</span><span>{nairaExact(figBD)}</span></div>
                    <div><span>EXPENDITURE:</span><span>{nairaExact(thisAmount)}</span></div>
                    <div><span>BALANCE C/D:</span><span>{nairaExact(figCD)}</span></div>
                  </div>
                ) : null}
              </div>
              {changeSubTo && changeSubTo !== req.subhead_id ? (
                <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button type="button" className="v4-btn v4-btn-secondary" onClick={() => void changeConfirmedSubhead()} disabled={actingLocked}>{assigningSubhead ? "Changing…" : "Change subhead…"}</button>
                  <button type="button" className="v4-btn v4-btn-ghost" onClick={() => setChangeSubTo("")}>Keep the requester’s choice</button>
                </div>
              ) : null}
              <p className="v4-help" style={{ margin: "10px 0 0" }}><Icon name="lock" size="sm" /> These three figures are written on the request letter with your signature. The requester never sees the subhead balance.</p>
            </div>
          ) : null}

          {isDgStage && decision === "approve" ? (
            <div className="v4-stamp-preview" style={{ marginTop: 16 }}>
              <div className="v4-demo">
                {me?.signature_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={me.signature_url} alt="Your signature" style={{ position: "absolute", left: 18, bottom: 4, maxWidth: 140, maxHeight: 44, objectFit: "contain" }} />
                ) : null}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="v4-iet-stamp" src="/v4/iet-stamp.png" alt="IET stamp" />
              </div>
              <div><strong>What goes on the letter</strong><span>Your signature on “Approved by Director General, IET”, with the blue IET stamp placed just beside it. Your signature stays visible, and nothing on the letter moves.</span></div>
            </div>
          ) : null}

          {usesAutomaticAccountOfficerRouting && decision === "approve" && !isDgStage ? (
            <Notice tone="green">Account Officer: {req.assigned_account_officer_name ? nameWithRole(req.assigned_account_officer_name, "accountofficer") : "set from the subhead"}.</Notice>
          ) : null}

          <label className="v4-field" style={{ marginTop: 14 }}>
            <span className="v4-flabel">Comment <span className="v4-muted" style={{ fontWeight: 600 }}>{decision === "reject" ? "(the reason — required)" : "(optional)"}</span></span>
            <input className="v4-input" value={comment} onChange={(e) => setComment(e.target.value)} placeholder={decision === "reject" ? "e.g. Attach the quotation and resubmit" : isDgStage ? "e.g. Approved" : "e.g. Approved — within the budget"} />
          </label>

          {attachmentsLocked ? <Notice tone="amber">Open and tick every attachment below before you decide ({myPendingAttachments.length} left).</Notice> : null}
          {needsSubheadAssignment && decision === "approve" ? <Notice tone="blue">Assign the subhead first; approval unlocks once the fund is reserved.</Notice> : null}

          <div className="v4-form-actions" style={{ marginTop: 16 }}>
            <Link className="v4-btn v4-btn-ghost" href={embedded ? "#" : "/approvals/inbox"} onClick={(e) => { if (embedded) { e.preventDefault(); onClose?.(); } }}>Back to the list</Link>
            {isDgStage ? <Link className="v4-btn v4-btn-secondary" href={`/requests/${req.id}/print`}><Icon name="eye" />Preview letter</Link> : null}
            {decision === "reject" && !isAccountStage && !isHRFiling ? (
              <button type="button" className="v4-btn v4-btn-danger v4-btn-lg" onClick={() => openFresh2faModal("Reject")} disabled={actingLocked || attachmentsLocked || comment.trim().length < 3}>
                <Icon name="returned" />{saving || verifyingCode ? "Working…" : "Reject and send back"}</button>
            ) : (
              <button type="button" className="v4-btn v4-btn-primary v4-btn-lg" onClick={() => openFresh2faModal("Approve")} disabled={actingLocked || attachmentsLocked || needsSubheadAssignment}>
                <Icon name={isDgStage ? "shield" : isAccountStage ? "wallet" : "pentool"} />
                {saving || verifyingCode ? "Working…" : isDgStage ? "Approve, sign and stamp" : isAccountStage ? (isPersonalFund ? "Record payment and send to HR" : "Record that the fund is released") : isHRFiling ? "Complete HR review" : "Sign and approve"}
              </button>
            )}
          </div>
          {(isDgStage || isAccountStage) && decision === "approve" ? <p className="v4-help" style={{ margin: "8px 0 0", textAlign: "right" }}><Icon name="fingerprint" size="sm" /> You confirm with your fingerprint or your 2FA code.</p> : null}
        </section>
      ) : null}

      {!canAct && !backWithMe && isOpen && isMyRequest && !canWithdraw && !canEditRequest ? (
        <Notice tone="blue">Your request is with the {stageTitle(req.current_stage)}. You are told as soon as it moves.</Notice>
      ) : null}

      <section className="v4-card v4-card-pad">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
          <h2 className="v4-h2">Approval route</h2><span className="v4-help">Each step shows who signed and when. A vacant step is skipped.</span>
        </div>
        {chainItems.length ? (
          <ol className="v4-chain">
            {chainItems.map((c) => (
              <li key={c.key} className={c.cls}>
                <span className="v4-st">{c.st}</span><strong>{c.who}</strong><span className="v4-r">{c.r}</span><em>{c.em}</em>
                <span className="v4-ink">{c.ink ? <span className="v4-chip v4-chip-green"><Icon name="pentool" size="sm" />Signed</span> : null}</span>
              </li>
            ))}
          </ol>
        ) : <p className="v4-muted" style={{ margin: 0 }}>{stageWords(req.current_stage)}.</p>}
      </section>

      <div className="v4-cols">
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <section className="v4-card v4-card-pad">
            <h2 className="v4-h2" style={{ marginBottom: 12 }}>Details</h2>
            <p style={{ margin: "0 0 16px", whiteSpace: "pre-wrap" }}>{req.details}</p>
            <span className="v4-label">Attachments</span>
            {attachments.length ? (
              <ul className="v4-files" style={{ marginTop: 8 }}>
                {attachments.map((a) => {
                  const mine = isAttachmentCheckedByMe(a.id);
                  return (
                    <li key={a.id}>
                      <span className={`v4-fi${/\.(png|jpe?g|webp|xlsx?|csv)$/i.test(a.file_name) ? " v4-x" : ""}`}>{(a.file_name.split(".").pop() || "FILE").toUpperCase().slice(0, 4)}</span>
                      <span className="v4-ft"><strong>{a.file_name}</strong><span>{fileSizeLabel(a.file_size)}{attachmentCheckCount(a.id) ? ` · checked by ${attachmentCheckCount(a.id)} officer${attachmentCheckCount(a.id) === 1 ? "" : "s"}` : ""}{mine ? " · checked by you" : ""}</span></span>
                      {a.signed_url ? <a href={a.signed_url} target="_blank" rel="noreferrer">View</a> : <span className="v4-muted">Unavailable</span>}
                      {canCheckAttachments && !mine && canAct ? (
                        <button type="button" className="v4-btn v4-btn-secondary" style={{ minHeight: 36 }} onClick={() => void checkAttachmentPersonally(a)} disabled={checkingAttachmentId === a.id}>{checkingAttachmentId === a.id ? "Saving…" : "I have checked it"}</button>
                      ) : mine ? <span className="v4-chip v4-chip-green">Checked</span> : null}
                    </li>
                  );
                })}
              </ul>
            ) : <p className="v4-muted" style={{ margin: "6px 0 0" }}>No attachment.</p>}
          </section>
          <section className="v4-card">
            <div className="v4-card-head"><h2 className="v4-h2">History</h2><span className="v4-help">Every action, with the position used.</span></div>
            {history.length ? (
              <ul className="v4-timeline" style={{ padding: "16px 20px 0" }}>
                {history.map((h) => {
                  const look = historyLook(h);
                  return (
                    <li key={h.id}>
                      <span className={`v4-ti v4-t-${look.tone}`}><Icon name={look.icon} /></span>
                      <span><strong>{look.text}</strong>{h.comment ? <span>“{h.comment}”</span> : null}</span>
                      <span className="v4-time">{shortWhen(h.created_at)}</span>
                    </li>
                  );
                })}
              </ul>
            ) : <p className="v4-muted" style={{ padding: "16px 20px", margin: 0 }}>No history yet.</p>}
          </section>
        </div>
        <aside className="v4-side-stack" style={{ position: "static" }}>
          {balanceViewer && fig && (isOfficial || isPersonalFund) ? (
            <section className="v4-card v4-card-pad">
              <h2 className="v4-h3" style={{ marginBottom: 12 }}>{subText}</h2>
              <dl className="v4-kv">
                <dt>Approved budget</dt><dd>{nairaExact(figAllocation)}</dd>
                <dt>Spent</dt><dd>{nairaExact(figExpenditure)}</dd>
                <dt>Reserved (others)</dt><dd>{nairaExact(figReservedOthers)}</dd>
                <dt>This request</dt><dd>{nairaExact(thisAmount)}</dd>
                <dt>Left after</dt><dd style={{ color: figCD >= 0 ? "var(--v4-green)" : "var(--v4-red)" }}>{nairaExact(figCD)}</dd>
              </dl>
              <div className="v4-meter" style={{ marginTop: 12 }} aria-label={`${usedPct}% of the budget used`}><span style={{ width: `${usedPct}%`, background: "var(--v4-brand)" }} /></div>
              <span className="v4-help">{usedPct}% used after this request</span>
            </section>
          ) : null}
          <section className="v4-card v4-card-pad">
            <h2 className="v4-h3" style={{ marginBottom: 10 }}>At a glance</h2>
            <dl className="v4-kv">
              <dt>Status</dt><dd><span className={`v4-chip v4-chip-${chip.tone}`}>{chip.label}</span></dd>
              <dt>Where</dt><dd>{stageWords(req.current_stage)}</dd>
              {req.assigned_account_officer_name && !isHRContext ? <><dt>Account Officer</dt><dd>{req.assigned_account_officer_name}</dd></> : null}
              <dt>Attachments</dt><dd>{attachments.length}</dd>
            </dl>
          </section>
          {mfaVerified ? null : <Notice tone="amber">This session has not passed 2FA yet; you are asked for your fingerprint or code before signing.</Notice>}
        </aside>
      </div>

      {showMfaModal ? (
        <div className="v4-newreq-otp" role="dialog" aria-modal="true" aria-labelledby="rq-2fa-title">
          <div className="v4-card v4-card-pad">
            <span className="v4-ico v4-t-brand" style={{ width: 52, height: 52, borderRadius: 16, display: "grid", placeItems: "center", margin: "0 auto 10px" }}><Icon name="shield" /></span>
            <h2 id="rq-2fa-title" className="v4-h2" style={{ textAlign: "center" }}>Confirm it is you</h2>
            <p className="v4-muted" style={{ textAlign: "center", margin: "6px 0 16px", fontSize: 13.5 }}>
              Type the 6-number code from your authenticator app. It is checked as soon as you type the sixth number.
            </p>
            <input className="v4-input v4-num" autoFocus inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={mfaCode} disabled={verifyingCode || saving}
              style={{ textAlign: "center", fontSize: 24, letterSpacing: ".4em", fontWeight: 800 }} aria-label="Six-number code"
              onChange={(e) => { const v = e.target.value.replace(/\D/g, "").slice(0, 6); setMfaCode(v); if (v.length === 6 && !verifyingCode && !saving) setTimeout(() => { void verifyCodeAndContinue(v); }, 120); }} />
            <div className="v4-form-actions" style={{ marginTop: 16 }}>
              <button type="button" className="v4-btn v4-btn-ghost" disabled={verifyingCode || saving}
                onClick={() => { setShowMfaModal(false); setMfaCode(""); setPendingAction(null); mfaAutoSubmittingRef.current = false; }}>Cancel</button>
              {canUseFingerprint ? <button type="button" className="v4-btn v4-btn-secondary" onClick={() => void confirmWithFingerprint()} disabled={verifyingCode || saving}><Icon name="fingerprint" />Use fingerprint</button> : null}
              <button type="button" className="v4-btn v4-btn-primary" onClick={() => void verifyCodeAndContinue()} disabled={verifyingCode || saving || mfaCode.length !== 6}>{verifyingCode || saving ? "Checking…" : "Confirm"}</button>
            </div>
          </div>
        </div>
      ) : null}
    </V4Page>
  );
}

function shortWhen(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}
