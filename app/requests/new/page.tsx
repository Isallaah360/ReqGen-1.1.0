"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Dept = {
  id: string;
  name: string;
  hod_user_id: string | null;
  director_user_id: string | null;
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
  signature_url: string | null;
};

const MAX_ATTACHMENTS = 50;
const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

function naira(n: number) {
  return "₦" + Math.round(n || 0).toLocaleString();
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

export default function NewRequestPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [uploadingAttachments, setUploadingAttachments] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [me, setMe] = useState<ProfileMini | null>(null);
  const [hasVerifiedTotp, setHasVerifiedTotp] = useState(false);
  const [totpFactorId, setTotpFactorId] = useState<string | null>(null);

  const [showMfaModal, setShowMfaModal] = useState(false);
  const [mfaCode, setMfaCode] = useState("");

  const [requestType, setRequestType] = useState<"Official" | "Personal">("Official");
  const [personalCategory, setPersonalCategory] = useState<"Fund" | "NonFund">("Fund");

  const [depts, setDepts] = useState<Dept[]>([]);
  const [subs, setSubs] = useState<Subhead[]>([]);

  const [deptId, setDeptId] = useState("");
  const [subheadId, setSubheadId] = useState("");
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [details, setDetails] = useState("");

  const [attachments, setAttachments] = useState<File[]>([]);

  const isOfficial = requestType === "Official";
  const isPersonal = requestType === "Personal";
  const isPersonalFund = requestType === "Personal" && personalCategory === "Fund";
  const isPersonalNonFund = requestType === "Personal" && personalCategory === "NonFund";

  async function loadMfaFactors() {
    const { data: auth } = await supabase.auth.getUser();

    if (!auth.user) {
      router.push("/login");
      return false;
    }

    const { data, error } = await supabase.auth.mfa.listFactors();

    if (error) {
      setHasVerifiedTotp(false);
      setTotpFactorId(null);
      return false;
    }

    const verifiedFactor = data.totp.find((factor) => factor.status === "verified");

    setHasVerifiedTotp(Boolean(verifiedFactor));
    setTotpFactorId(verifiedFactor?.id || null);

    return Boolean(verifiedFactor);
  }

  async function loadAll() {
    setLoading(true);
    setMsg(null);

    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      router.push("/login");
      return;
    }

    const has2fa = await loadMfaFactors();

    if (!has2fa) {
      setMsg("❌ You must set up 2FA before creating requests.");
      router.push("/mfa/setup");
      setLoading(false);
      return;
    }

    const { data: prof, error: profErr } = await supabase
      .from("profiles")
      .select("id,full_name,email,signature_url")
      .eq("id", auth.user.id)
      .single();

    if (profErr) {
      setMsg("Failed to load your profile: " + profErr.message);
      setLoading(false);
      return;
    }

    setMe((prof || null) as ProfileMini);

    const { data: deptRows, error: deptErr } = await supabase
      .from("departments")
      .select("id,name,hod_user_id,director_user_id,is_active")
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

    if (deptList.length > 0) {
      const firstDept = deptList[0];
      setDeptId(firstDept.id);

      const firstSub = subList.find((s) => s.dept_id === firstDept.id);
      if (firstSub) setSubheadId(firstSub.id);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredSubs = useMemo(() => {
    return subs.filter((s) => s.dept_id === deptId);
  }, [subs, deptId]);

  const selectedSubhead = useMemo(() => {
    return subs.find((s) => s.id === subheadId) || null;
  }, [subs, subheadId]);

  const totalAttachmentSize = useMemo(() => {
    return attachments.reduce((sum, file) => sum + file.size, 0);
  }, [attachments]);

  useEffect(() => {
    if (!isOfficial) {
      setSubheadId("");
      return;
    }

    const first = filteredSubs[0];
    setSubheadId(first?.id || "");
  }, [deptId, filteredSubs, isOfficial]);

  useEffect(() => {
    if (isPersonalNonFund) {
      setAmount("");
    }
  }, [isPersonalNonFund]);

  const availableBalance = useMemo(() => {
    if (!selectedSubhead) return 0;

    const allocation = Number(selectedSubhead.approved_allocation || 0);
    const reserved = Number(selectedSubhead.reserved_amount || 0);
    const expenditure = Number(selectedSubhead.expenditure || 0);

    return allocation - reserved - expenditure;
  }, [selectedSubhead]);

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

  function validateRequestForm() {
    if (!hasVerifiedTotp || !totpFactorId) {
      setMsg("❌ You must set up 2FA before submitting requests.");
      router.push("/mfa/setup");
      return false;
    }

    if (!me) {
      setMsg("❌ Your profile is not loaded.");
      return false;
    }

    if (!me.full_name || !me.full_name.trim()) {
      setMsg("❌ Please update your full name in Profile before creating request.");
      return false;
    }

    if (!me.signature_url || !me.signature_url.trim()) {
      setMsg("❌ Please upload your signature in Profile before creating request.");
      return false;
    }

    if (!deptId) {
      setMsg("❌ Please select department.");
      return false;
    }

    if (!title.trim()) {
      setMsg("❌ Please enter title.");
      return false;
    }

    if (!details.trim()) {
      setMsg("❌ Please enter details.");
      return false;
    }

    if (attachments.length > MAX_ATTACHMENTS) {
      setMsg(`❌ Maximum ${MAX_ATTACHMENTS} attachments are allowed per request.`);
      return false;
    }

    const tooLarge = attachments.find((file) => file.size > MAX_FILE_SIZE_BYTES);
    if (tooLarge) {
      setMsg(`❌ "${tooLarge.name}" is too large. Maximum file size is ${MAX_FILE_SIZE_MB}MB.`);
      return false;
    }

    const amt = isPersonalNonFund ? 0 : Number(amount || 0);

    if ((isOfficial || isPersonalFund) && (!amt || amt <= 0)) {
      setMsg("❌ Enter a valid amount.");
      return false;
    }

    if (isOfficial && !subheadId) {
      setMsg("❌ Please select subhead for Official Request.");
      return false;
    }

    if (isOfficial && !selectedSubhead) {
      setMsg("❌ Selected subhead not found.");
      return false;
    }

    if (isOfficial && amt > availableBalance) {
      setMsg(`❌ Amount exceeds available balance (${naira(availableBalance)}).`);
      return false;
    }

    const dept = depts.find((d) => d.id === deptId);
    if (!dept) {
      setMsg("❌ Department not found.");
      return false;
    }

    const firstOwner = dept.director_user_id || dept.hod_user_id || null;
    const firstStage = dept.director_user_id ? "Director" : dept.hod_user_id ? "HOD" : null;

    if (!firstOwner || !firstStage) {
      setMsg("❌ This department does not have Director/HOD routing set yet in Admin Panel.");
      return false;
    }

    return true;
  }

  async function openSubmitVerification() {
    setMsg(null);

    const ok = validateRequestForm();
    if (!ok) return;

    setMfaCode("");
    setShowMfaModal(true);
  }

  async function verifyCodeAndSubmit() {
    setMsg(null);

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

      setShowMfaModal(false);
      setMfaCode("");

      await submitRequestAfterFresh2fa();
    } catch (e: any) {
      setMsg("❌ 2FA verification failed: " + (e?.message || "Invalid code."));
    } finally {
      setVerifyingCode(false);
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

  async function submitRequestAfterFresh2fa() {
    if (!me) {
      setMsg("❌ Your profile is not loaded.");
      return;
    }

    const stillValid = validateRequestForm();
    if (!stillValid) return;

    const amt = isPersonalNonFund ? 0 : Number(amount || 0);

    setSaving(true);

    try {
      const requestNo = buildRequestNo();
      const requesterName = me.full_name!.trim();

      const { data, error } = await supabase.rpc("submit_request_with_reservation", {
        p_title: title.trim(),
        p_details: details.trim(),
        p_amount: amt,
        p_dept_id: deptId,
        p_subhead_id: isOfficial ? subheadId : null,
        p_request_type: requestType,
        p_personal_category: isPersonal ? personalCategory : null,
        p_created_by: me.id,
        p_requester_name: requesterName,
        p_requester_signature: me.signature_url,
        p_request_no: requestNo,
      });

      if (error) throw new Error(error.message);

      const requestId = (data as any)?.request_id;
      if (!requestId) {
        throw new Error("Request was submitted but no request ID was returned.");
      }

      let uploadedCount = 0;

      if (attachments.length > 0) {
        const result = await uploadAttachmentsForRequest(requestId);
        uploadedCount = result.uploaded;
      }

      setMsg(
        `✅ Request submitted successfully after 2FA verification. ${
          uploadedCount > 0 ? `${uploadedCount} attachment(s) uploaded. ` : ""
        }Routed to ${(data as any)?.first_stage || "next officer"}.`
      );

      setTitle("");
      setAmount("");
      setDetails("");
      setAttachments([]);

      await loadAll();

      setTimeout(() => {
        router.push(`/requests/${requestId}`);
      }, 900);
    } catch (e: any) {
      setMsg("❌ Submit failed: " + (e?.message || "Unknown error"));
    } finally {
      setSaving(false);
      setUploadingAttachments(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 px-4">
        <div className="mx-auto max-w-5xl py-10 text-slate-600">Loading...</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4">
      <div className="mx-auto max-w-5xl py-10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
              New Request
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Every request submission requires a fresh 2FA code. Attachments are optional and can
              be verified during approval.
            </p>
          </div>

          <button
            type="button"
            onClick={() => router.push("/requests")}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100"
          >
            Back to Requests
          </button>
        </div>

        <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-900">
          2FA protection is active. You must enter your authenticator code when submitting this
          request. Attachments are optional, but any uploaded attachment will require officer
          verification during the approval process.
        </div>

        {msg && (
          <div className="mt-4 rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-800">
            {msg}
          </div>
        )}

        <div className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-semibold text-slate-800">Request Type</label>
              <select
                value={requestType}
                onChange={(e) => {
                  const v = e.target.value as "Official" | "Personal";
                  setRequestType(v);

                  if (v === "Official") {
                    setPersonalCategory("Fund");
                    const first = filteredSubs[0];
                    setSubheadId(first?.id || "");
                  } else {
                    setSubheadId("");
                  }
                }}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
              >
                <option value="Official">Official</option>
                <option value="Personal">Personal</option>
              </select>
            </div>

            {isPersonal && (
              <div>
                <label className="text-sm font-semibold text-slate-800">
                  Personal Category
                </label>
                <select
                  value={personalCategory}
                  onChange={(e) => {
                    const v = e.target.value as "Fund" | "NonFund";
                    setPersonalCategory(v);

                    if (v === "NonFund") {
                      setAmount("");
                    }
                  }}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                >
                  <option value="Fund">Fund</option>
                  <option value="NonFund">NonFund</option>
                </select>
              </div>
            )}

            <div>
              <label className="text-sm font-semibold text-slate-800">Department</label>
              <select
                value={deptId}
                onChange={(e) => setDeptId(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
              >
                {depts.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>

            {isOfficial && (
              <div>
                <label className="text-sm font-semibold text-slate-800">Subhead</label>
                <select
                  value={subheadId}
                  onChange={(e) => setSubheadId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                >
                  {filteredSubs.length === 0 ? (
                    <option value="">No active subhead for this department</option>
                  ) : (
                    filteredSubs.map((s) => (
                      <option key={s.id} value={s.id}>
                        {(s.code ? `${s.code} — ` : "") + s.name}
                      </option>
                    ))
                  )}
                </select>

                <div className="mt-3 grid gap-2 text-sm font-semibold text-slate-700 sm:grid-cols-4">
                  <div className="rounded-xl bg-slate-50 p-3">
                    <div className="text-xs text-slate-500">Allocation</div>
                    <div className="mt-1 text-slate-900">
                      {naira(Number(selectedSubhead?.approved_allocation || 0))}
                    </div>
                  </div>

                  <div className="rounded-xl bg-amber-50 p-3">
                    <div className="text-xs text-amber-700">Reserved</div>
                    <div className="mt-1 text-amber-800">
                      {naira(Number(selectedSubhead?.reserved_amount || 0))}
                    </div>
                  </div>

                  <div className="rounded-xl bg-red-50 p-3">
                    <div className="text-xs text-red-700">Expenditure</div>
                    <div className="mt-1 text-red-800">
                      {naira(Number(selectedSubhead?.expenditure || 0))}
                    </div>
                  </div>

                  <div className="rounded-xl bg-emerald-50 p-3">
                    <div className="text-xs text-emerald-700">Balance</div>
                    <div className="mt-1 text-emerald-800">
                      {naira(Number(selectedSubhead?.balance || 0))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {isPersonalFund && (
              <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900 md:col-span-2">
                Personal Fund Request does not use a subhead and will not deduct from departmental
                allocation. It will pass through HR, Registry, DG, and then the selected Account
                Officer for treatment.
              </div>
            )}

            {isPersonalNonFund && (
              <div className="rounded-xl border border-purple-100 bg-purple-50 px-4 py-3 text-sm text-purple-900 md:col-span-2">
                Personal NonFund Request does not use subhead or amount. It will pass through HR,
                Registry, DG, and then return to HR for final filing.
              </div>
            )}

            <div>
              <label className="text-sm font-semibold text-slate-800">Title</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                placeholder="Request title"
              />
            </div>

            {(isOfficial || isPersonalFund) && (
              <div>
                <label className="text-sm font-semibold text-slate-800">Amount (₦)</label>
                <input
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  type="number"
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                  placeholder="0"
                />
              </div>
            )}

            {isPersonalNonFund && (
              <div>
                <label className="text-sm font-semibold text-slate-800">Amount</label>
                <input
                  value="Not Applicable"
                  readOnly
                  disabled
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-500"
                />
              </div>
            )}

            <div className="md:col-span-2">
              <label className="text-sm font-semibold text-slate-800">Details</label>
              <textarea
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                className="mt-1 min-h-[160px] w-full rounded-xl border border-slate-200 px-3 py-2"
                placeholder="Write request details..."
              />
            </div>

            <div className="md:col-span-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <label className="text-sm font-extrabold text-slate-900">
                      Supporting Attachments
                    </label>
                    <p className="mt-1 text-sm text-slate-600">
                      Optional. Upload up to {MAX_ATTACHMENTS} documents. Each file must be
                      {` ${MAX_FILE_SIZE_MB}MB`} or below.
                    </p>
                  </div>

                  {attachments.length > 0 && (
                    <button
                      type="button"
                      onClick={clearAttachments}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-900 hover:bg-slate-100"
                    >
                      Clear All
                    </button>
                  )}
                </div>

                <input
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.webp,.txt"
                  onChange={(e) => {
                    handleAttachmentSelect(e.target.files);
                    e.target.value = "";
                  }}
                  className="mt-4 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900"
                />

                <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs leading-5 text-blue-900">
                  Accepted examples: PDF, Word, Excel, images and text files. Uploaded files will
                  show as <b>Pending Verification</b> until an authorized officer reviews them.
                </div>

                {attachments.length > 0 && (
                  <div className="mt-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-sm font-bold text-slate-900">
                        Selected Files: {attachments.length}
                      </div>
                      <div className="text-xs font-semibold text-slate-500">
                        Total size: {fileSizeLabel(totalAttachmentSize)}
                      </div>
                    </div>

                    <div className="mt-3 space-y-2">
                      {attachments.map((file, index) => (
                        <div
                          key={`${file.name}-${file.size}-${file.lastModified}`}
                          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white px-4 py-3"
                        >
                          <div className="min-w-0">
                            <div className="break-words text-sm font-bold text-slate-900">
                              {index + 1}. {file.name}
                            </div>
                            <div className="mt-1 text-xs font-semibold text-slate-500">
                              {file.type || "Unknown type"} • {fileSizeLabel(file.size)}
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => removeAttachment(index)}
                            className="rounded-xl bg-red-600 px-3 py-2 text-xs font-bold text-white hover:bg-red-700"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={openSubmitVerification}
            disabled={saving || verifyingCode || uploadingAttachments}
            className="mt-5 w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {saving
              ? uploadingAttachments
                ? "Uploading Attachments..."
                : "Submitting..."
              : verifyingCode
              ? "Verifying 2FA..."
              : "Submit Request with 2FA"}
          </button>
        </div>
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
              Enter the 6-digit code from your authenticator app. This request will not be submitted
              until the code is verified.
            </p>

            {attachments.length > 0 && (
              <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-900">
                {attachments.length} attachment(s) will be uploaded after this 2FA verification.
              </div>
            )}

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
                }}
                disabled={verifyingCode || saving}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 hover:bg-slate-100 disabled:opacity-60"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={verifyCodeAndSubmit}
                disabled={verifyingCode || saving || mfaCode.trim().length !== 6}
                className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {verifyingCode || saving ? "Verifying..." : "Verify & Submit"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}