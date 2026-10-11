import { createElement, type ReactNode } from "react";
import {
  Activity, AlertTriangle, Ban, Building2, CheckCircle2, Clock3, FileSignature, KeyRound, Layers, ListChecks,
  PenLine, PowerOff, ShieldAlert, ShieldCheck, Sigma, Users, UserCog, Wallet, XCircle,
} from "lucide-react";

/**
 * ReqGen standard stat card (v3.1.1 — Audit Centre style): tinted icon tile,
 * small uppercase label, value sized to the card, optional note, and a subtle
 * IET-palette accent that adapts to light/dark. When no icon is passed, one is
 * chosen from the card's meaning so every stat in ReqGen has a relevant icon.
 */
export type StatTone = "blue" | "emerald" | "amber" | "purple" | "slate" | "red" | "orange";

const RULES: Array<[RegExp, typeof Activity]> = [
  [/signature.*(missing|required)|missing.*signature/i, PenLine],
  [/signature|signer|sign/i, FileSignature],
  [/high.?priority|critical|risk/i, ShieldAlert],
  [/outstanding|pending|await|manual review/i, Clock3],
  [/2fa|mfa|security|control|passed/i, ShieldCheck],
  [/inactive|disabled|deactivat/i, PowerOff],
  [/rejected|failed|denied/i, XCircle],
  [/blocked|exception/i, Ban],
  [/active|ready|approved|complete/i, CheckCircle2],
  [/role|permission|assignment/i, KeyRound],
  [/custom/i, UserCog],
  [/system/i, Layers],
  [/user|people|staff|actor/i, Users],
  [/department/i, Building2],
  [/amount|budget|expend|balance|₦|naira|paid/i, Wallet],
  [/activit|event|log/i, Activity],
  [/check|item|record/i, ListChecks],
  [/warning|alert/i, AlertTriangle],
  [/total|count|all/i, Sigma],
];

export function iconForStat(title: string) {
  for (const [re, Icon] of RULES) if (re.test(title)) return Icon;
  return Sigma;
}

const TONE: Record<StatTone, string> = { blue: "blue", emerald: "green", amber: "amber", purple: "blue", slate: "blue", red: "red", orange: "brand" };

/** v4.0.0: the same stat card as the approved mock-ups (icon tile, label, value, note). */
export function StatTile({ title, value, tone = "blue", icon, note }: {
  title: string; value: ReactNode; tone?: StatTone; icon?: ReactNode; note?: ReactNode;
}) {
  const autoIcon = icon ?? createElement(iconForStat(title), { size: 20, strokeWidth: 1.8 });
  return (
    <article className="v4-ui v4-stat v4-bridge-stat">
      <span className={`v4-ico v4-t-${TONE[tone] || "blue"}`} aria-hidden="true">{autoIcon}</span>
      <span>
        <span className="v4-l">{title}</span>
        <span className="v4-v">{value}</span>
        {note ? <span className="v4-n">{note}</span> : null}
      </span>
    </article>
  );
}
