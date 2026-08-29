"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { WorkflowLoading } from "@/app/components/ui/WorkflowUI";
import {
  AlertCircle,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  CircleHelp,
  FileText,
  FolderOpen,
  Info,
  Landmark,
  Paperclip,
  Send,
  ShieldCheck,
  UploadCloud,
  UserRound,
  X,
} from "lucide-react";
import styles from "./new-request.module.css";

type Dept = {
  id: string;
  name: string;
  hod_user_id: string | null;
  director_user_id: string | null;
  po_id?: string | null;
  is_active?: boolean | null;
};

type Subhead = {
  id: string;
  dept_id: string;
  code: string | null;
  name: string;
  approved_allocation: number | null;
  balance: number | null;
  expenditure: number | null;
  reserved_amount: number | null;
  is_active: boolean | null;
};

type ProfileMini = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string | null;
  phone: string | null;
  signature_url: string | null;
};

type ProfileRole = {
  id: string;
  profile_id: string;
  role_key: string;
  role_name: string;
  is_primary: boolean;
  is_active: boolean;
};

type RequestType = "Official" | "Personal";
type PersonalCategory = "Fund" | "Leave" | "Contract Renewal" | "Resignation" | "Others";
type RequestOtpChannel = "sms" | "email" | "sms_email" | "email_sms";

const MAX_ATTACHMENTS = 50;
const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

const PERSONAL_CATEGORIES: PersonalCategory[] = [
  "Fund",
  "Leave",
  "Contract Renewal",
  "Resignation",
  "Others",
];

const FINANCE_VISIBLE_ROLES = [
  "admin",
  "auditor",
  "director",
  "dod",
  "hod",
  "hr",
  "hrofficer1",
  "hrofficer2",
  "hrofficer3",
  "registry",
  "dg",
  "account",
  "accounts",
  "accountofficer",
  "registrar",
  "dinadmin",
  "dinadmin1",
  "dinadmin2",
  "dinadmin3",
  "po",
];

const requestOtpEnabled = process.env.NEXT_PUBLIC_REQGEN_REQUEST_OTP_ENABLED === "true";

const requestNotificationsEnabled =
  process.env.NEXT_PUBLIC_REQGEN_NOTIFICATIONS_ENABLED === "true";

function configuredOtpChannel(): RequestOtpChannel {
  const raw = String(process.env.NEXT_PUBLIC_REQGEN_REQUEST_OTP_CHANNEL || "sms")
    .trim()
    .toLowerCase();

  if (raw === "email") return "email";
  if (raw === "sms_email") return "sms_email";
  if (raw === "email_sms") return "sms_email";
  return "sms";
}

const requestOtpChannel = configuredOtpChannel();

function isDualOtpChannel(channel: RequestOtpChannel | "unknown") {
  return channel === "sms_email" || channel === "email_sms";
}

function roleKey(role: string | null | undefined) {
  return (role || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/_/g, "");
}

function hasAnyRole(roleSet: Set<string>, roles: string[]) {
  return roles.some((r) => roleSet.has(roleKey(r)));
}

function naira(n: number) {
  return "₦" + Math.round(Number(n || 0)).toLocaleString();
}

function buildRequestNo() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const t = String(now.getTime()).slice(-6);
  return `REQ-${y}${m}-${t}`;
}

function cleanFileName(name: string) {
  const parts = name.split(".");
  const ext = parts.length > 1 ? parts.pop() || "" : "";
  const base = parts.join(".") || "attachment";

  const safeBase = base
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);

  const safeExt = ext
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 12);

  return safeExt ? `${safeBase || "attachment"}.${safeExt}` : safeBase || "attachment";
}

function fileSizeLabel(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

function maskEmail(email: string | null | undefined) {
  const clean = String(email || "").trim();

  if (!clean || !clean.includes("@")) return "—";

  const [name, domain] = clean.split("@");
  const visibleName =
    name.length <= 2 ? `${name.slice(0, 1)}***` : `${name.slice(0, 2)}***${name.slice(-1)}`;

  const domainParts = domain.split(".");
  const domainName = domainParts[0] || "";
  const domainExt = domainParts.slice(1).join(".");

  const visibleDomain =
    domainName.length <= 2
      ? `${domainName.slice(0, 1)}***`
      : `${domainName.slice(0, 2)}***${domainName.slice(-1)}`;

  return `${visibleName}@${visibleDomain}${domainExt ? `.${domainExt}` : ""}`;
}

function maskPhone(phone: string | null | undefined) {
  const raw = String(phone || "").replace(/\D/g, "");
  if (raw.length < 7) return phone || "—";
  return `${raw.slice(0, 4)}***${raw.slice(-3)}`;
}

function hasValidEmail(email: string | null | undefined) {
  const clean = String(email || "").trim();
  return !!clean && clean.includes("@");
}

function hasLikelyPhone(phone: string | null | undefined) {
  const raw = String(phone || "").replace(/\D/g, "");
  return raw.length >= 10;
}

function deptGroupName(name: string | null | undefined) {
  const clean = String(name || "").toUpperCase();

  if (clean.includes("DIN")) return "DIN";
  if (clean.includes("ASAP") || clean.includes("ALLI")) return "ASAP-ALLI";
  if (clean.includes("WELFARE")) return "Welfare";
  if (clean.includes("LIAISON")) return "Liaison";

  return "General Admin";
}

function isDinDepartment(name: string | null | undefined) {
  return deptGroupName(name) === "DIN";
}

function isAsapAlliDepartment(name: string | null | undefined) {
  return deptGroupName(name) === "ASAP-ALLI";
}

function routingNoteFor(type: RequestType, category: PersonalCategory, dept: Dept | null) {
  const group = deptGroupName(dept?.name);

  if (type === "Official") {
    if (group === "DIN") {
      return "DIN Official route: Staff → DOD → DIN Admin → Registrar → DG → AccountOfficer.";
    }

    if (group === "ASAP-ALLI") {
      return "ASAP-ALLI Official route: Staff → PO → DOD → HOD → DG → AccountOfficer.";
    }

    if (group === "Welfare" || group === "Liaison") {
      return `${group} Official route: Staff → DOD → DG → AccountOfficer.`;
    }

    return "General Admin Official route: Staff → HOD → DG → AccountOfficer.";
  }

  if (category === "Fund") {
    if (group === "ASAP-ALLI") {
      return "ASAP-ALLI Personal Fund route: Staff → DOD → HOD → HR → DG → AccountOfficer → HR Filing → Staff & DOD/HOD.";
    }

    if (group === "General Admin") {
      return "General Admin Personal Fund route: Staff → HOD → HR → DG → AccountOfficer → HR Filing → Staff & HOD.";
    }

    return `${group} Personal Fund route: Staff → DOD → HR → DG → AccountOfficer → HR Filing → Staff & DOD.`;
  }

  if (group === "ASAP-ALLI") {
    return "ASAP-ALLI Personal Other route: Staff → DOD → HOD → HR → DG → HR Filing → Staff & DOD/HOD.";
  }

  if (group === "General Admin") {
    return "General Admin Personal Other route: Staff → HOD → HR → DG → HR Filing → Staff & HOD.";
  }

  return `${group} Personal Other route: Staff → DOD → HR → DG → HR Filing → Staff & DOD.`;
}

function roleSummary(fallbackRole: string | null | undefined, roles: ProfileRole[]) {
  const active = roles.filter((r) => r.is_active);

  if (active.length === 0) return fallbackRole || "Staff";

  return active
    .slice()
    .sort((a, b) => {
      if (a.is_primary && !b.is_primary) return -1;
      if (!a.is_primary && b.is_primary) return 1;
      return a.role_name.localeCompare(b.role_name);
    })
    .map((r) => r.role_name)
    .join(", ");
}

export default function NewRequestPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [uploadingAttachments, setUploadingAttachments] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [me, setMe] = useState<ProfileMini | null>(null);
  const [myRoles, setMyRoles] = useState<ProfileRole[]>([]);

  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpChannel, setOtpChannel] = useState<RequestOtpChannel | "unknown">("unknown");

  const otpAutoSubmittingRef = useRef(false);

  const [requestType, setRequestType] = useState<RequestType>("Official");
  const [personalCategory, setPersonalCategory] = useState<PersonalCategory>("Fund");

  const [depts, setDepts] = useState<Dept[]>([]);
  const [subs, setSubs] = useState<Subhead[]>([]);
  const [deptId, setDeptId] = useState("");
  const [subheadId, setSubheadId] = useState("");

  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [details, setDetails] = useState("");

  const [attachments, setAttachments] = useState<File[]>([]);
  const [signedRequest, setSignedRequest] = useState(false);
  const [signedAt, setSignedAt] = useState<string | null>(null);

  const roleSet = useMemo(() => {
    const set = new Set<string>();

    if (me?.role) set.add(roleKey(me.role));

    myRoles.forEach((r) => {
      if (r.is_active) set.add(roleKey(r.role_key));
    });

    return set;
  }, [me?.role, myRoles]);

  const canSeeSubheads = hasAnyRole(roleSet, FINANCE_VISIBLE_ROLES);

  const isOfficial = requestType === "Official";
  const isPersonal = requestType === "Personal";
  const isPersonalFund = isPersonal && personalCategory === "Fund";
  const requiresAmount = isOfficial || isPersonalFund;

  const otpLabel =
    requestOtpChannel === "sms"
      ? "SMS OTP"
      : isDualOtpChannel(requestOtpChannel)
        ? "SMS/Email OTP"
        : "Email OTP";

  const otpDestinationLabel =
    requestOtpChannel === "sms"
      ? `your registered phone: ${maskPhone(me?.phone)}`
      : isDualOtpChannel(requestOtpChannel)
        ? `your registered phone: ${maskPhone(me?.phone)} and email: ${maskEmail(me?.email)}`
        : `your registered email: ${maskEmail(me?.email)}`;

  const selectedDept = useMemo(() => {
    return depts.find((d) => d.id === deptId) || null;
  }, [depts, deptId]);

  const selectedDeptIsDin = isDinDepartment(selectedDept?.name);
  const selectedDeptIsAsapAlli = isAsapAlliDepartment(selectedDept?.name);

  const filteredSubs = useMemo(() => {
    return subs.filter((s) => s.dept_id === deptId);
  }, [subs, deptId]);

  const selectedSubhead = useMemo(() => {
    return subs.find((s) => s.id === subheadId) || null;
  }, [subs, subheadId]);

  const totalAttachmentSize = useMemo(() => {
    return attachments.reduce((sum, file) => sum + file.size, 0);
  }, [attachments]);

  const availableBalance = useMemo(() => {
    if (!selectedSubhead) return 0;

    const allocation = Number(selectedSubhead.approved_allocation || 0);
    const reserved = Number(selectedSubhead.reserved_amount || 0);
    const expenditure = Number(selectedSubhead.expenditure || 0);

    return allocation - reserved - expenditure;
  }, [selectedSubhead]);

  const canSubmit = useMemo(() => {
    return signedRequest && !saving && !sendingOtp && !verifyingOtp && !uploadingAttachments;
  }, [signedRequest, saving, sendingOtp, verifyingOtp, uploadingAttachments]);

  async function loadAll() {
    setLoading(true);
    setMsg(null);

    const { data: auth } = await supabase.auth.getUser();

    if (!auth.user) {
      router.push("/login");
      return;
    }

    const [profRes, rolesRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("id,full_name,email,role,phone,signature_url")
        .eq("id", auth.user.id)
        .single(),

      supabase
        .from("profile_roles")
        .select("id,profile_id,role_key,role_name,is_primary,is_active")
        .eq("profile_id", auth.user.id)
        .eq("is_active", true),
    ]);

    if (profRes.error) {
      setMsg("Failed to load your profile: " + profRes.error.message);
      setLoading(false);
      return;
    }

    setMe((profRes.data || null) as ProfileMini);
    setMyRoles((rolesRes.data || []) as ProfileRole[]);

    const { data: deptRows, error: deptErr } = await supabase
      .from("departments")
      .select("id,name,hod_user_id,director_user_id,po_id,is_active")
      .eq("is_active", true)
      .order("name", { ascending: true });

    if (deptErr) {
      setMsg("Failed to load departments: " + deptErr.message);
      setLoading(false);
      return;
    }

    const deptList = (deptRows || []) as Dept[];
    setDepts(deptList);

    const { data: subRows, error: subErr } = await supabase
      .from("subheads")
      .select("id,dept_id,code,name,approved_allocation,balance,expenditure,reserved_amount,is_active")
      .eq("is_active", true)
      .order("name", { ascending: true });

    if (subErr) {
      setMsg("Failed to load subheads: " + subErr.message);
      setLoading(false);
      return;
    }

    const subList = (subRows || []) as Subhead[];
    setSubs(subList);

    if (deptList.length > 0 && !deptId) {
      const firstDept = deptList[0];
      setDeptId(firstDept.id);

      const firstSub = subList.find((s) => s.dept_id === firstDept.id);
      setSubheadId(firstSub?.id || "");
    }

    setLoading(false);
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isOfficial) {
      setSubheadId("");
      return;
    }

    if (isOfficial && canSeeSubheads) {
      const first = filteredSubs[0];
      setSubheadId(first?.id || "");
    }
  }, [isOfficial, canSeeSubheads, filteredSubs]);

  useEffect(() => {
    if (!requiresAmount) {
      setAmount("");
    }
  }, [requiresAmount]);

  useEffect(() => {
    setSignedRequest(false);
    setSignedAt(null);
    setOtpSent(false);
    setOtpCode("");
    setOtpChannel("unknown");
    otpAutoSubmittingRef.current = false;
  }, [
    requestType,
    personalCategory,
    deptId,
    subheadId,
    title,
    amount,
    details,
    attachments.length,
  ]);

  function handleAttachmentSelect(files: FileList | null) {
    setMsg(null);

    if (!files || files.length === 0) return;

    const incoming = Array.from(files);
    const combined = [...attachments, ...incoming];

    if (combined.length > MAX_ATTACHMENTS) {
      setMsg(`❌ Maximum ${MAX_ATTACHMENTS} attachments are allowed per request.`);
      return;
    }

    const tooLarge = incoming.find((file) => file.size > MAX_FILE_SIZE_BYTES);

    if (tooLarge) {
      setMsg(`❌ "${tooLarge.name}" is too large. Maximum file size is ${MAX_FILE_SIZE_MB}MB.`);
      return;
    }

    const unique: File[] = [];
    const seen = new Set<string>();

    for (const file of combined) {
      const key = `${file.name}-${file.size}-${file.lastModified}`;

      if (!seen.has(key)) {
        seen.add(key);
        unique.push(file);
      }
    }

    setAttachments(unique);
  }

  function removeAttachment(index: number) {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  }

  function clearAttachments() {
    setAttachments([]);
  }

  function selectedSubheadForSubmission() {
    if (!isOfficial) return null;
    if (!canSeeSubheads) return null;
    return subheadId || null;
  }

  function submissionAmount() {
    if (!requiresAmount) return 0;
    return Number(amount || 0);
  }

  function validateRequestForm(showMessage = true) {
    if (!me) {
      if (showMessage) setMsg("❌ Your profile is not loaded.");
      return false;
    }

    if (!me.full_name || !me.full_name.trim()) {
      if (showMessage) setMsg("❌ Please update your full name in Profile before creating request.");
      return false;
    }

    if (requestOtpEnabled) {
      if (requestOtpChannel === "sms" && !hasLikelyPhone(me.phone)) {
        if (showMessage) {
          setMsg("❌ Please add a valid registered phone number in Profile before requesting SMS OTP.");
        }
        return false;
      }

      if (requestOtpChannel === "email" && !hasValidEmail(me.email)) {
        if (showMessage) {
          setMsg("❌ Please add a valid registered email in Profile before requesting Email OTP.");
        }
        return false;
      }

      if (isDualOtpChannel(requestOtpChannel) && !hasLikelyPhone(me.phone) && !hasValidEmail(me.email)) {
        if (showMessage) {
          setMsg("❌ Please add a valid phone number or email in Profile before requesting OTP.");
        }
        return false;
      }
    }

    if (!me.signature_url || !me.signature_url.trim()) {
      if (showMessage) {
        setMsg("❌ Please upload your signature in Profile before signing this request.");
      }
      return false;
    }

    if (!requestType) {
      if (showMessage) setMsg("❌ Please select request type.");
      return false;
    }

    if (isPersonal && !personalCategory) {
      if (showMessage) setMsg("❌ Please select personal request category.");
      return false;
    }

    if (!deptId) {
      if (showMessage) setMsg("❌ Please select department.");
      return false;
    }

    if (!title.trim()) {
      if (showMessage) setMsg("❌ Please enter request title.");
      return false;
    }

    if (!details.trim()) {
      if (showMessage) setMsg("❌ Please enter request details.");
      return false;
    }

    const amt = submissionAmount();

    if (requiresAmount && (!amt || amt <= 0)) {
      if (showMessage) {
        setMsg(
          isOfficial
            ? "❌ Enter a valid amount for this Official request."
            : "❌ Enter a valid amount for this Personal Fund request."
        );
      }
      return false;
    }

    if (isOfficial && canSeeSubheads && subheadId && selectedSubhead && amt > availableBalance) {
      if (showMessage) {
        setMsg(`❌ Amount exceeds available balance for selected subhead (${naira(availableBalance)}).`);
      }
      return false;
    }

    if (attachments.length > MAX_ATTACHMENTS) {
      if (showMessage) setMsg(`❌ Maximum ${MAX_ATTACHMENTS} attachments are allowed per request.`);
      return false;
    }

    const tooLarge = attachments.find((file) => file.size > MAX_FILE_SIZE_BYTES);

    if (tooLarge) {
      if (showMessage) {
        setMsg(`❌ "${tooLarge.name}" is too large. Maximum file size is ${MAX_FILE_SIZE_MB}MB.`);
      }
      return false;
    }

    const dept = depts.find((d) => d.id === deptId);

    if (!dept) {
      if (showMessage) setMsg("❌ Department not found.");
      return false;
    }

    return true;
  }

  function signRequest() {
    setMsg(null);

    const ok = validateRequestForm(true);
    if (!ok) return;

    setSignedRequest(true);
    setSignedAt(new Date().toISOString());
    setOtpSent(false);
    setOtpCode("");
    setOtpChannel("unknown");
    otpAutoSubmittingRef.current = false;

    setMsg(
      requestOtpEnabled
        ? `✅ Request signed successfully. You can now submit with ${otpLabel}.`
        : "✅ Request signed successfully. You can now submit the signed request."
    );
  }

  async function sendRequestSubmissionOtp() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error("Session expired. Please login again.");
    }

    const response = await fetch("/api/otp/request-submission/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    const result = await response.json().catch(() => null);

    if (!response.ok || !result?.ok) {
      throw new Error(result?.error || `Could not send ${otpLabel}.`);
    }

    return result as {
      ok: boolean;
      message?: string;
      channel?: RequestOtpChannel;
      phone?: string | null;
      email?: string | null;
      smsWarning?: string | null;
      emailWarning?: string | null;
      expiresInMinutes?: number;
    };
  }

  async function openSubmitVerification() {
    setMsg(null);

    if (!signedRequest) {
      setMsg("❌ Please click Sign Request before submitting.");
      return;
    }

    const ok = validateRequestForm(true);
    if (!ok) return;

    if (!requestOtpEnabled) {
      await submitSignedRequest();
      return;
    }

    setSendingOtp(true);

    try {
      const result = await sendRequestSubmissionOtp();

      setOtpCode("");
      setOtpSent(true);
      setOtpChannel(result.channel || requestOtpChannel);
      setShowOtpModal(true);
      otpAutoSubmittingRef.current = false;

      if (result.channel === "sms") {
        setMsg("✅ SMS OTP sent to your registered phone number.");
      } else if (isDualOtpChannel(result.channel || requestOtpChannel)) {
        setMsg("✅ OTP sent by SMS and email.");
      } else {
        setMsg("✅ Email OTP sent to your registered email.");
      }
    } catch (e: any) {
      setMsg(`❌ Could not send ${otpLabel}: ` + (e?.message || "Unknown error."));
    } finally {
      setSendingOtp(false);
    }
  }

  async function verifyOtpAndSubmit(codeOverride?: string) {
    if (otpAutoSubmittingRef.current || verifyingOtp || saving) return;

    setMsg(null);

    const code = String(codeOverride || otpCode || "")
      .trim()
      .replace(/\D/g, "")
      .slice(0, 6);

    if (!/^\d{6}$/.test(code)) {
      setMsg(`❌ Enter the 6-digit ${otpLabel}.`);
      return;
    }

    otpAutoSubmittingRef.current = true;
    setVerifyingOtp(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error("Session expired. Please login again.");
      }

      const response = await fetch("/api/otp/request-submission/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ code }),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.ok) {
        throw new Error(result?.error || "OTP verification failed.");
      }

      setShowOtpModal(false);
      setOtpCode("");

      await submitSignedRequest();
    } catch (e: any) {
      setMsg(`❌ ${otpLabel} verification failed: ` + (e?.message || "Invalid OTP."));
      setOtpCode("");
    } finally {
      setVerifyingOtp(false);

      setTimeout(() => {
        otpAutoSubmittingRef.current = false;
      }, 800);
    }
  }

  async function uploadAttachmentsForRequest(requestId: string) {
    if (!me || attachments.length === 0) return { uploaded: 0 };

    setUploadingAttachments(true);

    try {
      const rows = [];

      for (let i = 0; i < attachments.length; i += 1) {
        const file = attachments[i];
        const safeName = cleanFileName(file.name);
        const path = `${requestId}/${Date.now()}-${i + 1}-${safeName}`;

        const { error: uploadErr } = await supabase.storage
          .from("request-attachments")
          .upload(path, file, {
            upsert: false,
            contentType: file.type || "application/octet-stream",
          });

        if (uploadErr) {
          throw new Error(`Attachment upload failed for "${file.name}": ${uploadErr.message}`);
        }

        rows.push({
          request_id: requestId,
          uploaded_by: me.id,
          file_name: file.name,
          file_path: path,
          file_type: file.type || null,
          file_size: file.size,
          verification_status: "Pending",
        });
      }

      const { error: insertErr } = await supabase.from("request_attachments").insert(rows);

      if (insertErr) {
        throw new Error("Attachment records could not be saved: " + insertErr.message);
      }

      return { uploaded: rows.length };
    } finally {
      setUploadingAttachments(false);
    }
  }

  async function sendRequestEventNotification(
    requestId: string,
    event: "submission_success" | "approval_pending"
  ) {
    if (!requestNotificationsEnabled) return;

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) return;

      await fetch("/api/notifications/sms/request-event", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ requestId, event }),
      });
    } catch (notifyErr) {
      console.warn("Request notification failed:", notifyErr);
    }
  }

  async function submitSignedRequest() {
    if (!me) {
      setMsg("❌ Your profile is not loaded.");
      return;
    }

    if (!signedRequest) {
      setMsg("❌ Please sign the request before submitting.");
      return;
    }

    const stillValid = validateRequestForm(true);

    if (!stillValid) return;

    const amt = submissionAmount();
    const requestNo = buildRequestNo();
    const requesterName = me.full_name!.trim();
    const submitSubheadId = selectedSubheadForSubmission();

    setSaving(true);

    try {
      const { data, error } = await supabase.rpc("submit_request_with_reservation", {
        p_title: title.trim(),
        p_details: details.trim(),
        p_amount: amt,
        p_dept_id: deptId,
        p_subhead_id: submitSubheadId,
        p_request_type: requestType,
        p_personal_category: isPersonal ? personalCategory : null,
        p_created_by: me.id,
        p_requester_name: requesterName,
        p_requester_signature: me.signature_url,
        p_request_no: requestNo,
      });

      if (error) throw new Error(error.message);

      const result = Array.isArray(data) ? (data[0] as any) : (data as any);
      const requestId = result?.request_id;

      if (!requestId) {
        throw new Error("Request was submitted but no request ID was returned.");
      }

      let uploadedCount = 0;

      if (attachments.length > 0) {
        const uploadResult = await uploadAttachmentsForRequest(requestId);
        uploadedCount = uploadResult.uploaded;
      }

      await sendRequestEventNotification(requestId, "submission_success");
      await sendRequestEventNotification(requestId, "approval_pending");

      const fundsState = result?.funds_state || "";
      const subheadNote =
        isOfficial && !submitSubheadId
          ? "Subhead assignment is pending approval review. "
          : fundsState === "Reserved"
            ? "Funds reserved from selected subhead. "
            : "";

      const routeNote = routingNoteFor(requestType, personalCategory, selectedDept);
      const categoryLabel = isPersonal ? `Personal ${personalCategory}` : "Official";

      setMsg(
        `✅ ${categoryLabel} request signed, OTP-verified and submitted successfully. ${subheadNote}${uploadedCount > 0 ? `${uploadedCount} attachment(s) uploaded. ` : ""
        }Routed to ${result?.first_stage || "next officer"}. ${routeNote}`
      );

      setTitle("");
      setAmount("");
      setDetails("");
      setAttachments([]);
      setRequestType("Official");
      setPersonalCategory("Fund");
      setSignedRequest(false);
      setSignedAt(null);
      setOtpSent(false);
      setOtpCode("");
      setOtpChannel("unknown");
      otpAutoSubmittingRef.current = false;

      await loadAll();

      setTimeout(() => {
        router.push(`/requests/${requestId}?updated=${Date.now()}`);
        router.refresh();
      }, 500);
    } catch (e: any) {
      setMsg("❌ Submit failed: " + (e?.message || "Unknown error"));
    } finally {
      setSaving(false);
      setUploadingAttachments(false);
    }
  }

  function saveDraftLocally() {
    try {
      localStorage.setItem(
        "reqgen-new-request-draft",
        JSON.stringify({
          requestType,
          personalCategory,
          deptId,
          subheadId,
          title,
          amount,
          details,
          savedAt: new Date().toISOString(),
        })
      );
      setMsg("✅ Draft saved on this device. Attachments are not stored in local drafts.");
    } catch {
      setMsg("❌ Draft could not be saved on this device.");
    }
  }

  if (loading) return <WorkflowLoading title="Preparing the new request workspace..." />;

  return (
    <main className={styles.page}>
      <div className={styles.pageInner}>
        <header className={styles.pageHeader}>
          <div>
            <h1>Create New Request</h1>
            <p>Submit a new request by providing the required details below.</p>
          </div>
          <div className={styles.breadcrumbs} aria-label="Breadcrumb">
            <button type="button" onClick={() => router.push("/requests")}>Requests</button>
            <span>›</span>
            <strong>Create New Request</strong>
          </div>
        </header>

        {msg && (
          <div className={`${styles.notice} ${msg.startsWith("❌") ? styles.noticeError : styles.noticeInfo}`}>
            {msg.startsWith("❌") ? <AlertCircle size={18} /> : <Info size={18} />}
            <span>{msg}</span>
          </div>
        )}

        <div className={styles.workspace}>
          <section className={styles.formCard}>
            <div className={styles.sectionBlock}>
              <h2>1. Request Information</h2>
              <div className={styles.twoCol}>
                <label className={styles.field}>
                  <span>Request Type <b>*</b></span>
                  <select
                    value={requestType}
                    onChange={(e) => {
                      const v = e.target.value as RequestType;
                      setRequestType(v);
                      if (v === "Personal") setSubheadId("");
                    }}
                  >
                    <option value="Official">Official Request</option>
                    <option value="Personal">Personal Request</option>
                  </select>
                </label>

                <label className={styles.field}>
                  <span>{isPersonal ? "Personal Category" : "Department"} <b>*</b></span>
                  {isPersonal ? (
                    <select value={personalCategory} onChange={(e) => setPersonalCategory(e.target.value as PersonalCategory)}>
                      {PERSONAL_CATEGORIES.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                  ) : (
                    <select value={deptId} onChange={(e) => setDeptId(e.target.value)}>
                      {depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  )}
                </label>
              </div>

              {isPersonal && (
                <label className={styles.field}>
                  <span>Department <b>*</b></span>
                  <select value={deptId} onChange={(e) => setDeptId(e.target.value)}>
                    {depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </label>
              )}

              <label className={styles.field}>
                <span>Request Title <b>*</b></span>
                <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Enter a short, descriptive title for your request" />
              </label>

              <label className={styles.field}>
                <span>Request Description <b>*</b></span>
                <textarea value={details} onChange={(e) => setDetails(e.target.value)} maxLength={2000} placeholder="Provide a detailed description of your request, including purpose and expected outcome..." />
                <small>{details.length} / 2000 characters</small>
              </label>
            </div>

            <div className={styles.sectionBlock}>
              <h2>2. Request Details</h2>
              <div className={styles.threeCol}>
                <label className={styles.field}>
                  <span>Department <b>*</b></span>
                  <select value={deptId} onChange={(e) => setDeptId(e.target.value)}>
                    {depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </label>

                {isOfficial && canSeeSubheads ? (
                  <label className={styles.field}>
                    <span>Subhead / Budget Line</span>
                    <select value={subheadId} onChange={(e) => setSubheadId(e.target.value)}>
                      <option value="">Assign later</option>
                      {filteredSubs.map((s) => (
                        <option key={s.id} value={s.id}>{(s.code ? `${s.code} — ` : "") + s.name}</option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <div className={styles.readOnlyField}>
                    <span>Budget Visibility</span>
                    <strong>{canSeeSubheads ? "Not required" : "Assigned during review"}</strong>
                  </div>
                )}

                <label className={styles.field}>
                  <span>Amount {requiresAmount && <b>*</b>}</span>
                  {requiresAmount ? (
                    <input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" min="0" placeholder="₦ 0.00" />
                  ) : (
                    <input value="Not Applicable" disabled readOnly />
                  )}
                </label>
              </div>

              <div className={styles.routeNote}>
                <ShieldCheck size={17} />
                <span>{routingNoteFor(requestType, personalCategory, selectedDept)}</span>
              </div>

              {isOfficial && canSeeSubheads && selectedSubhead && subheadId && (
                <div className={styles.balanceGrid}>
                  <div><span>Allocation</span><strong>{naira(Number(selectedSubhead.approved_allocation || 0))}</strong></div>
                  <div><span>Reserved</span><strong>{naira(Number(selectedSubhead.reserved_amount || 0))}</strong></div>
                  <div><span>Expenditure</span><strong>{naira(Number(selectedSubhead.expenditure || 0))}</strong></div>
                  <div><span>Available Balance</span><strong>{naira(availableBalance)}</strong></div>
                </div>
              )}
            </div>

            <div className={styles.sectionBlock}>
              <h2>3. Attachments</h2>
              <label className={styles.dropzone}>
                <UploadCloud size={34} />
                <div>
                  <strong>Drag and drop files here, or <span>click to browse</span></strong>
                  <p>Allowed: PDF, DOC, DOCX, XLS, XLSX, JPG, PNG, WEBP, TXT · Max {MAX_FILE_SIZE_MB}MB each</p>
                  <p>You can upload up to {MAX_ATTACHMENTS} files</p>
                </div>
                <input
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.webp,.txt"
                  onChange={(e) => {
                    handleAttachmentSelect(e.target.files);
                    e.target.value = "";
                  }}
                />
              </label>

              {attachments.length > 0 && (
                <div className={styles.attachmentsList}>
                  <div className={styles.attachmentsHeader}>
                    <strong>{attachments.length} attachment(s) · {fileSizeLabel(totalAttachmentSize)}</strong>
                    <button type="button" onClick={clearAttachments}>Clear all</button>
                  </div>
                  {attachments.map((file, index) => (
                    <div key={`${file.name}-${file.size}-${file.lastModified}`} className={styles.attachmentItem}>
                      <Paperclip size={16} />
                      <span>{file.name}</span>
                      <small>{fileSizeLabel(file.size)}</small>
                      <button type="button" aria-label={`Remove ${file.name}`} onClick={() => removeAttachment(index)}><X size={15} /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className={styles.signatureBlock}>
              <div>
                <h2>4. Review & Sign</h2>
                <p>Your saved profile signature is required before submission.</p>
                {signedRequest && signedAt ? (
                  <strong className={styles.signedText}>Signed by {me?.full_name || "Requester"} · {new Date(signedAt).toLocaleString()}</strong>
                ) : !me?.signature_url ? (
                  <strong className={styles.errorText}>No signature found. Upload your signature in My Profile first.</strong>
                ) : null}
              </div>
              <button
                type="button"
                className={`${styles.signButton} ${signedRequest ? styles.signedButton : ""}`}
                onClick={signRequest}
                disabled={!me?.signature_url || saving || sendingOtp || verifyingOtp}
              >
                <ShieldCheck size={17} />
                {signedRequest ? "Signed" : "Sign Request"}
              </button>
            </div>

            <footer className={styles.formActions}>
              <button type="button" className={styles.cancelButton} onClick={() => router.push("/requests")}>Cancel</button>
              <div>
                <button type="button" className={styles.draftButton} onClick={saveDraftLocally}>Save as Draft</button>
                <button type="button" className={styles.submitButton} onClick={openSubmitVerification} disabled={!canSubmit}>
                  <Send size={17} />
                  {saving
                    ? uploadingAttachments ? "Uploading Attachments..." : "Submitting..."
                    : sendingOtp ? `Sending ${otpLabel}...`
                    : verifyingOtp ? `Verifying ${otpLabel}...`
                    : signedRequest
                      ? requestOtpEnabled ? (otpSent ? `Continue with ${otpLabel}` : `Submit Request`) : "Submit Request"
                      : "Sign Request First"}
                </button>
              </div>
            </footer>
          </section>

          <aside className={styles.sideColumn}>
            <section className={styles.infoCard}>
              <div className={styles.cardTitle}><Info size={19} /><h3>Request Guidance</h3></div>
              <ul className={styles.guidanceList}>
                <li><CheckCircle2 size={15} />Provide a clear and concise title.</li>
                <li><CheckCircle2 size={15} />Add all relevant details in the description.</li>
                <li><CheckCircle2 size={15} />Select the correct request type and department.</li>
                <li><CheckCircle2 size={15} />Attach supporting documents if available.</li>
                <li><CheckCircle2 size={15} />Review and sign your request before submission.</li>
              </ul>
            </section>

            <section className={styles.infoCard}>
              <h3>Request Types</h3>
              <div className={styles.typeList}>
                <div><span className={styles.typeBlue}><BriefcaseBusiness size={17} /></span><p><strong>Official</strong><small>Institutional goods, services, works or official activity.</small></p></div>
                <div><span className={styles.typeGreen}><Landmark size={17} /></span><p><strong>Personal Fund</strong><small>Personal financial support routed through HR and Finance.</small></p></div>
                <div><span className={styles.typeOrange}><UserRound size={17} /></span><p><strong>Leave / HR</strong><small>Leave, renewal, resignation and HR-related requests.</small></p></div>
                <div><span className={styles.typePurple}><FolderOpen size={17} /></span><p><strong>Other Personal</strong><small>Other authorised personal request categories.</small></p></div>
              </div>
            </section>

            <section className={`${styles.infoCard} ${styles.helpCard}`}>
              <div className={styles.cardTitle}><CircleHelp size={20} /><h3>Need Help?</h3></div>
              <p>If you need assistance, use Help & Support or contact the System Administrator.</p>
              <button type="button" onClick={() => router.push("/docs")}>Visit Help Centre</button>
            </section>

            <section className={styles.securityCard}>
              <ShieldCheck size={20} />
              <div>
                <strong>Secure submission</strong>
                <p>{requestOtpEnabled ? `${otpLabel} verification is enabled for signed requests.` : "Profile signature verification is required before submission."}</p>
              </div>
            </section>
          </aside>
        </div>
      </div>

      {showOtpModal && requestOtpEnabled && (
        <div className={styles.modalBackdrop}>
          <div className={styles.modal}>
            <div className={styles.modalIcon}><ShieldCheck size={24} /></div>
            <h2>Verify request submission</h2>
            <p>
              Enter the 6-digit {otpLabel} sent to {otpChannel === "sms"
                ? `your registered phone ${maskPhone(me?.phone)}`
                : isDualOtpChannel(otpChannel)
                  ? `your registered phone ${maskPhone(me?.phone)} and email ${maskEmail(me?.email)}`
                  : `your registered email ${maskEmail(me?.email)}`}.
            </p>
            <input
              value={otpCode}
              onChange={(e) => {
                const nextCode = e.target.value.replace(/\D/g, "").slice(0, 6);
                setOtpCode(nextCode);
                if (nextCode.length === 6 && !verifyingOtp && !saving) {
                  setTimeout(() => verifyOtpAndSubmit(nextCode), 150);
                }
              }}
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              disabled={verifyingOtp || saving}
              placeholder="123456"
            />
            <small>{verifyingOtp || saving ? "Verifying automatically..." : "Verification starts after the sixth digit."}</small>
            <div className={styles.modalActions}>
              <button type="button" onClick={() => { if (!verifyingOtp && !saving) { setShowOtpModal(false); setOtpCode(""); otpAutoSubmittingRef.current = false; } }} disabled={verifyingOtp || saving}>Cancel</button>
              <button type="button" onClick={() => verifyOtpAndSubmit()} disabled={verifyingOtp || saving || otpCode.trim().length !== 6}>Verify & Submit</button>
            </div>
            <button type="button" className={styles.resendButton} onClick={openSubmitVerification} disabled={sendingOtp || verifyingOtp || saving}>{sendingOtp ? "Resending..." : `Resend ${otpLabel}`}</button>
          </div>
        </div>
      )}
    </main>
  );
}
