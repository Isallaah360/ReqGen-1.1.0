import { FileText, Send, Check, CornerUpLeft, Wallet, X } from "lucide-react";
import type { Req } from "../lib/data";
import { ago, naira, statusChip, withWho, stageKey, isClosed } from "../lib/text";
import { Cell, Chip, useNav } from "../ui";
import Detail from "./Detail";

const TONE_ICON = { ok: "ok", wa: "wa", er: "er", in: "in", mu: "mu", or: "in" } as const;

/** One request row, the same everywhere: number and where it is, with the status chip. */
export function ReqRow({ r, meId, sub }: { r: Req; meId: string; sub?: string }) {
  const { push } = useNav();
  const c = statusChip(r);
  const direct = !!r.direct_to || /sent directly|answered/i.test(String(r.status || ""));
  const icon = c.text === "Back with me" ? <CornerUpLeft size={18} /> : c.tone === "ok" ? (/paid/i.test(c.text) ? <Wallet size={18} /> : <Check size={18} />) : c.tone === "er" ? <X size={18} /> : direct ? <Send size={18} /> : <FileText size={18} />;
  const where = sub || [
    r.request_no || "",
    isClosed(r) ? "" : c.text === "Back with me" ? "back with you to correct" : direct ? "direct" : stageKey(r.current_stage) === "SUBMITTED" ? "" : `with ${withWho(r.current_stage)}`,
    ago(r.created_at),
  ].filter(Boolean).join(", ");
  return (
    <Cell icon={icon} iconTone={TONE_ICON[c.tone]} title={r.title || "Request"} sub={`${Number(r.amount) > 0 ? `${naira(r.amount)}, ` : ""}${where}`}
      right={<Chip tone={c.tone}>{c.text}</Chip>} onClick={() => push(<Detail id={r.id} meId={meId} />)} />
  );
}
