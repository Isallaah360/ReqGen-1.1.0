import QRCode from "qrcode";
import { db, SUPABASE_URL } from "./core";
import { savePdf } from "./files2";
import type { ScheduleLine, Voucher } from "./vouchers";

/**
 * App 4.1.0: the IET standard A4 documents, made in the app: the request letter (page 2: its comments)
 * and the payment voucher. They copy the website's own print templates (app/requests/[id]/print and
 * app/payment-vouchers/[id]/print): the same layout, the same words, the same QR check code (the QR is
 * printed on paper; the app itself never calls the website). The PDF opens in the phone's own viewer.
 */

// The QR on the paper points to the public check page, exactly as the website prints it.
const CHECK_SITE = "https://ietreqgen.barderians.com.ng";
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
const naira = (n: unknown) => `₦${Number(n || 0).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const ukDate = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "");
const LOGO = "./iet-logo.png";
const STAMP = "./iet-stamp.png";

export function signatureUrl(value: string | null | undefined) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  if (/^(https?:|data:image\/|blob:)/.test(raw)) return raw;
  return `${SUPABASE_URL}/storage/v1/object/public/signatures/${raw.replace(/^signatures\//, "").replace(/^\/+/, "")}`;
}

/** Images from storage are drawn into the PDF as data, so the PDF never depends on the network later. */
async function inline(url: string | null) {
  if (!url) return null;
  if (url.startsWith("data:") || url.startsWith("./")) return url;
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const b = await r.blob();
    return await new Promise<string>((ok) => { const f = new FileReader(); f.onload = () => ok(String(f.result)); f.readAsDataURL(b); });
  } catch { return null; }
}
const qr = (path: string) => QRCode.toDataURL(`${CHECK_SITE}${path}`, { errorCorrectionLevel: "M", margin: 2, width: 240, color: { dark: "#000000", light: "#ffffff" } }).catch(() => null);

/** "Three Hundred and Twenty Thousand Naira Only" (the website voucher's own wording). */
export function amountToWords(n: number | null | undefined) {
  const num = Math.round(Number(n || 0));
  if (num === 0) return "Zero Naira Only";
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  const below1000 = (x: number): string => {
    const h = Math.floor(x / 100), r = x % 100;
    const rest = r < 20 ? ones[r] : `${tens[Math.floor(r / 10)]}${r % 10 ? ` ${ones[r % 10]}` : ""}`;
    return [h ? `${ones[h]} Hundred` : "", rest ? (h ? `and ${rest}` : rest) : ""].filter(Boolean).join(" ");
  };
  const scales: Array<[number, string]> = [[1e9, "Billion"], [1e6, "Million"], [1e3, "Thousand"]];
  let left = num; const parts: string[] = [];
  for (const [v, w] of scales) if (left >= v) { parts.push(`${below1000(Math.floor(left / v))} ${w}`); left %= v; }
  if (left) parts.push(left < 100 && parts.length ? `and ${below1000(left)}` : below1000(left));
  return `${parts.join(" ")} Naira Only`;
}

// The website's print styles (app/globals.css: A4 document standard, request document, signatures),
// prefixed p4- so the app's own screen styles never touch the paper.
const CSS = `
.p4-page{box-sizing:border-box;width:794px;height:1123px;padding:45px 53px;overflow:hidden;position:relative;background:#fff;color:#000;font-family:Aptos,"Segoe UI",Arial,sans-serif;display:flex}
.p4-page *{box-sizing:border-box;color:#000}
.p4-page::before{content:"";position:absolute;left:0;right:0;top:0;height:5px;background:linear-gradient(90deg,#f06c24,#e43c24 40%,#f09c18 75%,#30a8d8)}
.p4-page::after{content:"";position:absolute;left:0;right:0;bottom:0;height:3px;opacity:.85;background:linear-gradient(90deg,#f06c24,#e43c24 40%,#f09c18 75%,#30a8d8)}
.p4-content{display:flex;flex-direction:column;width:100%;flex:1}
.p4-grow{flex:1 1 auto}
.p4-req{font-size:12.5px;line-height:1.5;font-weight:600}
.p4-head{text-align:center}
.p4-head img{display:block;margin:0 auto 6px;height:74px;width:auto}
.p4-org{font-size:21px;font-weight:900;letter-spacing:-.01em;text-transform:uppercase;line-height:1.1}
.p4-addr{font-size:11px;font-weight:600;line-height:1.35;margin-top:2px}
.p4-subhead{display:flex;align-items:center;gap:10px;margin-top:16px;font-size:12px;font-weight:900}
.p4-subhead>div{flex:1;min-height:28px;border:1.4px solid #000;border-radius:4px;padding:4px 10px;font-weight:700;line-height:18px}
.p4-to{margin-top:16px;font-weight:800;line-height:1.4}
.p4-salute{margin-top:14px;font-weight:800}
.p4-title{margin-top:10px;text-align:center;font-size:14px;font-weight:900;text-transform:uppercase;text-decoration:underline;text-underline-offset:3px}
.p4-intro{margin:10px 0 0}
.p4-amount{display:inline-block;min-width:190px;border-bottom:1.4px solid #000;padding:0 8px;text-align:center;font-weight:900}
.p4-body{margin-top:10px;min-height:150px;border-bottom:1px solid rgba(0,0,0,.45);padding-bottom:10px;white-space:pre-wrap;overflow-wrap:anywhere}
.p4-body strong{display:block;margin-bottom:6px;font-weight:900;text-transform:uppercase}
.p4-close{margin-top:12px;font-weight:800}
.p4-bal{margin:10px 0 0 auto;display:grid;gap:6px;width:340px}
.p4-bal>div{display:grid;grid-template-columns:140px 1fr;align-items:center;gap:8px;font-size:11px;font-weight:900;text-align:right}
.p4-bal>div>span:last-child{border:1.2px solid #000;border-radius:4px;padding:2px 8px;font-weight:700}
.p4-sigs{margin-top:18px;display:grid;gap:18px;font-size:11.5px;font-weight:700}
.p4-sl{display:grid;grid-template-columns:142px minmax(0,1.25fr) minmax(0,1fr) minmax(0,1.4fr) 84px;gap:10px;align-items:end}
.p4-sl-label{font-weight:800;line-height:1.25;padding-bottom:2px}
.p4-sl-cell{min-height:22px;border-bottom:1px solid #000;padding:0 4px 2px 0;font-size:11px;font-weight:600;line-height:1.25;overflow-wrap:anywhere}
.p4-sl-cell.q-c{text-align:center;white-space:nowrap}
.p4-slot{height:56px;padding:0;position:relative;overflow:visible}
.p4-slot img.q-s{position:absolute;left:4px;right:4px;bottom:2px;height:50px;width:calc(100% - 8px);object-fit:contain;object-position:left bottom;mix-blend-mode:multiply}
.p4-slot img.q-st{position:absolute;right:-6px;top:50%;transform:translateY(-50%) rotate(-8deg);height:62px;width:auto;opacity:.85;mix-blend-mode:multiply}
.p4-cap{padding-top:2px;text-align:center;font-size:8.5px;font-weight:600}
.p4-cap *{color:#4b5563}
.p4-foot{margin-top:14px;display:flex;justify-content:space-between;align-items:flex-end;font-size:10px}
.p4-foot *{color:#4b5563}
.p4-foot em{font-weight:600}
.p4-trail-head{display:flex;align-items:center;gap:12px;border-bottom:2px solid #000;padding-bottom:8px}
.p4-trail-head img{height:44px;width:auto}
.p4-trail-title{font-size:13px;font-weight:800}
.p4-trail{list-style:none;margin:12px 0 0;padding:0;display:flex;flex-direction:column;gap:10px;font-size:12px}
.p4-trail li{border-bottom:1px solid rgba(0,0,0,.25);padding-bottom:8px}
.p4-trail .q-w{display:flex;justify-content:space-between;gap:10px;font-weight:800}
.p4-trail .q-a{font-size:11px;font-weight:600}
.p4-trail .q-t{margin-top:3px;font-weight:600;white-space:pre-wrap}
/* payment voucher (the website's voucher sheet) */
.p4-pv{border:2px solid #000;padding:12px 14px;font-size:11px}
.p4-pvh{display:grid;grid-template-columns:70px 1fr 188px;align-items:start;gap:12px}
.p4-pvh img{height:62px;width:auto}
.p4-pvh .q-o{font-size:20px;font-weight:900;text-transform:uppercase;line-height:1;text-align:center}
.p4-pvh .q-a{font-size:10.5px;font-weight:700;line-height:1.25;text-align:center;margin-top:3px}
.p4-pvh .q-d{font-size:16px;font-weight:900;text-transform:uppercase;text-decoration:underline;text-align:center;margin-top:6px}
.p4-tb{display:grid;grid-template-columns:54px 1fr;border:1px solid #000;font-size:10px;font-weight:700;margin-bottom:-1px}
.p4-tb>div{padding:4px}.p4-tb>div:first-child{border-right:1px solid #000;background:#f1f5f9}
.p4-rule{height:2px;background:#000;margin-top:8px}
.p4-g12{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:6px 12px;margin-top:8px}
.p4-lf{display:flex;align-items:flex-end;gap:4px}
.p4-lf>div:first-child{flex:0 0 auto;font-size:11px;font-weight:900}
.p4-lf>div:last-child{flex:1;min-width:0;border-bottom:1px solid #000;padding:0 4px 1px;font-size:11px;font-weight:700;line-height:1.2;overflow-wrap:anywhere}
.q-s7{grid-column:span 7}.q-s5{grid-column:span 5}.q-s12{grid-column:span 12}.q-s4{grid-column:span 4}.q-s6{grid-column:span 6}.q-s8{grid-column:span 8}
.p4-items{margin-top:8px;border:2px solid #000;display:flex;flex-direction:column;flex:1 1 auto;min-height:120px}
.p4-ir{display:grid;grid-template-columns:1fr 8fr 3fr}
.p4-ir>div{padding:4px 6px}.p4-ir>div+div{border-left:2px solid #000}
.p4-ir.q-h{border-bottom:2px solid #000;background:#f1f5f9;font-size:10.5px;font-weight:900;text-transform:uppercase}
.p4-ir.q-l{border-bottom:1px solid #000;font-size:11px;font-weight:700}
.p4-ir .q-n{text-align:center}.p4-ir .q-m{text-align:right;font-weight:900}
.p4-ir .q-p{white-space:pre-wrap;line-height:1.2}
.p4-tot{display:grid;grid-template-columns:9fr 3fr;border-top:2px solid #000;font-size:12px;font-weight:900;margin-top:auto}
.p4-tot>div{padding:4px 8px;text-align:right}.p4-tot>div:first-child{border-right:2px solid #000;text-transform:uppercase}
.p4-box{margin-top:8px;border:2px solid #000}
.p4-bh{border-bottom:2px solid #000;background:#f1f5f9;padding:4px 8px;font-size:10.5px;font-weight:900;text-transform:uppercase}
.p4-words{padding:4px 8px;font-size:11.5px;font-weight:700}
.p4-fill{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:8px;padding:8px}
.p4-fb{border:1px solid #000}
.p4-fb>div:first-child{border-bottom:1px solid #000;background:#f1f5f9;padding:4px 8px;font-size:9.5px;font-weight:900;text-transform:uppercase}
.p4-fb>div:last-child{min-height:25px;padding:4px 8px;font-size:11px;font-weight:700;line-height:1.2;overflow-wrap:anywhere}
.p4-sched{width:100%;border-collapse:collapse;font-size:10.5px;font-weight:700}
.p4-sched th,.p4-sched td{border-top:1px solid #000;padding:3px 6px;text-align:left}.p4-sched .q-r{text-align:right}
.p4-cert{display:grid;grid-template-columns:1fr 1fr;gap:12px 20px;padding:10px 12px}
.p4-sb .q-t{font-size:10px;font-weight:900;text-transform:uppercase}
.p4-sb .q-g{display:grid;grid-template-columns:minmax(0,1.45fr) minmax(0,1fr) 74px;gap:8px;align-items:end;margin-top:4px}
.p4-sb .q-g>div{border-bottom:1px solid #000;padding-bottom:2px;font-size:10.5px;font-weight:700;line-height:1.2;overflow-wrap:anywhere}
.p4-sb .q-g>div.q-c{text-align:center;font-size:10px}
.p4-sb .q-slot{height:44px;position:relative;overflow:visible}
.p4-sb .q-slot img.q-s{position:absolute;left:2px;right:2px;bottom:2px;height:40px;width:calc(100% - 4px);object-fit:contain;object-position:left bottom;mix-blend-mode:multiply}
.p4-sb .q-slot img.q-st{position:absolute;right:-18px;top:50%;transform:translateY(-55%) rotate(-8deg);height:46px;width:auto;opacity:.85;mix-blend-mode:multiply}
.p4-sb .q-cap{display:grid;grid-template-columns:minmax(0,1.45fr) minmax(0,1fr) 74px;gap:8px;text-align:center;font-size:8.5px;font-weight:600}
.p4-sb .q-cap *{color:#475569}
.p4-pvfoot{margin-top:8px;display:flex;justify-content:space-between;align-items:center;font-size:10px;font-weight:600}
`;

async function render(pages: string[], title: string) {
  const host = document.createElement("div");
  host.style.cssText = "position:fixed;left:-10000px;top:0;z-index:-1;pointer-events:none";
  host.innerHTML = `<style>${CSS}</style>${pages.map((p) => `<div class="p4-page">${p}</div>`).join("")}`;
  document.body.appendChild(host);
  try {
    await Promise.all(Array.from(host.querySelectorAll("img")).map((im) => (im.complete ? Promise.resolve() : new Promise((ok) => { im.onload = im.onerror = () => ok(null); }))));
    await savePdf(Array.from(host.querySelectorAll<HTMLElement>(".p4-page")), title);
  } finally { host.remove(); }
}

// ---- payment voucher -------------------------------------------------------------------------------------
type PvItem = { request_no: string | null; title: string | null; amount: number | null; requester_name?: string | null; subhead_id?: string | null; subhead_code?: string | null; subhead_name?: string | null };
const norm = (s: unknown) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
function categoryLabel(v: Voucher) {
  const rt = norm(v.request_type), pc = norm(v.personal_category);
  if (v.voucher_type === "Manual" || v.voucher_origin === "Manual") return "Manual Voucher";
  if (rt === "official") return "Official Request";
  if (rt === "personal" && pc === "fund") return "Personal Fund Request";
  if (rt === "personal" && pc === "nonfund") return "Personal Non-Fund Request";
  return v.request_type || "Official Request";
}
function particulars(i: PvItem) {
  const sub = i.subhead_id || i.subhead_code ? `${i.subhead_code || ""} ${i.subhead_name || ""}`.trim() : "";
  return `${i.request_no || "Request"}: ${i.title || "Payment request"}${sub ? `\nSubhead: ${sub}` : ""}`;
}
const fb = (label: string, value: unknown, span: string) => `<div class="p4-fb ${span}"><div>${esc(label)}</div><div>${esc(value || "")}</div></div>`;
const lf = (label: string, value: unknown, span: string) => `<div class="p4-lf ${span}"><div>${esc(label)}</div><div>${esc(value || "")}</div></div>`;
const sbox = (title: string, name: string, sig: string | null, when: string, stamp = false) =>
  `<div class="p4-sb"><div class="q-t">${esc(title)}</div><div class="q-g"><div>${esc(name)}</div><div class="q-slot">${sig ? `<img class="q-s" src="${sig}" alt="">` : ""}${stamp && sig ? `<img class="q-st" src="${STAMP}" alt="">` : ""}</div><div class="q-c">${esc(when)}</div></div><div class="q-cap"><div>Name</div><div>Signature</div><div>Date</div></div></div>`;

/** The IET payment voucher, one A4 page (the website's voucher sheet). */
export async function printVoucher(v: Voucher, items: PvItem[], schedule: ScheduleLine[]) {
  const total = Number(v.total_amount ?? v.amount ?? 0);
  const [sp, sc, sa, scs, code] = await Promise.all([inline(signatureUrl(v.prepared_signature_url)), inline(signatureUrl(v.checked_signature_url)), inline(signatureUrl(v.authorized_signature_url)), inline(signatureUrl(v.cheque_counter_signed_signature_url)), qr(`/check/v/${v.id}`)]);
  const multiple = items.length > 1 || v.voucher_scope === "Multiple";
  const lines = (items.length ? items : [{ request_no: v.request_no, title: v.narration, amount: total, subhead_code: v.subhead_code, subhead_name: v.subhead_name, subhead_id: v.subhead_id }]).slice(0, 10);
  const mode = v.disbursement_mode || "Transfer";
  const one = schedule.length === 1 ? schedule[0] : null;
  const disb = mode === "Cheque"
    ? fb("Mode", "Cheque", "q-s4") + fb("Cheque No.", v.cheque_no, "q-s4") + fb("Cheque Date", ukDate(v.cheque_date), "q-s4") + fb("Bank", v.bank_name, "q-s6") + fb("Counter Signed By", v.cheque_counter_signed_by_name, "q-s6")
    : mode === "Cash"
      ? fb("Mode", "Cash", "q-s4") + fb("Payee Name", v.cash_payee_name || v.payee_name, "q-s8")
      : fb("Mode", schedule.length > 1 ? `Transfer, ${schedule.length} accounts` : "Transfer", "q-s4") + fb("Account Number", one?.account_number || v.transfer_account_number, "q-s4") + fb("Bank", one?.bank_name || v.transfer_bank_name, "q-s4") + fb("Account Name", schedule.length > 1 ? "As listed below" : one?.account_name || v.transfer_account_name, "q-s12");
  const sec = v.prepared_section;
  const page = `<div class="p4-content p4-pv">
    <div class="p4-pvh">
      <div><img src="${LOGO}" alt=""></div>
      <div><div class="q-o">Islamic Education Trust</div><div class="q-a">IW2, Ilmi Avenue Intermediate Housing Estate, PMB 229</div><div class="q-a">Minna, Niger State - Nigeria</div><div class="q-d">Payment Voucher</div></div>
      <div><div class="p4-tb"><div>PV No.</div><div>${esc(v.voucher_no)}</div></div><div class="p4-tb"><div>Date</div><div>${esc(ukDate(v.created_at))}</div></div><div class="p4-tb"><div>Status</div><div>${esc(v.status)}</div></div></div>
    </div>
    <div class="p4-rule"></div>
    <div class="p4-g12">
      ${lf("Payee:", Number(v.payee_count || 1) > 1 ? `${v.payee_count} payees, as listed below` : String(v.payee_name || v.cash_payee_name || "").toUpperCase(), "q-s7")}
      ${lf("Request:", multiple ? `${items.length || v.item_count || 0} Requests` : v.request_no || items[0]?.request_no || "", "q-s5")}
      ${lf("Department:", v.dept_name, "q-s7")}
      ${lf("Type:", categoryLabel(v), "q-s5")}
      ${lf("Subhead:", multiple ? "Multiple / As listed below" : `${v.subhead_code || ""} ${v.subhead_name || ""}`.trim(), "q-s12")}
    </div>
    <div class="p4-items">
      <div class="p4-ir q-h"><div class="q-n">No</div><div>Details / Particulars</div><div class="q-m">Amount</div></div>
      ${lines.map((i, n) => `<div class="p4-ir q-l"><div class="q-n">${n + 1}</div><div class="q-p">${esc(particulars(i))}</div><div class="q-m">${naira(i.amount)}</div></div>`).join("")}
      <div class="p4-tot"><div>Total</div><div>${naira(total)}</div></div>
    </div>
    <div class="p4-box"><div class="p4-bh">Amount in Words</div><div class="p4-words">${esc(amountToWords(total))}</div></div>
    <div class="p4-box"><div class="p4-bh">Disbursement Details</div><div class="p4-fill">${disb}</div>
      ${schedule.length > 1 ? `<table class="p4-sched"><thead><tr><th>Account name</th><th>Account No.</th><th>Bank</th><th class="q-r">Amount</th></tr></thead><tbody>${schedule.map((l) => `<tr><td>${esc(l.account_name)}</td><td>${esc(l.account_number)}</td><td>${esc(l.bank_name)}</td><td class="q-r">${naira(l.amount)}</td></tr>`).join("")}</tbody></table>` : ""}</div>
    <div class="p4-box"><div class="p4-bh">Certification / Approval / Receipt</div><div class="p4-cert">
      ${sbox("Prepared By", v.prepared_by_name ? `${v.prepared_by_name}, Account Officer${sec ? `, ${sec}` : ""}` : "", sp, ukDate(v.prepared_at))}
      ${sbox("Checked By", v.checked_by_name || "", sc, ukDate(v.checked_at))}
      ${sbox("Authorized By", v.authorized_by_name || "", sa, ukDate(v.authorized_at), true)}
      ${sbox("Received By", String(v.payee_name || "").toUpperCase(), null, ukDate(v.paid_at || v.paid_on))}
      ${sbox("Cheque Signed By", "", null, "")}
      ${sbox("Counter Signed By", v.cheque_counter_signed_by_name || v.counter_signatory_name || "", scs, ukDate(v.cheque_counter_signed_at))}
    </div></div>
    <div class="p4-pvfoot"><span style="display:flex;align-items:center;gap:8px">${code ? `<img src="${code}" alt="" style="width:52px;height:52px">` : ""}<span>Official IET Payment Voucher, Generated by ReqGen${multiple ? ", Combined PV" : ""}<br>Scan the code to check this voucher.</span></span><em>Building Bridges</em></div>
  </div>`;
  await render([page], `${v.voucher_no || "Payment voucher"}`);
}

// ---- request letter ----------------------------------------------------------------------------------------
type Hist = { id: string; action_type: string | null; comment: string | null; to_stage: string | null; from_stage: string | null; created_at: string; actor_name: string | null; signature_url: string | null; actor_role_key: string | null; actor_role_name: string | null; actor_signature_url: string | null };
const approve = (h: Hist) => { const a = norm(h.action_type); return !!a && !/reject|return|declin|cancel|withdraw|comment|attachment|submit|create|view|corrected/.test(a) && /approv|recommend|forward|endors|check|treat|confirm|verif|authori/.test(a); };
const roleIs = (h: Hist, keys: string[]) => keys.includes(norm(h.actor_role_key || h.actor_role_name).replace(/\d+$/, ""));
const stageIs = (s: string | null, keys: string[]) => keys.includes(norm(s));

/** The IET request letter (page 1, the website's letter) and its comments (page 2). */
export async function printRequest(id: string) {
  const c = await db();
  const [d, h, b] = await Promise.all([
    c.rpc("get_print_request_detail", { p_request_id: id }),
    c.from("request_history").select("id,action_type,comment,to_stage,from_stage,created_at,actor_name,signature_url,actor_role_key,actor_role_name,actor_signature_url").eq("request_id", id).order("created_at", { ascending: true }),
    c.from("reqgen_request_budget_lines").select("allocation_bd,expenditure,balance_cd").eq("request_id", id).maybeSingle(),
  ]);
  if (d.error) throw new Error(d.error.message);
  const r = (Array.isArray(d.data) ? d.data[0] : d.data) as Record<string, string | number | null> | null;
  if (!r) throw new Error("This request cannot be printed by you.");
  const hist = (h.data || []) as Hist[];
  const latest = (f: (x: Hist) => boolean) => [...hist].reverse().find(f) || null;
  const official = norm(r.request_type) === "official";
  const personalFund = !official && norm(r.personal_category) === "fund";
  const personalOther = !official && !personalFund;
  const checked = latest((x) => approve(x) && roleIs(x, ["po", "pd", "dod", "director", "dinadmin", "registrar", "hod"]))
    || (!official ? latest((x) => approve(x) && (roleIs(x, ["hr", "hrofficer", "hrcoordinator"]) || stageIs(x.from_stage, ["hr"]))) : null)
    || latest((x) => approve(x) && (roleIs(x, ["account", "accounts", "accountofficer"]) || stageIs(x.from_stage, ["account"])));
  const dgH = latest((x) => approve(x) && (roleIs(x, ["dg"]) || stageIs(x.from_stage, ["dg"])));
  const sigOf = (x: Hist | null) => signatureUrl(x?.actor_signature_url || x?.signature_url || null);
  const [sReq, sChk, sDg, code] = await Promise.all([
    inline(signatureUrl(String(r.requester_signature_snapshot || r.requester_signature || r.signature_url || "") || null)),
    inline(sigOf(checked)), inline(sigOf(dgH) || signatureUrl(String(r.dg_signature_snapshot || "") || null)), qr(`/check/r/${id}`),
  ]);
  const amount = Number(r.amount || 0);
  const bl = b.data as { allocation_bd?: number; expenditure?: number; balance_cd?: number } | null;
  const title = personalFund ? "Personal Fund Request" : personalOther ? "Personal Request" : "Request for Fund";
  const subhead = official ? `${r.subhead_code || ""}${r.subhead_name ? ` \u2014 ${r.subhead_name}` : ""}`.trim() : personalFund ? "Personal Fund Request" : `Personal Request${r.personal_category ? `, ${r.personal_category}` : ""}`;
  const line = (label: string, name: string, capacity: string, sig: string | null, when: string, stamp = false) =>
    `<div><div class="p4-sl"><div class="p4-sl-label">${esc(label)}</div><div class="p4-sl-cell">${esc(name)}</div><div class="p4-sl-cell">${esc(capacity)}</div><div class="p4-sl-cell p4-slot">${sig ? `<img class="q-s" src="${sig}" alt="">` : ""}${stamp && sig ? `<img class="q-st" src="${STAMP}" alt="">` : ""}</div><div class="p4-sl-cell q-c">${esc(when)}</div></div><div class="p4-sl p4-cap"><div></div><div>Name</div><div>Capacity</div><div>Signature</div><div>Date</div></div></div>`;
  const page1 = `<div class="p4-content p4-req">
    <header class="p4-head"><img src="${LOGO}" alt=""><div class="p4-org">Islamic Education Trust</div><div class="p4-addr">IW2, Ilmi Avenue Intermediate Housing Estate</div><div class="p4-addr">PMB 229, Minna, Niger State - Nigeria</div></header>
    <div class="p4-subhead"><span>SUB-HEAD:</span><div>${esc(subhead)}</div></div>
    <div class="p4-to"><div>The Director General,</div><div>Islamic Education Trust,</div><div>Minna.</div></div>
    <div class="p4-salute">Assalamu\` Alaikum Sir,</div>
    <div class="p4-title">${esc(title)}</div>
    ${!personalOther ? `<p class="p4-intro">I write to request for the release of the total sum of <span class="p4-amount">${naira(amount)}</span> for the expense below/attached:</p>` : `<p class="p4-intro">I write to request consideration and approval for the personal matter stated below/attached:</p>`}
    <div class="p4-body p4-grow"><strong>${esc(r.title)}</strong>${esc(r.details)}</div>
    <div class="p4-close">Wassalamu\` Alaikum.</div>
    ${official ? `<div class="p4-bal"><div><span>ALLOCATION B/D:</span><span>${naira(bl ? bl.allocation_bd : r.approved_allocation)}</span></div><div><span>EXPENDITURE:</span><span>${naira(bl ? bl.expenditure : r.expenditure)}</span></div><div><span>BALANCE C/D:</span><span>${naira(bl ? bl.balance_cd : r.balance)}</span></div></div>` : ""}
    <div class="p4-sigs">
      ${line("Requested by:", String(r.requester_name || ""), "Requester", sReq, ukDate(String(r.created_at || "")))}
      ${line("Checked by:", checked?.actor_name || String(r.checked_by_name || ""), checked ? checked.actor_role_name || "Reviewer" : "", sChk, checked ? ukDate(checked.created_at) : "")}
      ${line("Approved by Director General, IET:", dgH?.actor_name || String(r.dg_name || ""), dgH?.actor_role_name || "Director General", sDg, dgH ? ukDate(dgH.created_at) : "", true)}
    </div>
    <footer class="p4-foot"><span style="display:inline-flex;align-items:center;gap:8px">${code ? `<img src="${code}" alt="" style="width:58px;height:58px">` : ""}<span style="display:flex;flex-direction:column;line-height:1.2"><span>${esc(r.request_no)}</span><small style="font-size:9px">Scan to check this letter</small></span></span><em>Building Bridges</em></footer>
  </div>`;
  const said = hist.filter((x) => String(x.comment || "").trim() && !/attachment|print/i.test(String(x.action_type || "")));
  const pages = [page1];
  if (said.length) pages.push(`<div class="p4-content p4-req">
    <header class="p4-trail-head"><img src="${LOGO}" alt=""><div><div class="p4-org" style="font-size:15px">Islamic Education Trust</div><div class="p4-trail-title">Comments and approvals on ${esc(r.request_no)}</div></div></header>
    <p style="margin:10px 0 0">Every remark made on this request on its way, in order, as recorded in ReqGen.</p>
    <ol class="p4-trail p4-grow">${said.map((x) => `<li><div class="q-w"><span>${esc(x.actor_name || "Officer")}${x.actor_role_name ? `, ${esc(x.actor_role_name)}` : ""}</span><span>${esc(ukDate(x.created_at))}</span></div><div class="q-a">${esc(x.action_type || "Action")}${x.to_stage && x.to_stage !== x.from_stage ? `, sent to ${esc(x.to_stage)}` : ""}</div><div class="q-t">${esc(x.comment)}</div></li>`).join("")}</ol>
    <footer class="p4-foot"><span>${esc(r.request_no)}, page 2: comments</span><em>Building Bridges</em></footer>
  </div>`);
  await render(pages, String(r.request_no || "Request"));
  void c.rpc("reqgen_log_print", { p_kind: "request", p_doc_id: id, p_doc_no: String(r.request_no || "") });
}
