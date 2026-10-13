"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { routingNoteFor } from "@/lib/departmentRouting";
import { fetchRoutePreview } from "@/lib/routingEngine";
import { canSeeBudgetBalances } from "@/lib/v4/budgetVisibility";
import { stageTitle } from "@/lib/v4/requestText";
import { formatAmountInput, nairaExact, nairaInWords, parseAmount } from "@/lib/v4/money";
import { deleteDraft, loadDraft, saveDraft } from "@/lib/v4/drafts";
import { confirmDialog } from "@/lib/dialog";
import { useIdentity } from "@/app/components/v4/useIdentity";
import Icon from "@/app/components/v4/Icon";
import { Select, type SelectOption } from "@/app/components/v4/Select";
import { Notice, PageHead, Skeleton, V4Page } from "@/app/components/v4/ui";

/**
 * ReqGen v4.1.2 — New Request (mock-ups 25a and 25).
 *
 *   1 · Type          Official, or Personal with its category
 *   2 · Details       ONE department field, title, subhead, description, amount
 *   3 · Attachments
 *   4 · Sign & submit review, signature, route, then submit
 *
 * Budget figures follow the position the person is ACTING AS
 * (lib/v4/budgetVisibility): Staff, Registry and PD see only the live check
 * ("fund available" / "not enough"); approving officers, Finance, the Auditor
 * and the Super Admin see the subhead figures. Over budget is a hard block:
 * a draft can be saved, the request cannot be submitted.
 */

type RequestType = "Official" | "Personal";
type PersonalCategory = "Fund" | "Leave" | "Contract Renewal" | "Resignation" | "Others";
type OtpChannel = "sms" | "email" | "sms_email";
type Dept = { id: string; name: string };
type SubName = { id: string; code: string | null; name: string };
type SubFull = SubName & { dept_id: string; approved_allocation: number | null; reserved_amount: number | null; expenditure: number | null };
type Me = { id: string; full_name: string | null; email: string | null; phone: string | null; signature_url: string | null };
type Live = "idle" | "checking" | "available" | "not_enough" | "unknown";
type RouteStop = { stage: string; who: string | null };

const STEPS = ["Type", "Details", "Attachments", "Sign & submit"] as const;
const CATEGORIES: Array<{ key: PersonalCategory; title: string; text: string; icon: string }> = [
  { key: "Fund", title: "Personal fund", text: "Money for yourself, such as a loan or support.", icon: "wallet" },
  { key: "Leave", title: "Leave", text: "Annual, sick, study or other leave.", icon: "clock" },
  { key: "Contract Renewal", title: "Contract renewal", text: "Renew your contract with the Trust.", icon: "file" },
  { key: "Resignation", title: "Resignation", text: "Give notice that you are leaving.", icon: "logout" },
  { key: "Others", title: "Other personal", text: "Any other personal request.", icon: "help" },
];
const MAX_FILES = 50;
const MAX_MB = 10;
const ACCEPT = ".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.webp,.txt";

const otpEnabled = process.env.NEXT_PUBLIC_REQGEN_REQUEST_OTP_ENABLED === "true";
const notificationsEnabled = process.env.NEXT_PUBLIC_REQGEN_NOTIFICATIONS_ENABLED === "true";
const otpChannel: OtpChannel = (() => {
  const raw = String(process.env.NEXT_PUBLIC_REQGEN_REQUEST_OTP_CHANNEL || "sms").trim().toLowerCase();
  if (raw === "email") return "email";
  if (raw === "sms_email" || raw === "email_sms") return "sms_email";
  return "sms";
})();
const otpLabel = otpChannel === "sms" ? "SMS code" : otpChannel === "email" ? "email code" : "SMS / email code";

function cleanFileName(name: string) {
  const parts = name.split(".");
  const ext = parts.length > 1 ? (parts.pop() || "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 12) : "";
  const base = parts.join(".").trim().toLowerCase().replace(/[^a-z0-9-_]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || "attachment";
  return ext ? `${base}.${ext}` : base;
}
function sizeLabel(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}
function fileKind(name: string) {
  const ext = (name.split(".").pop() || "").toUpperCase();
  return ext.slice(0, 4) || "FILE";
}
function subLabel(s: SubName) {
  return (s.code ? `${s.code} — ` : "") + s.name;
}
function errorText(e: unknown) {
  return e instanceof Error ? e.message : "Something went wrong. Please try again.";
}
function maskEmail(email: string | null | undefined) {
  const [n = "", d = ""] = String(email || "").split("@");
  if (!d) return "your email";
  return `${n.slice(0, 2)}***@${d}`;
}
function maskPhone(phone: string | null | undefined) {
  const raw = String(phone || "").replace(/\D/g, "");
  return raw.length >= 7 ? `${raw.slice(0, 4)}***${raw.slice(-3)}` : "your phone";
}

export default function NewRequestPage() {
  return (
    <Suspense fallback={<V4Page><Skeleton lines={6} /></V4Page>}>
      <NewRequest />
    </Suspense>
  );
}

function NewRequest() {
  const router = useRouter();
  const params = useSearchParams();
  const embedded = params.get("embedded") === "1";
  const draftParam = params.get("draft");
  const who = useIdentity();
  const seeBalances = canSeeBudgetBalances(who.role);

  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<Me | null>(null);
  const [depts, setDepts] = useState<Dept[]>([]);
  const [step, setStep] = useState(0);
  const [msg, setMsg] = useState<{ tone: "red" | "green" | "blue" | "amber"; text: string } | null>(null);

  const [requestType, setRequestType] = useState<RequestType>("Official");
  const [category, setCategory] = useState<PersonalCategory>("Fund");
  const [deptId, setDeptId] = useState("");
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [amountText, setAmountText] = useState("");
  const [subheadId, setSubheadId] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [confirmed, setConfirmed] = useState(false);

  const [subNames, setSubNames] = useState<SubName[]>([]);
  const [subFull, setSubFull] = useState<SubFull[]>([]);
  const [subsLoading, setSubsLoading] = useState(false);
  const [live, setLive] = useState<Live>("idle");
  const [route, setRoute] = useState<{ stops: RouteStop[]; blocked: string[] } | null>(null);

  const [draftId, setDraftId] = useState<string | null>(draftParam);
  const [savingDraft, setSavingDraft] = useState(false);
  const [busy, setBusy] = useState<"" | "submitting" | "uploading" | "sending-code" | "verifying">("");
  const [otpOpen, setOtpOpen] = useState(false);
  const [otp, setOtp] = useState("");
  const otpLock = useRef(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const isOfficial = requestType === "Official";
  const needsAmount = isOfficial || category === "Fund";
  const amount = parseAmount(amountText);
  const amountOk = !needsAmount || (Number.isFinite(amount) && amount > 0);
  const dept = depts.find((d) => d.id === deptId) || null;
  const subOptions: SubName[] = seeBalances ? subFull : subNames;
  const chosenSub = subOptions.find((s) => s.id === subheadId) || null;
  const chosenFull = subFull.find((s) => s.id === subheadId) || null;
  const available = chosenFull ? Number(chosenFull.approved_allocation || 0) - Number(chosenFull.reserved_amount || 0) - Number(chosenFull.expenditure || 0) : 0;

  // ---- load -------------------------------------------------------------
  useEffect(() => {
    let alive = true;
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) { router.push("/login"); return; }
      const [prof, dep] = await Promise.all([
        supabase.from("profiles").select("id,full_name,email,phone,signature_url").eq("id", auth.user.id).maybeSingle(),
        supabase.from("departments").select("id,name").eq("is_active", true).order("name", { ascending: true }),
      ]);
      if (!alive) return;
      setMe((prof.data || null) as Me | null);
      setDepts((dep.data || []) as Dept[]);
      if (dep.error) setMsg({ tone: "red", text: "Departments could not be loaded: " + dep.error.message });
      if (draftParam) {
        try {
          const d = await loadDraft(draftParam);
          if (!alive) return;
          if (d) {
            setRequestType(d.request_type === "Personal" ? "Personal" : "Official");
            if (d.personal_category) setCategory(d.personal_category as PersonalCategory);
            setDeptId(d.dept_id || "");
            setTitle(d.title || "");
            setDetails(d.details || "");
            setAmountText(d.amount ? formatAmountInput(String(d.amount)) : "");
            setSubheadId(d.subhead_id || "");
            setFiles(d.files);
            setStep(1);
            setMsg({ tone: "blue", text: `Draft opened. Saved ${new Date(d.updated_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}.` });
          } else {
            setMsg({ tone: "amber", text: "That draft was not found. It may have been submitted or deleted." });
            setDraftId(null);
          }
        } catch (e) {
          setMsg({ tone: "red", text: "The draft could not be opened: " + errorText(e) });
        }
      }
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [router, draftParam]);

  // ---- subheads of the chosen department --------------------------------
  useEffect(() => {
    if (!who.ready || !deptId || !isOfficial) { queueMicrotask(() => { setSubNames([]); setSubFull([]); }); return; }
    let alive = true;
    queueMicrotask(() => setSubsLoading(true));
    (async () => {
      if (seeBalances) {
        const { data } = await supabase
          .from("subheads")
          .select("id,dept_id,code,name,approved_allocation,reserved_amount,expenditure")
          .eq("dept_id", deptId)
          .eq("is_active", true)
          .order("code", { ascending: true });
        if (!alive) return;
        setSubFull((data || []) as SubFull[]);
        setSubNames([]);
      } else {
        const { data, error } = await supabase.rpc("reqgen_department_subhead_names", { p_dept_id: deptId });
        if (!alive) return;
        setSubNames(error ? [] : ((data || []) as SubName[]));
        setSubFull([]);
      }
      setSubsLoading(false);
    })();
    return () => { alive = false; };
  }, [who.ready, deptId, isOfficial, seeBalances]);

  // a subhead from another department (or a hidden list) is cleared
  useEffect(() => {
    if (subsLoading || !subheadId) return;
    if (!subOptions.some((s) => s.id === subheadId)) queueMicrotask(() => setSubheadId(""));
  }, [subOptions, subheadId, subsLoading]);

  // ---- live check (staff never see the balance) --------------------------
  useEffect(() => {
    if (!isOfficial || !subheadId || !(amount > 0)) { queueMicrotask(() => setLive("idle")); return; }
    if (seeBalances) { queueMicrotask(() => setLive(chosenFull ? (amount <= available ? "available" : "not_enough") : "idle")); return; }
    queueMicrotask(() => setLive("checking"));
    const t = window.setTimeout(() => {
      void supabase.rpc("reqgen_subhead_live_check", { p_subhead_id: subheadId, p_amount: amount }).then(({ data, error }) => {
        const v = String(Array.isArray(data) ? data[0] : data || "");
        setLive(error ? "unknown" : v === "available" ? "available" : v === "not_enough" ? "not_enough" : "unknown");
      });
    }, 350);
    return () => window.clearTimeout(t);
  }, [isOfficial, subheadId, amount, seeBalances, chosenFull, available]);

  // ---- route preview ----------------------------------------------------
  useEffect(() => {
    if (!deptId) { queueMicrotask(() => setRoute(null)); return; }
    let alive = true;
    const cat = requestType === "Personal" ? category : null;
    (async () => {
      const steps = await fetchRoutePreview(deptId, requestType, cat);
      if (!alive) return;
      if (!steps || !steps.length) { setRoute(null); return; }
      const shown = steps.filter((s) => !(s.is_vacant && s.if_vacant === "skip"));
      let names = new Map<string, string>();
      const built = await supabase.rpc("build_request_route", { p_dept_id: deptId, p_request_type: requestType, p_personal_category: cat });
      if (!built.error && Array.isArray(built.data)) {
        const rows = built.data as Array<{ stage: string; owner_id: string | null }>;
        const ids = [...new Set(rows.map((r) => r.owner_id).filter(Boolean))] as string[];
        if (ids.length) {
          const prof = await supabase.from("profiles").select("id,full_name").in("id", ids);
          const nameOf = new Map(((prof.data || []) as Array<{ id: string; full_name: string | null }>).map((p) => [p.id, p.full_name || ""]));
          names = new Map(rows.filter((r) => r.owner_id && nameOf.get(r.owner_id)).map((r) => [r.stage, nameOf.get(r.owner_id as string) as string]));
        }
      }
      if (!alive) return;
      setRoute({
        stops: shown.map((s) => ({ stage: stageTitle(s.stage), who: names.get(s.stage) || null })),
        blocked: steps.filter((s) => s.is_vacant && s.if_vacant === "block").map((s) => stageTitle(s.stage)),
      });
    })();
    return () => { alive = false; };
  }, [deptId, requestType, category]);

  // ---- rules for each step ----------------------------------------------
  const detailsProblem = useMemo(() => {
    if (!deptId) return "Choose the department.";
    if (!title.trim()) return "Type the title of the request.";
    if (isOfficial && subOptions.length > 0 && !subheadId) return "Choose the budget subhead.";
    if (!details.trim()) return "Describe what the request is for.";
    if (needsAmount && !amountOk) return "Type the amount (numbers only, up to two decimals).";
    if (isOfficial && subheadId && live === "not_enough") return "Not enough fund in this subhead. Choose another subhead or lower the amount. You can still save a draft.";
    if (isOfficial && subheadId && live === "checking") return "Checking the budget…";
    return "";
  }, [deptId, title, isOfficial, subOptions.length, subheadId, details, needsAmount, amountOk, live]);

  const signProblem = useMemo(() => {
    if (!me?.full_name?.trim()) return "Add your full name in My Account first.";
    if (!me?.signature_url) return "Add your signature in My Account › Signature & Photo first.";
    if (route?.blocked.length) return `The route has no officer for ${route.blocked.join(", ")}. The Super Admin must complete the Routing Engine first.`;
    if (!confirmed) return "Tick the box to confirm the details are correct.";
    return "";
  }, [me, route, confirmed]);

  // ---- files ------------------------------------------------------------
  function addFiles(list: FileList | null) {
    if (!list || !list.length) return;
    const incoming = Array.from(list);
    const big = incoming.find((f) => f.size > MAX_MB * 1024 * 1024);
    if (big) { setMsg({ tone: "red", text: `“${big.name}” is larger than ${MAX_MB} MB.` }); return; }
    const seen = new Set<string>();
    const merged = [...files, ...incoming].filter((f) => { const k = `${f.name}-${f.size}`; if (seen.has(k)) return false; seen.add(k); return true; });
    if (merged.length > MAX_FILES) { setMsg({ tone: "red", text: `A request can have at most ${MAX_FILES} attachments.` }); return; }
    setFiles(merged);
    setMsg(null);
  }

  // ---- drafts -------------------------------------------------------------
  const doSaveDraft = useCallback(async () => {
    if (!me) return;
    if (!title.trim() && !details.trim()) { setMsg({ tone: "amber", text: "Type at least a title or a description before saving a draft." }); return; }
    setSavingDraft(true);
    try {
      const id = await saveDraft(draftId, {
        request_type: requestType,
        personal_category: requestType === "Personal" ? category : null,
        dept_id: deptId || null,
        subhead_id: isOfficial ? subheadId || null : null,
        title: title.trim(),
        details: details.trim(),
        amount: needsAmount && amount > 0 ? amount : null,
      }, files);
      setDraftId(id);
      if (!embedded) router.replace(`/requests/new?draft=${id}`, { scroll: false });
      setMsg({ tone: "green", text: "Draft saved. Find it under Requests › My Requests › Drafts. Drafts are kept for 60 days." });
    } catch (e) {
      setMsg({ tone: "red", text: "The draft could not be saved: " + errorText(e) });
    } finally {
      setSavingDraft(false);
    }
  }, [me, title, details, draftId, requestType, category, deptId, isOfficial, subheadId, needsAmount, amount, files, embedded, router]);

  // ---- submit -------------------------------------------------------------
  async function authHeader() {
    const { data } = await supabase.auth.getSession();
    if (!data.session?.access_token) throw new Error("Your session has ended. Please sign in again.");
    return { "Content-Type": "application/json", Authorization: `Bearer ${data.session.access_token}` };
  }

  async function startSubmit() {
    setMsg(null);
    if (detailsProblem) { setStep(1); setMsg({ tone: "red", text: detailsProblem }); return; }
    if (signProblem) { setMsg({ tone: "red", text: signProblem }); return; }
    const ok = await confirmDialog({
      title: "Sign and submit this request?",
      message: "Your saved signature is placed on the request letter and it goes to the first officer on the route.",
      details: [
        `${requestType === "Official" ? "Official" : `Personal · ${category}`} · ${dept?.name || ""}`,
        title.trim(),
        needsAmount ? `${nairaExact(amount)} — ${nairaInWords(amount)}` : "No amount",
      ],
      confirmLabel: "Sign and submit",
    });
    if (!ok) return;
    if (!otpEnabled) { await submitNow(); return; }
    await sendCode();
  }

  async function sendCode() {
    setBusy("sending-code");
    try {
      const res = await fetch("/api/otp/request-submission/send", { method: "POST", headers: await authHeader() });
      const out = await res.json().catch(() => null);
      if (!res.ok || !out?.ok) throw new Error(out?.error || `The ${otpLabel} could not be sent.`);
      setOtp("");
      setOtpOpen(true);
    } catch (e) {
      setMsg({ tone: "red", text: errorText(e) });
    } finally {
      setBusy("");
    }
  }

  async function verifyAndSubmit(code: string) {
    if (otpLock.current) return;
    if (!/^\d{6}$/.test(code)) return;
    otpLock.current = true;
    setBusy("verifying");
    try {
      const res = await fetch("/api/otp/request-submission/verify", { method: "POST", headers: await authHeader(), body: JSON.stringify({ code }) });
      const out = await res.json().catch(() => null);
      if (!res.ok || !out?.ok) throw new Error(out?.error || "The code is not correct.");
      setOtpOpen(false);
      await submitNow();
    } catch (e) {
      setMsg({ tone: "red", text: errorText(e) });
      setOtp("");
    } finally {
      setBusy("");
      window.setTimeout(() => { otpLock.current = false; }, 600);
    }
  }

  async function submitNow() {
    if (!me) return;
    setBusy("submitting");
    try {
      const now = new Date();
      const requestNo = `REQ-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getTime()).slice(-6)}`;
      const { data, error } = await supabase.rpc("submit_request_with_reservation", {
        p_title: title.trim(),
        p_details: details.trim(),
        p_amount: needsAmount ? amount : 0,
        p_dept_id: deptId,
        p_subhead_id: isOfficial ? subheadId || null : null,
        p_request_type: requestType,
        p_personal_category: requestType === "Personal" ? category : null,
        p_created_by: me.id,
        p_requester_name: (me.full_name || "").trim(),
        p_requester_signature: me.signature_url,
        p_request_no: requestNo,
      });
      if (error) throw new Error(error.message);
      const result = (Array.isArray(data) ? data[0] : data) as { request_id?: string; first_stage?: string } | null;
      const requestId = result?.request_id;
      if (!requestId) throw new Error("The request was sent but ReqGen did not return its number. Check My Requests before trying again.");

      if (files.length) {
        setBusy("uploading");
        const rows = [];
        for (let i = 0; i < files.length; i += 1) {
          const f = files[i];
          const path = `${requestId}/${Date.now()}-${i + 1}-${cleanFileName(f.name)}`;
          const up = await supabase.storage.from("request-attachments").upload(path, f, { upsert: false, contentType: f.type || "application/octet-stream" });
          if (up.error) throw new Error(`The request was submitted, but “${f.name}” did not upload: ${up.error.message}. Open the request to add it again.`);
          rows.push({ request_id: requestId, uploaded_by: me.id, file_name: f.name, file_path: path, file_type: f.type || null, file_size: f.size, verification_status: "Pending" });
        }
        const ins = await supabase.from("request_attachments").insert(rows);
        if (ins.error) throw new Error("The files uploaded but could not be linked to the request: " + ins.error.message);
      }

      if (notificationsEnabled) {
        const headers = await authHeader().catch(() => null);
        if (headers) {
          for (const event of ["submission_success", "approval_pending"]) {
            await fetch("/api/notifications/sms/request-event", { method: "POST", headers, body: JSON.stringify({ requestId, event }) }).catch(() => null);
          }
        }
      }
      if (draftId) await deleteDraft(draftId).catch(() => null);

      setMsg({ tone: "green", text: `Submitted. It is now with the ${stageTitle(result?.first_stage || "") || "first officer"}.` });
      if (embedded) {
        window.parent.postMessage({ type: "reqgen-request-created", requestId }, window.location.origin);
        return;
      }
      router.push(`/requests/${requestId}?updated=${Date.now()}`);
    } catch (e) {
      setMsg({ tone: "red", text: errorText(e) });
    } finally {
      setBusy("");
    }
  }

  function next() {
    setMsg(null);
    if (step === 1 && detailsProblem) { setMsg({ tone: "red", text: detailsProblem }); return; }
    setStep((s) => Math.min(3, s + 1));
    if (!embedded) window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function back() {
    setMsg(null);
    setStep((s) => Math.max(0, s - 1));
  }
  function cancel() {
    if (embedded) { window.parent.postMessage({ type: "reqgen-form-cancel" }, window.location.origin); return; }
    router.push("/requests/mine");
  }

  if (loading || !who.ready) return <V4Page><PageHead title="New Request" sub="Preparing the form…" /><div className="v4-card"><Skeleton lines={7} /></div></V4Page>;

  const deptOptions: SelectOption[] = depts.map((d) => ({ value: d.id, label: d.name }));
  const subSelect: SelectOption[] = subOptions.map((s) => {
    const full = subFull.find((f) => f.id === s.id);
    const avail = full ? Number(full.approved_allocation || 0) - Number(full.reserved_amount || 0) - Number(full.expenditure || 0) : null;
    return { value: s.id, label: subLabel(s), hint: seeBalances && avail !== null ? `Available ${nairaExact(avail)}` : undefined };
  });
  const busyText = busy === "uploading" ? "Uploading attachments…" : busy === "submitting" ? "Submitting…" : busy === "sending-code" ? `Sending the ${otpLabel}…` : busy === "verifying" ? "Checking the code…" : "";
  const words = needsAmount && amount > 0 ? nairaInWords(amount) : "";

  const liveBox = isOfficial && subheadId && amount > 0 ? (
    <div className={`v4-livecheck ${live === "available" ? "v4-lc-ok" : live === "not_enough" ? "v4-lc-no" : "v4-lc-wait"} v4-span-2`} role={live === "not_enough" ? "alert" : "status"} aria-live="polite">
      <Icon name={live === "available" ? "check" : live === "not_enough" ? "x" : "clock"} />
      <span>
        <strong>{live === "available" ? "Fund available" : live === "not_enough" ? "Not enough in this subhead" : live === "checking" ? "Checking the budget…" : "The budget could not be checked"}</strong>
        <span>
          {live === "available"
            ? seeBalances
              ? `${chosenSub ? subLabel(chosenSub) : "This subhead"} can cover ${nairaExact(amount)}.`
              : `${chosenSub ? subLabel(chosenSub) : "This subhead"} can cover ${nairaExact(amount)}. You do not see the balance — the approving officer confirms the subhead when approving.`
            : live === "not_enough"
              ? `${chosenSub ? subLabel(chosenSub) : "This subhead"} cannot cover ${nairaExact(amount)}. Choose another subhead, lower the amount, or speak to your Head of Department. You can save a draft but not submit until the check passes.`
              : live === "checking" ? "One moment." : "The approving officer will confirm the budget."}
        </span>
      </span>
    </div>
  ) : null;

  return (
    <V4Page className="v4-newreq">
      {embedded ? null : (
        <PageHead
          title="New Request"
          sub={step === 0 ? "Choose what kind of request this is." : step === 1 ? "Type the title, pick the subhead and the amount. ReqGen checks the budget live." : step === 2 ? "Add quotations, invoices or letters that support the request." : "Check everything once more, then sign and submit."}
          actions={draftId ? [{ label: "My drafts", href: "/requests/mine?tab=drafts", icon: "file", kind: "ghost" }] : undefined}
        />
      )}

      <div className="v4-stepper" aria-label="Progress">
        {STEPS.map((s, i) => (
          <div key={s} className={i < step ? "v4-done" : i === step ? "v4-on" : undefined} aria-current={i === step ? "step" : undefined}>{i + 1} · {s}</div>
        ))}
      </div>

      {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}

      <div className="v4-split">
        <section className="v4-card v4-card-pad v4-newreq-main">
          {step === 0 ? (
            <div className="v4-newreq-step">
              <div className="v4-section-title"><span className="v4-no">1</span><h2 className="v4-h2">What kind of request?</h2></div>
              <div className="v4-typecards" role="radiogroup" aria-label="Request type">
                {(["Official", "Personal"] as RequestType[]).map((t) => (
                  <button key={t} type="button" role="radio" aria-checked={requestType === t} className="v4-typecard" onClick={() => { setRequestType(t); if (t === "Personal") setSubheadId(""); }}>
                    <span className={`v4-ico v4-t-${t === "Official" ? "brand" : "blue"}`}><Icon name={t === "Official" ? "building" : "user"} /></span>
                    <span><strong>{t === "Official" ? "Official request" : "Personal request"}</strong>
                      <small>{t === "Official" ? "Goods, services, works or activities for the Trust, paid from a department budget subhead." : "For yourself: personal fund, leave, contract renewal, resignation or other."}</small></span>
                    <Icon name="tick" className="v4-typecard-tick" />
                  </button>
                ))}
              </div>
              {requestType === "Personal" ? (
                <>
                  <h3 className="v4-h3" style={{ margin: "22px 0 10px" }}>Which personal request?</h3>
                  <div className="v4-typecards v4-typecards-sm" role="radiogroup" aria-label="Personal category">
                    {CATEGORIES.map((c) => (
                      <button key={c.key} type="button" role="radio" aria-checked={category === c.key} className="v4-typecard" onClick={() => setCategory(c.key)}>
                        <span className="v4-ico v4-t-blue"><Icon name={c.icon} /></span>
                        <span><strong>{c.title}</strong><small>{c.text}</small></span>
                        <Icon name="tick" className="v4-typecard-tick" />
                      </button>
                    ))}
                  </div>
                </>
              ) : null}
              <div className="v4-form-actions" style={{ marginTop: 22 }}>
                <button type="button" className="v4-btn v4-btn-ghost" onClick={cancel}>Cancel</button>
                <button type="button" className="v4-btn v4-btn-primary" onClick={next}>Continue to details <Icon name="right" /></button>
              </div>
            </div>
          ) : null}

          {step === 1 ? (
            <div className="v4-newreq-step">
              <div className="v4-section-title"><span className="v4-no">2</span><h2 className="v4-h2">Details</h2>
                <span className="v4-chip v4-chip-grey" style={{ marginLeft: "auto" }}>{isOfficial ? "Official" : `Personal · ${category}`}</span></div>
              <div className="v4-form-grid">
                <div className="v4-field v4-span-2">
                  <label className="v4-flabel" htmlFor="nr-dept" style={{ fontSize: 13, fontWeight: 700 }}>Department <span className="v4-req">*</span></label>
                  <Select id="nr-dept" value={deptId} onChange={(v) => { setDeptId(v); setSubheadId(""); }} options={deptOptions} placeholder="Choose your department" />
                  <span className="v4-help">{isOfficial ? "Choosing the department loads its subheads." : "The department you work in."}</span>
                </div>

                <label className="v4-field">
                  <span className="v4-flabel">Title <span className="v4-req">*</span></span>
                  <input className="v4-input" value={title} maxLength={160} onChange={(e) => setTitle(e.target.value)} placeholder={isOfficial ? "e.g. Purchase of data bundles for the front desk" : "e.g. Annual leave, December"} />
                </label>

                {isOfficial ? (
                  <div className="v4-field">
                    <label className="v4-flabel" htmlFor="nr-sub" style={{ fontSize: 13, fontWeight: 700 }}>Budget subhead <span className="v4-req">*</span></label>
                    <Select id="nr-sub" value={subheadId} onChange={setSubheadId} options={subSelect} disabled={!deptId || subsLoading || !subSelect.length}
                      placeholder={!deptId ? "Choose the department first" : subsLoading ? "Loading subheads…" : subSelect.length ? "Choose the subhead" : "No subheads — the officer will choose"} menuMinWidth={300} />
                    <span className="v4-help">
                      {!deptId ? "" : subSelect.length
                        ? seeBalances ? `The ${subSelect.length} subheads of ${dept?.name || "this department"}, with what is available.` : `The ${subSelect.length} subheads of ${dept?.name || "this department"}. Balances are private.`
                        : subsLoading ? "" : "This department has no active subhead. The approving officer will choose one."}
                    </span>
                  </div>
                ) : <div className="v4-field" aria-hidden="true" />}

                <label className="v4-field v4-span-2">
                  <span className="v4-flabel">Description <span className="v4-req">*</span></span>
                  <textarea className="v4-textarea" value={details} maxLength={2000} onChange={(e) => setDetails(e.target.value)} placeholder="What is it for, and why is it needed?" style={{ minHeight: 96 }} />
                  <span className="v4-help" style={{ textAlign: "right" }}>{details.length} / 2000</span>
                </label>

                {needsAmount ? (
                  <>
                    <label className="v4-field">
                      <span className="v4-flabel">Amount (₦) <span className="v4-req">*</span></span>
                      <input className={`v4-input v4-num${amountText && !amountOk ? " v4-is-error" : ""}`} inputMode="decimal" value={amountText} placeholder="0.00"
                        onChange={(e) => setAmountText(formatAmountInput(e.target.value))} />
                      <span className="v4-help">{words ? `${words} — written into your request letter automatically.` : "Numbers only. Written into the letter in figures and words."}</span>
                    </label>
                    <div className="v4-field">
                      <span className="v4-flabel">In the letter</span>
                      <span className="v4-locked" style={{ fontWeight: 700 }}>{amount > 0 ? `${nairaExact(amount)} (${words})` : "—"}</span>
                    </div>
                  </>
                ) : (
                  <div className="v4-field v4-span-2"><span className="v4-flabel">Amount</span><span className="v4-locked">Not needed for a {category.toLowerCase()} request</span></div>
                )}

                {liveBox}

                {seeBalances && isOfficial && chosenFull ? (
                  <div className="v4-span-2">
                    <div className="v4-balance-strip" aria-label="Subhead figures">
                      <div><span>Allocation</span><b>{nairaExact(chosenFull.approved_allocation)}</b></div>
                      <div><span>Reserved</span><b>{nairaExact(chosenFull.reserved_amount)}</b></div>
                      <div><span>Expenditure</span><b>{nairaExact(chosenFull.expenditure)}</b></div>
                      <div><span>Available</span><b>{nairaExact(available)}</b></div>
                    </div>
                    <span className="v4-help" style={{ display: "block", marginTop: 6 }}>You see these figures because you are acting as {who.roleName}. Staff, Registry and PD see only “fund available” or “not enough”.</span>
                  </div>
                ) : null}
              </div>
              <div className="v4-form-actions" style={{ marginTop: 18 }}>
                <button type="button" className="v4-btn v4-btn-ghost" onClick={back}><Icon name="left" />Back</button>
                <button type="button" className="v4-btn v4-btn-secondary" onClick={() => void doSaveDraft()} disabled={savingDraft}>{savingDraft ? "Saving…" : "Save draft"}</button>
                <button type="button" className="v4-btn v4-btn-primary" onClick={next} disabled={!!detailsProblem}>Continue to attachments <Icon name="right" /></button>
              </div>
              {detailsProblem ? <p className="v4-help" style={{ textAlign: "right", margin: "8px 0 0" }}>{detailsProblem}</p> : null}
            </div>
          ) : null}

          {step === 2 ? (
            <div className="v4-newreq-step">
              <div className="v4-section-title"><span className="v4-no">3</span><h2 className="v4-h2">Attachments</h2><span className="v4-muted" style={{ marginLeft: "auto", fontSize: 13 }}>Optional</span></div>
              <button type="button" className="v4-dropzone v4-dropzone-btn"
                onClick={() => fileInput.current?.click()}
                onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("is-over"); }}
                onDragLeave={(e) => e.currentTarget.classList.remove("is-over")}
                onDrop={(e) => { e.preventDefault(); e.currentTarget.classList.remove("is-over"); addFiles(e.dataTransfer.files); }}>
                <Icon name="upload" size="lg" />
                <strong>Drop files here, or <span>choose files</span></strong>
                <small>PDF, Word, Excel, pictures or text · up to {MAX_MB} MB each · up to {MAX_FILES} files</small>
              </button>
              <input ref={fileInput} type="file" multiple accept={ACCEPT} hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
              {files.length ? (
                <ul className="v4-files" style={{ marginTop: 14 }}>
                  {files.map((f, i) => (
                    <li key={`${f.name}-${f.size}`}>
                      <span className={`v4-fi${/\.(png|jpe?g|webp)$/i.test(f.name) ? " v4-x" : ""}`}>{fileKind(f.name)}</span>
                      <span className="v4-ft"><strong>{f.name}</strong><span>{sizeLabel(f.size)}</span></span>
                      <button type="button" className="v4-btn v4-btn-ghost" style={{ minHeight: 36, color: "var(--v4-red)" }} onClick={() => setFiles((all) => all.filter((_, j) => j !== i))} aria-label={`Remove ${f.name}`}>Remove</button>
                    </li>
                  ))}
                </ul>
              ) : <p className="v4-muted" style={{ margin: "12px 0 0", fontSize: 13 }}>No files yet. Officers check every attachment before they approve.</p>}
              <div className="v4-form-actions" style={{ marginTop: 18 }}>
                <button type="button" className="v4-btn v4-btn-ghost" onClick={back}><Icon name="left" />Back</button>
                <button type="button" className="v4-btn v4-btn-secondary" onClick={() => void doSaveDraft()} disabled={savingDraft}>{savingDraft ? "Saving…" : "Save draft"}</button>
                <button type="button" className="v4-btn v4-btn-primary" onClick={next}>Continue to review <Icon name="right" /></button>
              </div>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="v4-newreq-step" style={{ display: "flex", flexDirection: "column", gap: 22 }}>
              <div className="v4-section-title" style={{ margin: 0 }}><span className="v4-no">4</span><h2 className="v4-h2">Review</h2>
                <button type="button" className="v4-btn v4-btn-ghost" style={{ marginLeft: "auto", minHeight: 36 }} onClick={() => setStep(1)}><Icon name="pen" />Edit details</button></div>
              <dl className="v4-summary">
                <div><dt>Type</dt><dd>{isOfficial ? "Official" : `Personal · ${category}`}</dd></div>
                <div><dt>Department</dt><dd>{dept?.name || "—"}</dd></div>
                <div><dt>Subhead</dt><dd>{isOfficial ? (chosenSub ? <>{subLabel(chosenSub)} {live === "available" ? <span className="v4-chip v4-chip-green" style={{ marginLeft: 4 }}>Fund available</span> : null}</> : "The approving officer will choose") : "—"}</dd></div>
                <div className="v4-wide"><dt>Title</dt><dd>{title || "—"}</dd></div>
                <div className="v4-wide"><dt>Description</dt><dd style={{ fontWeight: 500, whiteSpace: "pre-wrap" }}>{details || "—"}</dd></div>
                <div><dt>Amount</dt><dd className="v4-num" style={{ fontSize: 20 }}>{needsAmount ? nairaExact(amount) : "—"}</dd></div>
                {words ? <div className="v4-wide"><dt>In words</dt><dd style={{ fontWeight: 500 }}>{words}</dd></div> : null}
              </dl>
              <div><span className="v4-label">Attachments</span>
                {files.length ? (
                  <ul className="v4-files" style={{ marginTop: 8 }}>{files.map((f) => <li key={`${f.name}-${f.size}`}><span className="v4-fi">{fileKind(f.name)}</span><span className="v4-ft"><strong>{f.name}</strong><span>{sizeLabel(f.size)}</span></span></li>)}</ul>
                ) : <p className="v4-muted" style={{ margin: "6px 0 0" }}>None.</p>}
              </div>
              <div><span className="v4-label">Your signature</span>
                <div className="v4-sig-box" style={{ marginTop: 8 }}>
                  {me?.signature_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={me.signature_url} alt={`Signature of ${me.full_name || "the requester"}`} style={{ maxHeight: 70, maxWidth: 260, objectFit: "contain" }} />
                  ) : <span>No signature yet. <Link href="/profile/details#signature">Add it in My Account</Link>.</span>}
                </div>
                <span className="v4-help" style={{ display: "block", marginTop: 6 }}>Added from My Account › Signature &amp; Photo.</span></div>
              <label className="v4-check"><input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} /> I confirm the details are correct and {needsAmount ? "the amount is needed" : "the request is genuine"}.</label>
              {busyText ? <Notice tone="blue">{busyText}</Notice> : null}
              <div className="v4-form-actions">
                <button type="button" className="v4-btn v4-btn-ghost" onClick={back} disabled={!!busy}><Icon name="left" />Back</button>
                <button type="button" className="v4-btn v4-btn-secondary" onClick={() => void doSaveDraft()} disabled={savingDraft || !!busy}>{savingDraft ? "Saving…" : "Save draft"}</button>
                <button type="button" className="v4-btn v4-btn-primary" onClick={() => void startSubmit()} disabled={!!busy || !!signProblem || !!detailsProblem}><Icon name="pentool" />{busy ? busyText : "Sign and submit"}</button>
              </div>
              {signProblem && !busy ? <p className="v4-help" style={{ textAlign: "right", margin: "-12px 0 0" }}>{signProblem}</p> : null}
            </div>
          ) : null}
        </section>

        <aside className="v4-side-stack">
          {step <= 1 ? (
            <section className="v4-card v4-card-pad">
              <h2 className="v4-h3" style={{ marginBottom: 10 }}>{isOfficial ? "How the budget check works" : "How a personal request moves"}</h2>
              {isOfficial ? (
                <ol className="v4-numbered" style={{ fontSize: 13.5 }}>
                  <li>Pick the department — its subheads load.</li>
                  <li>Pick the subhead next to your title.</li>
                  <li>Type the amount — ReqGen answers <b>yes</b> or <b>no</b> at once.</li>
                  <li>The approving officer confirms the subhead; the balance figures are printed on the letter with their signature.</li>
                </ol>
              ) : (
                <ol className="v4-numbered" style={{ fontSize: 13.5 }}>
                  <li>Your department head sees it first.</li>
                  <li>The HR Coordinator reviews it.</li>
                  <li>{category === "Fund" ? "The DG approves, then the Account Officer pays." : "The DG decides, then HR files it."}</li>
                </ol>
              )}
            </section>
          ) : null}

          {deptId ? (
            <section className="v4-card v4-card-pad">
              <h2 className="v4-h3" style={{ marginBottom: 12 }}>It will go to</h2>
              {route?.stops.length ? (
                <ol className="v4-numbered" style={{ fontSize: 13.5 }}>
                  {route.stops.map((s, i) => <li key={`${s.stage}-${i}`}>{s.stage}{s.who ? <> · <span className="v4-muted">{s.who}</span></> : null}</li>)}
                </ol>
              ) : <p className="v4-muted" style={{ margin: 0, fontSize: 13.5 }}>{routingNoteFor(requestType, category, dept?.name)}</p>}
              {route?.blocked.length ? <p className="v4-error" style={{ margin: "10px 0 0", fontSize: 13 }}>No officer is set for {route.blocked.join(", ")}. The Super Admin must complete the Routing Engine before this can be submitted.</p> : null}
              <p className="v4-help" style={{ margin: "10px 0 0" }}>Each officer is told in the app and on their phone. A vacant step is skipped.</p>
            </section>
          ) : null}

          {step >= 2 && isOfficial && subheadId && amount > 0 ? liveBox : null}

          <section className="v4-notice v4-notice-blue">
            <Icon name="lock" />
            <span>{seeBalances
              ? `Acting as ${who.roleName}, you can see subhead figures. Staff, Registry and PD never do.`
              : "Staff never see subhead balances. Only the approving officers, Finance, the Auditor and the Super Admin do."}</span>
          </section>
        </aside>
      </div>

      {otpOpen ? (
        <div className="v4-newreq-otp" role="dialog" aria-modal="true" aria-labelledby="nr-otp-title">
          <div className="v4-card v4-card-pad">
            <span className="v4-ico v4-t-brand" style={{ width: 52, height: 52, borderRadius: 16, display: "grid", placeItems: "center", margin: "0 auto 10px" }}><Icon name="shield" /></span>
            <h2 id="nr-otp-title" className="v4-h2" style={{ textAlign: "center" }}>Enter the {otpLabel}</h2>
            <p className="v4-muted" style={{ textAlign: "center", margin: "6px 0 16px", fontSize: 13.5 }}>
              Sent to {otpChannel === "email" ? maskEmail(me?.email) : otpChannel === "sms" ? maskPhone(me?.phone) : `${maskPhone(me?.phone)} and ${maskEmail(me?.email)}`}. It is checked as soon as you type the sixth number.
            </p>
            <input className="v4-input v4-num" autoFocus inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={otp} disabled={busy === "verifying"}
              style={{ textAlign: "center", fontSize: 24, letterSpacing: ".4em", fontWeight: 800 }}
              onChange={(e) => { const v = e.target.value.replace(/\D/g, "").slice(0, 6); setOtp(v); if (v.length === 6) void verifyAndSubmit(v); }} aria-label="Six-number code" />
            <div className="v4-form-actions" style={{ marginTop: 16 }}>
              <button type="button" className="v4-btn v4-btn-ghost" onClick={() => setOtpOpen(false)} disabled={busy === "verifying"}>Cancel</button>
              <button type="button" className="v4-btn v4-btn-secondary" onClick={() => void sendCode()} disabled={!!busy}>Send again</button>
            </div>
          </div>
        </div>
      ) : null}
    </V4Page>
  );
}
