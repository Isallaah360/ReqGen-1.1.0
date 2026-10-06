"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, Circle, Clock3, FileText, PenLine, Printer, RefreshCw, Trash2, UserCheck, XCircle } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { confirmDialog } from "@/lib/dialog";
import { PageHeader } from "@/app/components/ui/PageHeader";
import { StatTile } from "@/app/components/ui/StatTile";
import SignatureInk from "@/app/components/ui/SignatureInk";

/**
 * ReqGen v3.1.6 — Payment Voucher detail and SIGNING CHAIN.
 * Prepared (Account) -> Checked (Auditor) -> Cheque Signer -> Counter Signer
 * -> Authorised (DG) -> Paid ("Received by" = payee's saved signature).
 * Each officer signs only at their own step (enforced again in the database by
 * reqgen_pv_sign). The voucher can be printed only when fully signed.
 */

type VoucherDetail = {
  id: string;
  voucher_no: string;
  request_id: string;
  request_no: string | null;
  request_type: string | null;
  personal_category: string | null;

  payee_name: string | null;
  narration: string | null;
  amount: number | null;

  dept_id: string | null;
  dept_name: string | null;

  subhead_id: string | null;
  subhead_code: string | null;
  subhead_name: string | null;

  prepared_by: string | null;
  prepared_by_name: string | null;
  prepared_signature_url: string | null;
  prepared_at: string | null;

  checked_by: string | null;
  checked_by_name: string | null;
  checked_signature_url: string | null;
  checked_at: string | null;

  authorized_by: string | null;
  authorized_by_name: string | null;
  authorized_signature_url: string | null;
  authorized_at: string | null;

  cheque_no: string | null;
  cheque_date: string | null;
  bank_name: string | null;

  cheque_signed_by: string | null;
  cheque_signed_by_name: string | null;
  cheque_signed_signature_url: string | null;
  cheque_signed_at: string | null;

  cheque_counter_signed_by: string | null;
  cheque_counter_signed_by_name: string | null;
  cheque_counter_signed_signature_url: string | null;
  cheque_counter_signed_at: string | null;

  payee_signed_name: string | null;
  payee_signature_url: string | null;
  payee_signed_at: string | null;

  disbursement_mode: string | null;
  transfer_account_name: string | null;
  transfer_account_number: string | null;
  transfer_bank_name: string | null;
  cash_payee_name: string | null;
  counter_signatory_name: string | null;

  current_signing_owner: string | null;
  signing_stage: string | null;

  is_multi_request: boolean | null;
  item_count: number | null;
  total_amount: number | null;
  voucher_scope: string | null;

  status: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type VoucherItem = {
  id: string;
  voucher_id: string;
  request_id: string;
  request_no: string | null;
  request_type: string | null;
  personal_category: string | null;
  title: string | null;
  details: string | null;
  amount: number | null;
  dept_id: string | null;
  dept_name: string | null;
  subhead_id: string | null;
  subhead_code: string | null;
  subhead_name: string | null;
  requester_name: string | null;
  created_at: string | null;
};

type Hist = {
  id: string;
  action_type: string | null;
  from_status: string | null;
  to_status: string | null;
  comment: string | null;
  actor_name: string | null;
  actor_role: string | null;
  actor_signature_url: string | null;
  created_at: string;
};

type Signatory = { id: string; full_name: string; is_active: boolean | null; signatory_type: string | null };

type StepState = "done" | "current" | "waiting";
type Step = { key: string; title: string; who: string; name: string | null; at: string | null; sig: string | null; state: StepState };

const CHAIN = ["Pending Check", "Pending Cheque Signature", "Pending Counter Signature", "Pending DG Authorisation"] as const;

function key(value: string | null | undefined) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function naira(n: number | null | undefined) {
  return `₦${Math.round(Number(n || 0)).toLocaleString("en-NG")}`;
}

function dateTime(d: string | null | undefined) {
  if (!d) return "";
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function signatureUrl(value: string | null | undefined) {
  const raw = (value || "").trim();
  if (!raw) return null;
  if (/^(https?:|data:image\/|blob:)/.test(raw)) return raw;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return null;
  return `${base}/storage/v1/object/public/signatures/${raw.replace(/^signatures\//, "").replace(/^\/+/, "")}`;
}

function statusLabel(status: string | null | undefined) {
  const s = status || "";
  if (s === "Authorized") return "Authorised";
  return s || "—";
}

function statusTone(status: string | null | undefined) {
  const s = key(status);
  if (s === "paid") return "emerald" as const;
  if (s === "authorized" || s === "authorised") return "emerald" as const;
  if (/cancel|reject/.test(s)) return "red" as const;
  return "amber" as const;
}

export default function PaymentVoucherDetailPage() {
  const params = useParams<{ id: string }>();
  const id = String(params?.id || "");
  const router = useRouter();
  const pathname = usePathname();
  // Opened from Approvals (signers outside Finance) or from the Voucher Centre.
  const fromApprovals = (pathname || "").startsWith("/approvals");
  const listPath = fromApprovals ? "/approvals/vouchers" : "/payment-vouchers";
  const printPath = (voucherId: string) => `/payment-vouchers/${voucherId}/print`;

  const [userId, setUserId] = useState("");
  const [roles, setRoles] = useState<Set<string>>(new Set());
  const [voucher, setVoucher] = useState<VoucherDetail | null>(null);
  const [items, setItems] = useState<VoucherItem[]>([]);
  const [history, setHistory] = useState<Hist[]>([]);
  const [signatories, setSignatories] = useState<Signatory[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [comment, setComment] = useState("");
  const [chequeSigner, setChequeSigner] = useState("");
  const [counterSigner, setCounterSigner] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) { router.push("/login"); return; }
      setUserId(auth.user.id);

      const [profileRes, rolesRes, detailRes, itemRes, histRes, signRes] = await Promise.all([
        supabase.from("profiles").select("role").eq("id", auth.user.id).maybeSingle(),
        supabase.from("profile_roles").select("role_key,is_active").eq("profile_id", auth.user.id),
        supabase.rpc("get_payment_voucher_detail", { p_voucher_id: id }),
        supabase.rpc("get_payment_voucher_items", { p_voucher_id: id }),
        supabase.rpc("get_payment_voucher_history", { p_voucher_id: id }),
        supabase.from("payment_voucher_counter_signatories").select("id,full_name,is_active,signatory_type").eq("is_active", true).order("full_name"),
      ]);

      const roleSet = new Set<string>();
      if (profileRes.data?.role) roleSet.add(key(profileRes.data.role));
      for (const r of (rolesRes.data || []) as Array<{ role_key: string | null; is_active: boolean | null }>) {
        if (r.is_active !== false && r.role_key) roleSet.add(key(r.role_key));
      }
      setRoles(roleSet);

      if (detailRes.error) throw new Error(detailRes.error.message);
      const row = (Array.isArray(detailRes.data) ? detailRes.data[0] : detailRes.data) as VoucherDetail | undefined;
      if (!row) throw new Error("Payment voucher not found or you do not have access.");
      setVoucher(row);
      setItems((itemRes.data || []) as VoucherItem[]);
      setHistory(((histRes.data || []) as Hist[]).slice().sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()));
      const signers = (signRes.data || []) as Signatory[];
      setSignatories(signers);
      setChequeSigner((current) => current || row.cheque_signed_by_name || signers.find((s) => key(s.signatory_type) === "chequesigner")?.full_name || "");
      setCounterSigner((current) => current || row.cheque_counter_signed_by_name || signers.find((s) => key(s.signatory_type) === "countersigner")?.full_name || "");
    } catch (caught) {
      setMessage({ tone: "error", text: caught instanceof Error ? caught.message : "The voucher could not be loaded." });
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => { queueMicrotask(() => { void load(); }); }, [load]);

  const has = useCallback((...keys: string[]) => keys.some((k) => roles.has(k)), [roles]);
  const status = voucher?.status || "";
  const isAccount = has("admin", "account", "accounts", "accountofficer");
  const fullySigned = status === "Authorized" || status === "Paid";

  // Mirrors reqgen_pv_sign: who may sign the current step.
  const myStep = useMemo(() => {
    if (!voucher || !userId) return null;
    if (status === "Pending Check" && has("auditor") && voucher.prepared_by !== userId) return { label: "Check and sign as Auditor", title: "Check this voucher?" };
    if (status === "Pending Cheque Signature" && voucher.cheque_signed_by === userId) return { label: "Sign as Cheque Signer", title: "Sign this voucher?" };
    if (status === "Pending Counter Signature" && voucher.cheque_counter_signed_by === userId) return { label: "Counter-sign", title: "Counter-sign this voucher?" };
    if (status === "Pending DG Authorisation" && has("dg", "directorgeneral")) return { label: "Authorise as Director General", title: "Authorise this voucher?" };
    return null;
  }, [has, status, userId, voucher]);

  const signersMissing = !!voucher && status === "Pending Check" && (!voucher.cheque_signed_by || !voucher.cheque_counter_signed_by);

  const steps: Step[] = useMemo(() => {
    if (!voucher) return [];
    const position = status === "Paid" || status === "Authorized" ? CHAIN.length : Math.max(0, CHAIN.indexOf(status as (typeof CHAIN)[number]));
    const state = (index: number): StepState => (index < position ? "done" : index === position && !fullySigned ? "current" : "waiting");
    return [
      { key: "prepared", title: "Prepared", who: "Account Officer", name: voucher.prepared_by_name, at: voucher.prepared_at, sig: voucher.prepared_signature_url, state: "done" },
      { key: "checked", title: "Checked", who: "Auditor", name: voucher.checked_by_name, at: voucher.checked_at, sig: voucher.checked_signature_url, state: state(0) },
      { key: "cheque", title: "Cheque signed", who: voucher.cheque_signed_by_name ? `Cheque Signer — ${voucher.cheque_signed_by_name}` : "Cheque Signer (not assigned)", name: voucher.cheque_signed_at ? voucher.cheque_signed_by_name : null, at: voucher.cheque_signed_at, sig: voucher.cheque_signed_signature_url, state: state(1) },
      { key: "counter", title: "Counter-signed", who: voucher.cheque_counter_signed_by_name ? `Counter Signer — ${voucher.cheque_counter_signed_by_name}` : "Counter Signer (not assigned)", name: voucher.cheque_counter_signed_at ? voucher.cheque_counter_signed_by_name : null, at: voucher.cheque_counter_signed_at, sig: voucher.cheque_counter_signed_signature_url, state: state(2) },
      { key: "authorised", title: "Authorised", who: "Director General", name: voucher.authorized_by_name, at: voucher.authorized_at, sig: voucher.authorized_signature_url, state: state(3) },
      { key: "received", title: "Received", who: "Payee", name: status === "Paid" ? voucher.payee_signed_name : null, at: status === "Paid" ? voucher.payee_signed_at : null, sig: status === "Paid" ? voucher.payee_signature_url : null, state: status === "Paid" ? "done" : status === "Authorized" ? "current" : "waiting" },
    ];
  }, [fullySigned, status, voucher]);

  async function run(task: () => Promise<{ error: { message: string } | null }>, success: string) {
    setBusy(true);
    setMessage(null);
    try {
      const { error } = await task();
      if (error) throw new Error(error.message);
      setMessage({ tone: "ok", text: success });
      setComment("");
      await load();
    } catch (caught) {
      setMessage({ tone: "error", text: caught instanceof Error ? caught.message : "The action failed." });
    } finally {
      setBusy(false);
    }
  }

  async function sign() {
    if (!voucher || !myStep) return;
    const ok = await confirmDialog({
      title: myStep.title,
      message: `${voucher.voucher_no} — ${voucher.payee_name || "Payee"} — ${naira(voucher.total_amount ?? voucher.amount)}`,
      details: ["Your saved profile signature will be appended to this payment voucher."],
      confirmLabel: myStep.label,
    });
    if (!ok) return;
    await run(async () => supabase.rpc("reqgen_pv_sign", { p_voucher_id: voucher.id, p_comment: comment.trim() || null }), "Signed. The voucher has moved to the next signer.");
  }

  async function assignSigners() {
    if (!voucher) return;
    if (!chequeSigner || !counterSigner) { setMessage({ tone: "error", text: "Select both the Cheque Signer and the Counter Signer." }); return; }
    if (key(chequeSigner) === key(counterSigner)) { setMessage({ tone: "error", text: "Cheque Signer and Counter Signer cannot be the same person." }); return; }
    await run(async () => supabase.rpc("reqgen_pv_assign_signers", { p_voucher_id: voucher.id, p_cheque_signed_by_name: chequeSigner, p_counter_signatory_name: counterSigner }), "Signers assigned.");
  }

  async function markPaid() {
    if (!voucher) return;
    const ok = await confirmDialog({
      title: "Mark voucher as paid?",
      message: `${voucher.voucher_no} — ${naira(voucher.total_amount ?? voucher.amount)} to ${voucher.payee_name || "the payee"}.`,
      details: ["The payee's saved signature is added as \"Received by\"."],
      confirmLabel: "Mark as paid",
    });
    if (!ok) return;
    await run(async () => supabase.rpc("update_payment_voucher_status", { p_voucher_id: voucher.id, p_action_type: "Pay", p_comment: comment.trim() || null }), "Voucher marked as paid.");
  }

  async function cancelVoucher() {
    if (!voucher) return;
    const ok = await confirmDialog({ title: "Cancel this voucher?", message: `${voucher.voucher_no} will be cancelled and its requests can receive a new voucher.`, confirmLabel: "Cancel voucher", cancelLabel: "Keep voucher", tone: "danger" });
    if (!ok) return;
    await run(async () => supabase.rpc("update_payment_voucher_status", { p_voucher_id: voucher.id, p_action_type: "Cancel", p_comment: comment.trim() || null }), "Voucher cancelled.");
  }

  async function deleteVoucher() {
    if (!voucher) return;
    const ok = await confirmDialog({ title: "Delete payment voucher?", message: `Permanently delete ${voucher.voucher_no}?`, details: ["Linked request(s) will be able to generate a new payment voucher.", "This action cannot be undone."], confirmLabel: "Delete voucher", tone: "danger" });
    if (!ok) return;
    setBusy(true);
    const { error } = await supabase.rpc("delete_payment_voucher_for_regeneration", { p_voucher_id: voucher.id });
    setBusy(false);
    if (error) { setMessage({ tone: "error", text: error.message }); return; }
    router.push(listPath);
  }

  const chequeSigners = signatories.filter((s) => key(s.signatory_type) === "chequesigner");
  const counterSigners = signatories.filter((s) => key(s.signatory_type) === "countersigner");

  if (loading && !voucher) {
    return <main className="rg-pvd"><PageHeader title="Payment Voucher" description="Loading voucher..." /></main>;
  }

  if (!voucher) {
    return (
      <main className="rg-pvd">
        <PageHeader title="Payment Voucher" actions={<button type="button" className="rg-btn rg-btn-secondary" onClick={() => router.push(listPath)}><ArrowLeft size={15} /> Back to vouchers</button>} />
        {message ? <div className={`rg-pvd-message is-${message.tone}`} role="alert">{message.text}</div> : null}
      </main>
    );
  }

  return (
    <main className="rg-pvd">
      <PageHeader
        title={voucher.voucher_no}
        description={`${voucher.payee_name || "Payee"} · ${naira(voucher.total_amount ?? voucher.amount)} · ${voucher.disbursement_mode || "—"}`}
        actions={
          <div className="rg-pvd-actions">
            <button type="button" className="rg-btn rg-btn-secondary" onClick={() => router.push(listPath)}><ArrowLeft size={15} /> Vouchers</button>
            <button type="button" className="rg-btn rg-btn-secondary" onClick={() => void load()} disabled={loading || busy}><RefreshCw size={15} /> Refresh</button>
            {voucher.request_id ? <button type="button" className="rg-btn rg-btn-secondary" onClick={() => router.push(`/requests/${voucher.request_id}`)}><FileText size={15} /> Request</button> : null}
            {!fromApprovals ? (
            <button
              type="button"
              className="rg-btn rg-btn-primary"
              disabled={!fullySigned}
              title={fullySigned ? "Print the A4 voucher" : "Available once every signature and the DG's authorisation are in"}
              onClick={() => router.push(printPath(voucher.id))}
            >
              <Printer size={15} /> Print voucher
            </button>
            ) : null}
          </div>
        }
      />

      {message ? <div className={`rg-pvd-message is-${message.tone}`} role="status">{message.text}</div> : null}

      <section className="rg-pvd-stats">
        <StatTile title="Status" value={status.startsWith("Pending") ? "Pending" : statusLabel(status)} tone={statusTone(status)} note={status.startsWith("Pending") ? status.replace("Pending ", "Awaiting ") : voucher.signing_stage || " "} />
        <StatTile title="Total amount" value={naira(voucher.total_amount ?? voucher.amount)} tone="blue" note={`${voucher.item_count || items.length || 1} request(s)`} />
        <StatTile title="Disbursement" value={voucher.disbursement_mode || "—"} tone="purple" note={voucher.voucher_scope === "Multiple" ? "Combined voucher" : "Single voucher"} />
        <StatTile title="Signatures" value={`${steps.filter((s) => s.state === "done" && s.key !== "received").length} of 5`} tone="orange" note={fullySigned ? "Fully signed" : "Signing in progress"} />
      </section>

      <section className="rg-pvd-card">
        <header><h2>Signing chain</h2><p>Each officer signs at their own step. The next signer is notified in the app.</p></header>
        <ol className="rg-pvd-chain">
          {steps.map((step, index) => (
            <li key={step.key} className={`is-${step.state}`}>
              <span className="rg-pvd-dot" aria-hidden="true">
                {step.state === "done" ? <CheckCircle2 size={18} /> : step.state === "current" ? <Clock3 size={18} /> : <Circle size={18} />}
              </span>
              <div className="rg-pvd-step">
                <small>{index + 1}. {step.title}</small>
                <strong>{step.name || (step.state === "current" ? "Waiting" : "—")}</strong>
                <span>{step.who}</span>
                {step.at ? <em>{dateTime(step.at)}</em> : null}
              </div>
              <div className="rg-sig-slot rg-pvd-sig">{step.sig ? <SignatureInk src={signatureUrl(step.sig)} alt={`${step.name || step.title} signature`} /> : null}</div>
            </li>
          ))}
        </ol>

        {myStep ? (
          <div className="rg-pvd-act">
            <label>Comment (optional)<textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2} placeholder="Add a note to the voucher history" /></label>
            <button type="button" className="rg-btn rg-btn-primary" onClick={() => void sign()} disabled={busy || signersMissing}><PenLine size={15} /> {myStep.label}</button>
          </div>
        ) : !fullySigned && status !== "Cancelled" ? (
          <p className="rg-pvd-waiting">Waiting for: {steps.find((s) => s.state === "current")?.who || "the next signer"}.</p>
        ) : null}

        {status === "Authorized" && isAccount ? (
          <div className="rg-pvd-act">
            <p>Fully signed and authorised. Mark it paid once the payment is made — the payee&apos;s saved signature is added as &quot;Received by&quot;.</p>
            <button type="button" className="rg-btn rg-btn-primary" onClick={() => void markPaid()} disabled={busy}><UserCheck size={15} /> Mark as paid</button>
          </div>
        ) : null}
      </section>

      {status === "Pending Check" && isAccount ? (
        <section className="rg-pvd-card">
          <header><h2>Signers for this voucher</h2><p>{signersMissing ? "Assign the two signers so the Auditor can check the voucher." : "You can change the signers until the Auditor checks the voucher."}</p></header>
          <div className="rg-pvd-assign">
            <label>Cheque Signer *
              <select value={chequeSigner} onChange={(e) => setChequeSigner(e.target.value)}>
                <option value="">Select the Cheque Signer</option>
                {chequeSigners.map((s) => <option key={s.id} value={s.full_name}>{s.full_name}</option>)}
              </select>
            </label>
            <label>Counter Signer *
              <select value={counterSigner} onChange={(e) => setCounterSigner(e.target.value)}>
                <option value="">Select the Counter Signer</option>
                {counterSigners.map((s) => <option key={s.id} value={s.full_name}>{s.full_name}</option>)}
              </select>
            </label>
            <button type="button" className="rg-btn rg-btn-primary" onClick={() => void assignSigners()} disabled={busy}>Save signers</button>
          </div>
        </section>
      ) : null}

      <section className="rg-pvd-grid">
        <article className="rg-pvd-card">
          <header><h2>Voucher details</h2></header>
          <dl className="rg-pvd-dl">
            <div><dt>Payee</dt><dd>{voucher.payee_name || "—"}</dd></div>
            <div><dt>Request</dt><dd>{voucher.request_no || "—"}</dd></div>
            <div><dt>Department</dt><dd>{voucher.dept_name || "—"}</dd></div>
            <div><dt>Subhead</dt><dd>{voucher.subhead_code ? `${voucher.subhead_code} — ${voucher.subhead_name || ""}` : voucher.subhead_name || "—"}</dd></div>
            <div><dt>Mode</dt><dd>{voucher.disbursement_mode || "—"}</dd></div>
            {voucher.disbursement_mode === "Transfer" ? <div><dt>Account</dt><dd>{[voucher.transfer_account_name, voucher.transfer_account_number, voucher.transfer_bank_name].filter(Boolean).join(" · ") || "—"}</dd></div> : null}
            {voucher.disbursement_mode === "Cash" ? <div><dt>Cash payee</dt><dd>{voucher.cash_payee_name || "—"}</dd></div> : null}
            {voucher.disbursement_mode === "Cheque" ? <div><dt>Cheque</dt><dd>{[voucher.cheque_no, voucher.bank_name, voucher.cheque_date].filter(Boolean).join(" · ") || "—"}</dd></div> : null}
            <div className="is-wide"><dt>Narration</dt><dd>{voucher.narration || "—"}</dd></div>
          </dl>
        </article>

        <article className="rg-pvd-card">
          <header><h2>Requests on this voucher</h2></header>
          <div className="rg-pvd-table">
            <table>
              <thead><tr><th>#</th><th>Request</th><th>Title</th><th>Amount</th></tr></thead>
              <tbody>
                {items.length ? items.map((item, index) => (
                  <tr key={item.id || index}><td>{index + 1}</td><td>{item.request_no || "—"}</td><td>{item.title || "—"}</td><td>{naira(item.amount)}</td></tr>
                )) : <tr><td colSpan={4}>No items.</td></tr>}
              </tbody>
            </table>
          </div>
        </article>
      </section>

      <section className="rg-pvd-card">
        <header><h2>Voucher history</h2></header>
        <div className="rg-pvd-table">
          <table>
            <thead><tr><th>When</th><th>Action</th><th>By</th><th>From</th><th>To</th><th>Comment</th></tr></thead>
            <tbody>
              {history.length ? history.map((h) => (
                <tr key={h.id}><td>{dateTime(h.created_at)}</td><td>{h.action_type || "—"}</td><td>{h.actor_name || "—"}</td><td>{h.from_status || "—"}</td><td>{h.to_status || "—"}</td><td className="rg-col-text">{h.comment || ""}</td></tr>
              )) : <tr><td colSpan={6}>No history yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {has("admin", "auditor") && status !== "Paid" ? (
        <section className="rg-pvd-card rg-pvd-danger">
          <header><h2>Administration</h2><p>Cancel or delete only when the voucher was raised in error.</p></header>
          <div className="rg-pvd-actions">
            {status !== "Cancelled" ? <button type="button" className="rg-btn rg-btn-secondary" onClick={() => void cancelVoucher()} disabled={busy}><XCircle size={15} /> Cancel voucher</button> : null}
            <button type="button" className="rg-btn rg-btn-danger" onClick={() => void deleteVoucher()} disabled={busy}><Trash2 size={15} /> Delete for regeneration</button>
          </div>
        </section>
      ) : null}
    </main>
  );
}
