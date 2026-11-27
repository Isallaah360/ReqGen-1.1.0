/**
 * ReqGen 6.3.2 / app 4.2.2: the Direct message paper (owner's request, 26 Nov 2026).
 *
 * A Direct message is between the sender and the people it went to, so it does not use the request letter:
 *   - From: the sender, with their signature.
 *   - To: only the people it was sent to (a receiver who prints it sees only themselves).
 *   - Each answer (approved, replied, declined, forwarded) is added only when that person acts, with their
 *     name, words, signature and date. A receiver sees only their own answer, never another receiver's.
 *   - When it is forwarded to the Director General to be paid, the DG's approval (with the IET stamp) and the
 *     Account's step are added, because they are part of paying it.
 *   - Always ONE A4 page: the text is made smaller to fit (never below 72%), and a very long message is cut with
 *     a note to scan the code for the rest.
 *
 * This file is shared word for word by the website (lib/directLetter.ts) and the app
 * (mobile/app/src/lib/directLetter.ts). It has no imports, so both can use it as it is.
 */

export type DirectHist = {
  id: string; action_type: string | null; comment: string | null; to_stage: string | null; from_stage: string | null;
  created_at: string; actor_name: string | null; actor_role_key: string | null; actor_role_name: string | null;
  signature_url: string | null; actor_signature_url: string | null; action_by?: string | null;
};
export type DirectPerson = { user_id: string; full_name: string | null; position_names: string | null; added_by_name: string | null };
export type DirectAnswer = { label: string; name: string; position: string; words: string; sig: string | null; when: string; stamp: boolean };
export type DirectLetter = {
  no: string; title: string; message: string; amount: number; date: string;
  from: { name: string; sig: string | null; when: string };
  to: Array<{ name: string; position: string }>;
  answers: DirectAnswer[];
  qr: string | null; logo: string; stamp: string;
};

const URL_RE = /\bhttps?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)\]]/gi;
const escHtml = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
const norm = (s: unknown) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");

/** Split text into plain parts and web links (http and https only). */
export function linkParts(text: string): Array<{ text: string; href?: string }> {
  const out: Array<{ text: string; href?: string }> = [];
  let last = 0;
  for (const m of String(text || "").matchAll(URL_RE)) {
    const i = m.index ?? 0;
    if (i > last) out.push({ text: text.slice(last, i) });
    out.push({ text: m[0], href: m[0] });
    last = i + m[0].length;
  }
  if (last < String(text || "").length) out.push({ text: String(text).slice(last) });
  return out;
}

/** Escaped HTML with the web links made into links (they open in a new tab or the phone's browser). */
export function linkifyHtml(text: string) {
  return linkParts(text).map((p) => (p.href ? `<a href="${escHtml(p.href)}" target="_blank" rel="noopener noreferrer">${escHtml(p.text)}</a>` : escHtml(p.text))).join("");
}

const isDg = (h: DirectHist) => norm(h.actor_role_key).startsWith("dg") || norm(h.from_stage) === "dg";
const isAccount = (h: DirectHist) => /^account/.test(norm(h.actor_role_key)) || norm(h.from_stage) === "account";
const isAct = (h: DirectHist) => /approv|paid|pay|treat|process|disburs|complete|confirm/.test(norm(h.action_type)) && !/reject|return|declin|cancel/.test(norm(h.action_type));
const isReceiver = (h: DirectHist) => norm(h.actor_role_name) === "receiver";

/**
 * What the paper shows, worked out from the request's history and its people.
 * viewerId: who is printing. The sender sees every answer; a receiver sees only their own,
 * plus the steps that pay it (forwarded to the DG, the DG, Account).
 */
export function directAnswers(hist: DirectHist[], viewerId: string, senderId: string, ukDate: (iso: string) => string, sigOf: (h: DirectHist) => string | null) {
  const asc = [...hist].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const sender = viewerId === senderId;
  const answers: Array<DirectAnswer & { h: DirectHist }> = [];
  for (const h of asc) {
    const toDg = isReceiver(h) && norm(h.to_stage) === "dg";
    if (isReceiver(h)) {
      if (!sender && !toDg && h.action_by && h.action_by !== viewerId) continue;
      const a = norm(h.action_type);
      const label = toDg ? "Forwarded to the Director General" : a.startsWith("approv") ? "Approved" : a.startsWith("repl") ? "Replied" : a.startsWith("declin") ? "Declined" : a.startsWith("forward") ? "Forwarded" : (h.action_type || "Answered");
      answers.push({ h, label, name: h.actor_name || "Staff", position: "", words: h.comment || "", sig: sigOf(h), when: ukDate(h.created_at), stamp: false });
    }
  }
  const lastOf = (f: (h: DirectHist) => boolean) => [...asc].reverse().find(f) || null;
  const dg = lastOf((h) => !isReceiver(h) && isDg(h) && isAct(h));
  if (dg) answers.push({ h: dg, label: "Approved by the Director General", name: dg.actor_name || "Director General", position: dg.actor_role_name || "Director General", words: dg.comment || "", sig: sigOf(dg), when: ukDate(dg.created_at), stamp: true });
  const acct = lastOf((h) => !isReceiver(h) && isAccount(h) && isAct(h));
  if (acct) answers.push({ h: acct, label: /paid|pay|disburs/.test(norm(acct.action_type)) ? "Paid by Account" : "Treated by Account", name: acct.actor_name || "Account", position: acct.actor_role_name || "Account", words: acct.comment || "", sig: sigOf(acct), when: ukDate(acct.created_at), stamp: false });
  return answers;
}

/** The people it was sent to. The sender sees all of them; a receiver sees only themselves. */
export function directTo(people: DirectPerson[], viewerId: string, senderId: string, senderName: string) {
  const first = people.filter((p) => !p.added_by_name || norm(p.added_by_name) === norm(senderName));
  const list = viewerId === senderId ? (first.length ? first : people) : people.filter((p) => p.user_id === viewerId);
  return list.map((p) => ({ name: p.full_name || "Staff", position: (p.position_names || "").replace(/\s*,\s*/g, ", ") }));
}

export const DIRECT_CSS = `
.dl-sheet{box-sizing:border-box;width:794px;height:1123px;padding:42px 53px 34px;overflow:hidden;position:relative;background:#fff;color:#000;font-family:Aptos,"Segoe UI",Arial,sans-serif;display:flex}
.dl-sheet *{box-sizing:border-box;color:#000}
.dl-sheet::before{content:"";position:absolute;left:0;right:0;top:0;height:5px;background:linear-gradient(90deg,#f06c24,#e43c24 40%,#f09c18 75%,#30a8d8)}
.dl-sheet::after{content:"";position:absolute;left:0;right:0;bottom:0;height:3px;opacity:.85;background:linear-gradient(90deg,#f06c24,#e43c24 40%,#f09c18 75%,#30a8d8)}
.dl-in{display:flex;flex-direction:column;width:100%;align-self:flex-start;font-size:13px;line-height:1.45}
.dl-head{display:flex;align-items:center;gap:14px;border-bottom:2px solid #000;padding-bottom:10px}
.dl-head img{height:64px;width:auto}
.dl-org{font-size:19px;font-weight:900;text-transform:uppercase;line-height:1.1}
.dl-addr{font-size:10.5px;font-weight:600;line-height:1.3}
.dl-kind{margin-left:auto;text-align:right}
.dl-kind b{display:block;font-size:17px;font-weight:900;letter-spacing:.04em}
.dl-kind span{display:block;font-size:11px;font-weight:600}
.dl-meta{display:grid;grid-template-columns:70px 1fr;gap:4px 10px;margin-top:12px;font-size:12.5px}
.dl-meta dt{font-weight:800}
.dl-meta dd{margin:0}
.dl-subj{margin:12px 0 4px;font-size:15px;font-weight:900}
.dl-amt{font-size:12.5px;font-weight:700;margin-bottom:4px}
.dl-msg{flex:1 1 auto;min-height:60px;white-space:pre-wrap;overflow-wrap:anywhere;overflow:hidden;position:relative;border-top:1px solid #9ca3af;padding-top:8px}
.dl-msg a{color:#0E4A66;text-decoration:underline;overflow-wrap:anywhere}
.dl-cut{display:none;font-size:11px;font-style:italic;margin-top:4px}
.dl-cut.on{display:block}
.dl-sign{margin-top:10px}
.dl-row{display:grid;grid-template-columns:1.25fr 1.35fr 1fr .62fr;align-items:end;gap:8px;border-bottom:1px solid #000;padding:4px 0 2px;min-height:48px}
.dl-row .who b{display:block;font-size:12px}
.dl-row .who small{display:block;font-size:10.5px;font-weight:600}
.dl-row .words{font-size:11.5px;white-space:pre-wrap;word-break:break-word;max-height:4.4em;overflow:hidden}
.dl-row .words a{color:#0E4A66;text-decoration:underline;overflow-wrap:anywhere}
.dl-row .slot{position:relative;height:46px}
.dl-row .slot img.s{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;object-position:left bottom;mix-blend-mode:multiply}
.dl-row .slot img.st{position:absolute;right:-10px;top:50%;transform:translateY(-50%) rotate(-8deg);height:52px;width:auto;opacity:.85;mix-blend-mode:multiply}
.dl-row .when{font-size:11px;font-weight:700;text-align:right}
.dl-cap{display:grid;grid-template-columns:1.25fr 1.35fr 1fr .62fr;gap:8px;font-size:9.5px;font-weight:700;color:#4b5563;padding-top:1px}
.dl-cap div:last-child{text-align:right}
.dl-h{margin:12px 0 2px;font-size:12px;font-weight:900;text-transform:uppercase;letter-spacing:.05em}
.dl-none{font-size:11.5px;font-style:italic;padding:6px 0}
.dl-foot{margin-top:12px;display:flex;justify-content:space-between;align-items:flex-end;font-size:10px}
.dl-foot *{color:#4b5563}
.dl-foot img{width:56px;height:56px}
.dl-foot em{font-weight:600}
`;

function row(label: string, name: string, position: string, words: string, sig: string | null, when: string, stamp: boolean, stampSrc: string) {
  return `<div class="dl-row"><div class="who"><small>${escHtml(label)}</small><b>${escHtml(name)}</b>${position ? `<small>${escHtml(position)}</small>` : ""}</div><div class="words">${linkifyHtml(words)}</div><div class="slot">${sig ? `<img class="s" src="${escHtml(sig)}" alt="">` : ""}${stamp && sig ? `<img class="st" src="${escHtml(stampSrc)}" alt="">` : ""}</div><div class="when">${escHtml(when)}</div></div>`;
}

/** The inside of the sheet (.dl-in). The caller puts it in an element with the class "dl-sheet". */
export function directLetterHtml(d: DirectLetter) {
  const naira = `₦${Number(d.amount || 0).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const cap = `<div class="dl-cap"><div>Name</div><div>Words</div><div>Signature</div><div>Date</div></div>`;
  return `<div class="dl-in">
  <header class="dl-head"><img src="${escHtml(d.logo)}" alt=""><div><div class="dl-org">Islamic Education Trust</div><div class="dl-addr">IW2, Ilmi Avenue Intermediate Housing Estate</div><div class="dl-addr">PMB 229, Minna, Niger State - Nigeria</div></div><div class="dl-kind"><b>DIRECT MESSAGE</b><span>${escHtml(d.no)}</span><span>${escHtml(d.date)}</span></div></header>
  <dl class="dl-meta"><dt>From:</dt><dd>${escHtml(d.from.name)}</dd><dt>To:</dt><dd>${d.to.map((t) => `${escHtml(t.name)}${t.position ? ` (${escHtml(t.position)})` : ""}`).join("; ") || "&nbsp;"}</dd></dl>
  <div class="dl-subj">${escHtml(d.title)}</div>
  ${d.amount > 0 ? `<div class="dl-amt">Amount: ${naira}</div>` : ""}
  <div class="dl-msg">${linkifyHtml(d.message)}</div>
  <div class="dl-cut">The message is longer than one page. Scan the code to read all of it in ReqGen.</div>
  <div class="dl-sign">${row("Sent by", d.from.name, "", "", d.from.sig, d.from.when, false, d.stamp)}${cap}</div>
  <div class="dl-h">Answers</div>
  ${d.answers.length ? d.answers.map((a) => row(a.label, a.name, a.position, a.words, a.sig, a.when, a.stamp, d.stamp)).join("") + cap : `<div class="dl-none">No answer yet.</div>`}
  <footer class="dl-foot"><span style="display:inline-flex;align-items:center;gap:8px">${d.qr ? `<img src="${escHtml(d.qr)}" alt="">` : ""}<span style="display:flex;flex-direction:column;line-height:1.2"><span>${escHtml(d.no)}</span><small style="font-size:9px">Scan to check this message</small></span></span><em>Building Bridges</em></footer>
</div>`;
}

/**
 * Keep the paper on ONE page: make it smaller (down to 72%) until it fits, then, if the message is still too
 * long, cut the message and show the note. The sheet keeps its A4 size.
 */
export function fitDirect(sheet: HTMLElement) {
  const inner = sheet.querySelector<HTMLElement>(".dl-in");
  const msg = sheet.querySelector<HTMLElement>(".dl-msg");
  const cut = sheet.querySelector<HTMLElement>(".dl-cut");
  if (!inner || !msg) return 1;
  const cs = getComputedStyle(sheet);
  const avail = sheet.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
  // measured on screen, so a smaller picture of the sheet (a phone) does not change the answer
  const ratio = () => { const sh = sheet.getBoundingClientRect().height; return sh > 0 ? inner.getBoundingClientRect().height / (sh * (avail / sheet.clientHeight)) : 1; };
  msg.style.flex = "0 0 auto"; msg.style.maxHeight = ""; cut?.classList.remove("on");
  inner.style.minHeight = "0px"; inner.style.zoom = "1";
  let z = 1;
  while (z > 0.72 && ratio() > 1) { z = Math.round((z - 0.02) * 100) / 100; inner.style.zoom = String(z); }
  if (ratio() > 1) {
    cut?.classList.add("on");
    const r = msg.getBoundingClientRect().height;
    const over = ratio() - 1;
    const sh = sheet.getBoundingClientRect().height * (avail / sheet.clientHeight);
    const keep = Math.max(60, (r - over * sh) / (r / msg.offsetHeight || 1) / 1 - 8);
    const lh = parseFloat(getComputedStyle(msg).lineHeight) || 19;
    const pad = parseFloat(getComputedStyle(msg).paddingTop) || 0;
    msg.style.maxHeight = `${pad + Math.max(3, Math.floor((keep - pad) / lh)) * lh}px`;
  }
  msg.style.flex = "";
  inner.style.minHeight = `${Math.floor(avail / z)}px`;
  return z;
}
