import { db, SUPABASE_URL } from "./core";
import { savePdf } from "./files2";
import { nairaInWords } from "./money";
import type { ScheduleLine, Voucher } from "./vouchers";

/**
 * App 4.1.0: the IET standard A4 documents, made in the app (no website): the request letter (with a
 * second page of comments) and the payment voucher. One A4 page each, with the request or PV number.
 * The layout follows the website's print templates; the PDF opens in the phone's own viewer to print or share.
 */

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
const money = (n: unknown) => `₦${Number(n || 0).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const date = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "");
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

const CSS = `
.p4-a4{width:794px;height:1123px;background:#fff;color:#000;font-family:"Plus Jakarta Sans",Arial,sans-serif;padding:44px 52px 36px;box-sizing:border-box;display:flex;flex-direction:column;font-size:12.5px;line-height:1.35;position:relative}
.p4-a4 *{box-sizing:border-box}
.p4-hd{display:grid;grid-template-columns:80px 1fr 190px;align-items:center;gap:10px}
.p4-hd img{height:66px;width:auto}
.p4-org{font-size:21px;font-weight:900;text-transform:uppercase;text-align:center;letter-spacing:-.2px}
.p4-adr{font-size:11px;font-weight:700;text-align:center}
.p4-doc{font-size:17px;font-weight:900;text-transform:uppercase;text-decoration:underline;text-align:center;margin-top:6px}
.p4-tb{border:1.5px solid #000;font-size:10px;font-weight:700;margin-bottom:3px;display:flex}
.p4-tb span{padding:3px 5px;border-right:1.5px solid #000;min-width:52px}.p4-tb b{padding:3px 5px;flex:1;overflow-wrap:anywhere}
.p4-rule{height:2px;background:#000;margin:8px 0}
.p4-lf{display:flex;gap:6px;align-items:flex-end;font-size:11.5px;font-weight:700}
.p4-lf span{white-space:nowrap}.p4-lf b{flex:1;border-bottom:1.5px dotted #000;padding:0 4px 1px;font-weight:800;overflow-wrap:anywhere}
.p4-g2{display:grid;grid-template-columns:7fr 5fr;gap:6px 14px}
.p4-box{border:2px solid #000;margin-top:8px}
.p4-bh{background:#EEF2F5;border-bottom:2px solid #000;padding:3px 8px;font-size:10px;font-weight:900;text-transform:uppercase}
table.p4-it{width:100%;border-collapse:collapse;font-size:10.5px;font-weight:700}
table.p4-it th{background:#EEF2F5;border-bottom:2px solid #000;font-size:10px;text-transform:uppercase;padding:4px 6px;text-align:left}
table.p4-it td{border-bottom:1px solid #000;padding:4px 6px;vertical-align:top}
table.p4-it td+td,table.p4-it th+th{border-left:2px solid #000}
table.p4-it .p4-r{text-align:right;white-space:nowrap}
table.p4-it tfoot td{border-top:2px solid #000;border-bottom:0;font-weight:900;font-size:11.5px}
.p4-words{padding:4px 8px;font-size:11px;font-weight:700}
.p4-fill{display:grid;grid-template-columns:repeat(3,1fr);gap:6px 8px;padding:8px}
.p4-fb{border:1.5px solid #000;padding:3px 6px;min-height:36px}.p4-fb small{display:block;font-size:9px;font-weight:800;text-transform:uppercase}.p4-fb b{font-size:11px;overflow-wrap:anywhere}
.p4-sigs{display:grid;grid-template-columns:1fr 1fr;gap:10px 22px;padding:10px 12px}
.p4-sg small{display:block;font-size:9.5px;font-weight:900;text-transform:uppercase}
.p4-sg .p4-ln{display:flex;align-items:flex-end;gap:6px;min-height:46px;border-bottom:1.5px solid #000;position:relative}
.p4-sg .p4-ln img.p4-s{height:40px;width:auto;max-width:150px;object-fit:contain}
.p4-sg .p4-ln img.p4-st{position:absolute;right:-6px;top:50%;transform:translateY(-55%) rotate(-8deg);height:48px;opacity:.85;mix-blend-mode:multiply}
.p4-sg .p4-nm{font-size:10.5px;font-weight:800;margin-top:2px;overflow-wrap:anywhere}.p4-sg .p4-dt{font-size:9.5px}
.p4-ft{margin-top:auto;display:flex;justify-content:space-between;align-items:flex-end;font-size:9.5px;font-weight:600;padding-top:8px;border-top:1px solid #000}
.p4-ft em{font-weight:800;color:#146185}
.p4-lt-sub{display:flex;gap:8px;font-weight:900;font-size:12px;margin-top:10px}
.p4-lt-to{margin-top:14px;font-weight:700}.p4-lt-sal{margin-top:12px;font-weight:700}
.p4-lt-title{margin:12px 0 8px;font-weight:900;text-transform:uppercase;text-decoration:underline;text-align:center;font-size:14px}
.p4-lt-body{flex:1;white-space:pre-wrap;overflow:hidden}
.p4-lt-body strong{display:block;margin-bottom:4px}
.p4-bal{display:flex;flex-direction:column;align-items:flex-end;font-weight:800;font-size:11.5px;gap:2px;margin:8px 0}
.p4-bal div{display:flex;gap:10px}.p4-bal span:last-child{min-width:130px;text-align:right;border-bottom:1px dotted #000}
.p4-sl{display:grid;grid-template-columns:130px 1.3fr 1fr 1.2fr 90px;gap:0 8px;align-items:flex-end;margin-top:8px;font-size:11px}
.p4-sl .p4-c{border-bottom:1.5px solid #000;min-height:40px;display:flex;align-items:flex-end;padding:0 2px 2px;font-weight:700;position:relative;overflow-wrap:anywhere}
.p4-sl .p4-c img.p4-s{height:36px;width:auto;max-width:140px}
.p4-sl .p4-c img.p4-st{position:absolute;right:-4px;top:50%;transform:translateY(-50%) rotate(-8deg);height:56px;opacity:.85;mix-blend-mode:multiply}
.p4-sl .p4-cap{font-size:8.5px;text-align:center;color:#333}
.p4-sl b{font-weight:900}
.p4-trail{list-style:none;margin:10px 0 0;padding:0;display:flex;flex-direction:column;gap:8px}
.p4-trail li{border-bottom:1px solid #999;padding-bottom:6px}.p4-trail .p4-w{display:flex;justify-content:space-between;font-weight:800}.p4-trail .p4-a{font-size:10.5px;color:#333}.p4-trail .p4-t{margin-top:2px}
`;

function header(docTitle: string, boxes: Array<[string, string]>) {
  return `<div class="p4-hd"><img src="${LOGO}" alt=""><div><div class="p4-org">Islamic Education Trust</div><div class="p4-adr">IW2, Ilmi Avenue Intermediate Housing Estate, PMB 229</div><div class="p4-adr">Minna, Niger State, Nigeria</div><div class="p4-doc">${esc(docTitle)}</div></div><div>${boxes.map(([k, v]) => `<div class="p4-tb"><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join("")}</div></div><div class="p4-rule"></div>`;
}
function sig(title: string, name: string, url: string | null, when: string, stamp = false) {
  return `<div class="p4-sg"><small>${esc(title)}</small><div class="p4-ln">${url ? `<img class="p4-s" src="${url}" alt="">` : ""}${stamp && url ? `<img class="p4-st" src="${STAMP}" alt="">` : ""}</div><div class="p4-nm">${esc(name)}</div><div class="p4-dt">${esc(when)}</div></div>`;
}

async function render(pages: string[], title: string) {
  const host = document.createElement("div");
  host.style.cssText = "position:fixed;left:-10000px;top:0;z-index:-1;pointer-events:none";
  host.innerHTML = `<style>${CSS}</style>${pages.map((p) => `<div class="p4-a4">${p}</div>`).join("")}`;
  document.body.appendChild(host);
  try {
    await Promise.all(Array.from(host.querySelectorAll("img")).map((im) => (im.complete ? Promise.resolve() : new Promise((ok) => { im.onload = im.onerror = () => ok(null); }))));
    await savePdf(Array.from(host.querySelectorAll<HTMLElement>(".p4-a4")), title);
  } finally { host.remove(); }
}

/** The IET payment voucher, one A4 page. */
export async function printVoucher(v: Voucher, items: Array<{ request_no: string | null; title: string | null; amount: number | null; requester_name?: string | null }>, schedule: ScheduleLine[]) {
  const total = Number(v.total_amount ?? v.amount ?? 0);
  const [sp, sc, sa, scs] = await Promise.all([inline(signatureUrl(v.prepared_signature_url)), inline(signatureUrl(v.checked_signature_url)), inline(signatureUrl(v.authorized_signature_url)), inline(signatureUrl(v.cheque_counter_signed_signature_url))]);
  const lines = items.length ? items.map((i) => [`${i.request_no || ""}${i.title ? `: ${i.title}` : ""}${i.requester_name ? ` (${i.requester_name})` : ""}`, i.amount]) : [[v.narration || "Payment", total]];
  const mode = v.disbursement_mode || "Transfer";
  const fill = mode === "Cheque"
    ? [["Mode", "Cheque"], ["Cheque No.", v.cheque_no], ["Cheque date", date(v.cheque_date)], ["Bank", v.bank_name], ["Counter signed by", v.cheque_counter_signed_by_name]]
    : mode === "Cash" ? [["Mode", "Cash"], ["Payee name", v.cash_payee_name || v.payee_name], ["Payee signature / date", ""]]
      : schedule.length > 1 ? [["Mode", `Transfer, ${schedule.length} accounts`], ["Schedule", "As listed below"], ["Total", money(total)]]
        : [["Mode", "Transfer"], ["Account number", schedule[0]?.account_number || v.transfer_account_number], ["Bank", schedule[0]?.bank_name || v.transfer_bank_name], ["Account name", schedule[0]?.account_name || v.transfer_account_name]];
  const page = `
    ${header("Payment Voucher", [["PV No.", v.voucher_no || ""], ["Date", date(v.created_at)], ["Status", v.status || ""]])}
    <div class="p4-g2">
      <div class="p4-lf"><span>Payee:</span><b>${esc(Number(v.payee_count || 1) > 1 ? `${v.payee_count} payees (schedule below)` : String(v.payee_name || v.cash_payee_name || "").toUpperCase())}</b></div>
      <div class="p4-lf"><span>Request:</span><b>${esc(items.length > 1 ? `${items.length} requests` : v.request_no || (items[0]?.request_no ?? "Manual"))}</b></div>
      <div class="p4-lf"><span>Department:</span><b>${esc(v.dept_name)}</b></div>
      <div class="p4-lf"><span>Type:</span><b>${esc(v.voucher_type === "Manual" ? "Manual" : v.request_type || "Official")}</b></div>
      <div class="p4-lf" style="grid-column:1/-1"><span>Subhead:</span><b>${esc(items.length > 1 ? "Multiple, as listed below" : `${v.subhead_code || ""} ${v.subhead_name || ""}`.trim())}</b></div>
    </div>
    <div class="p4-box"><table class="p4-it"><thead><tr><th style="width:36px">No</th><th>Details / particulars</th><th class="p4-r" style="width:130px">Amount</th></tr></thead>
      <tbody>${lines.slice(0, 10).map((l, i) => `<tr><td>${i + 1}</td><td>${esc(l[0])}</td><td class="p4-r">${money(l[1])}</td></tr>`).join("")}</tbody>
      <tfoot><tr><td></td><td class="p4-r" style="text-transform:uppercase">Total</td><td class="p4-r">${money(total)}</td></tr></tfoot></table></div>
    <div class="p4-box"><div class="p4-bh">Amount in words</div><div class="p4-words">${esc(nairaInWords(total))}</div></div>
    <div class="p4-box"><div class="p4-bh">Disbursement details</div><div class="p4-fill">${fill.map(([k, val]) => `<div class="p4-fb"><small>${esc(k)}</small><b>${esc(val ?? "")}</b></div>`).join("")}</div>
      ${schedule.length > 1 ? `<table class="p4-it" style="border-top:2px solid #000"><thead><tr><th>Account name</th><th>Account No.</th><th>Bank</th><th class="p4-r">Amount</th></tr></thead><tbody>${schedule.map((l) => `<tr><td>${esc(l.account_name)}</td><td>${esc(l.account_number)}</td><td>${esc(l.bank_name)}</td><td class="p4-r">${money(l.amount)}</td></tr>`).join("")}</tbody></table>` : ""}</div>
    ${v.narration ? `<div class="p4-box"><div class="p4-bh">Narration</div><div class="p4-words">${esc(v.narration)}</div></div>` : ""}
    <div class="p4-box"><div class="p4-bh">Certification / approval / receipt</div><div class="p4-sigs">
      ${sig("Prepared by", v.prepared_by_name ? `${v.prepared_by_name}, Account Officer${v.prepared_section ? `, ${v.prepared_section}` : ""}` : "", sp, date(v.prepared_at))}
      ${sig("Checked by", v.checked_by_name || "", sc, date(v.checked_at))}
      ${sig("Counter signed by", v.cheque_counter_signed_by_name || v.counter_signatory_name || "", scs, date(v.cheque_counter_signed_at))}
      ${sig("Authorised by", v.authorized_by_name || "", sa, date(v.authorized_at), true)}
      ${sig("Received by", String(v.payee_name || "").toUpperCase(), null, date(v.paid_at || v.paid_on))}
      ${sig("Paid by", v.paid_by_name || "", null, v.paid_reference ? `Ref. ${v.paid_reference}` : "")}
    </div></div>
    <div class="p4-ft"><span>Official IET Payment Voucher, ${esc(v.voucher_no || "")}. Generated by IET ReqGen.</span><em>Building Bridges</em></div>`;
  await render([page], `${v.voucher_no || "Payment voucher"}`);
}

type Hist = { id: string; action_type: string | null; comment: string | null; to_stage: string | null; from_stage: string | null; created_at: string; actor_name: string | null; signature_url: string | null; actor_role_key: string | null; actor_role_name: string | null; actor_signature_url: string | null };
const norm = (s: unknown) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
const approve = (h: Hist) => { const a = norm(h.action_type); return !!a && !/reject|return|declin|cancel|withdraw|comment|attachment|submit|create|view|corrected/.test(a) && /approv|recommend|forward|endors|check|treat|confirm|verif|authori/.test(a); };
const roleIs = (h: Hist, keys: string[]) => keys.includes(norm(h.actor_role_key || h.actor_role_name).replace(/\d+$/, ""));
const stageIs = (s: string | null, keys: string[]) => keys.includes(norm(s));

/** The IET request letter (page 1) and its comments (page 2). */
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
  const personal = !official;
  const checked = latest((x) => approve(x) && roleIs(x, ["po", "pd", "dod", "director", "dinadmin", "registrar", "hod"]))
    || (personal ? latest((x) => approve(x) && (roleIs(x, ["hr", "hrofficer", "hrcoordinator"]) || stageIs(x.from_stage, ["hr"]))) : null)
    || latest((x) => approve(x) && (roleIs(x, ["account", "accounts", "accountofficer"]) || stageIs(x.from_stage, ["account"])));
  const dgH = latest((x) => approve(x) && (roleIs(x, ["dg"]) || stageIs(x.from_stage, ["dg"])));
  const sigOf = (x: Hist | null) => signatureUrl(x?.actor_signature_url || x?.signature_url || null);
  const [sReq, sChk, sDg] = await Promise.all([inline(signatureUrl(String(r.requester_signature_snapshot || r.requester_signature || r.signature_url || "") || null)), inline(sigOf(checked)), inline(sigOf(dgH) || signatureUrl(String(r.dg_signature_snapshot || "") || null))]);
  const amount = Number(r.amount || 0);
  const fund = official || norm(r.personal_category) === "fund";
  const bl = b.data as { allocation_bd?: number; expenditure?: number; balance_cd?: number } | null;
  const cap = (x: Hist | null, f: string) => (x?.actor_role_name || f);
  const line = (label: string, name: string, capacity: string, url: string | null, when: string, stamp = false) =>
    `<div class="p4-sl"><b>${esc(label)}</b><div class="p4-c">${esc(name)}</div><div class="p4-c">${esc(capacity)}</div><div class="p4-c">${url ? `<img class="p4-s" src="${url}" alt="">` : ""}${stamp && url ? `<img class="p4-st" src="${STAMP}" alt="">` : ""}</div><div class="p4-c" style="justify-content:center">${esc(when)}</div></div>`;
  const page1 = `
    ${header(official ? "Official Request" : "Personal Request", [["Req. No.", String(r.request_no || "")], ["Date", date(String(r.created_at || ""))]])}
    <div class="p4-lt-sub"><span>SUB-HEAD:</span><span>${esc(official ? `${r.subhead_code || ""}${r.subhead_name ? `, ${r.subhead_name}` : ""}` : String(r.personal_category || "Personal"))}</span></div>
    <div class="p4-lt-to">The Director General,<br>Islamic Education Trust,<br>Minna.</div>
    <div class="p4-lt-sal">Assalamu Alaikum Sir,</div>
    <div class="p4-lt-title">${esc(r.title)}</div>
    <p style="margin:0 0 8px">${fund && amount > 0 ? `I write to request for the release of the total sum of <b>${money(amount)} (${esc(nairaInWords(amount))})</b> for the expense below/attached:` : "I write to request consideration and approval for the matter stated below/attached:"}</p>
    <div class="p4-lt-body"><strong>${esc(r.title)}</strong>${esc(r.details)}</div>
    <div style="margin-top:8px;font-weight:700">Wassalamu Alaikum.</div>
    ${official ? `<div class="p4-bal"><div><span>ALLOCATION B/D:</span><span>${money(bl ? bl.allocation_bd : r.approved_allocation)}</span></div><div><span>EXPENDITURE:</span><span>${money(bl ? bl.expenditure : amount)}</span></div><div><span>BALANCE C/D:</span><span>${money(bl ? bl.balance_cd : r.balance)}</span></div></div>` : ""}
    ${line("Requested by:", String(r.requester_name || ""), "Requester", sReq, date(String(r.created_at || "")))}
    ${line("Checked by:", checked?.actor_name || "", checked ? cap(checked, "Reviewer") : "", sChk, checked ? date(checked.created_at) : "")}
    ${line("Approved by DG, IET:", dgH?.actor_name || String(r.dg_name || ""), cap(dgH, "Director General"), sDg, dgH ? date(dgH.created_at) : "", true)}
    <div class="p4-sl" style="margin-top:2px"><span></span><span class="p4-cap">Name</span><span class="p4-cap">Capacity</span><span class="p4-cap">Signature</span><span class="p4-cap">Date</span></div>
    <div class="p4-ft"><span>${esc(r.request_no)}. Generated by IET ReqGen.</span><em>Building Bridges</em></div>`;
  const said = hist.filter((x) => String(x.comment || "").trim() && !/attachment|print/i.test(String(x.action_type || "")));
  const page2 = `
    ${header("Comments and approvals", [["Req. No.", String(r.request_no || "")]])}
    <p style="margin:0">Every remark made on this request on its way, in order, as recorded in ReqGen.</p>
    <ol class="p4-trail">${said.map((x) => `<li><div class="p4-w"><span>${esc(x.actor_name || "Officer")}${x.actor_role_name ? `, ${esc(x.actor_role_name)}` : ""}</span><span>${esc(date(x.created_at))}</span></div><div class="p4-a">${esc(x.action_type || "Action")}</div><div class="p4-t">${esc(x.comment)}</div></li>`).join("") || "<li>No comments.</li>"}</ol>
    <div class="p4-ft"><span>${esc(r.request_no)}, page 2: comments</span><em>Building Bridges</em></div>`;
  await render([page1, page2], String(r.request_no || "Request"));
  void c.rpc("reqgen_log_print", { p_kind: "request", p_doc_id: id, p_doc_no: String(r.request_no || "") });
}
