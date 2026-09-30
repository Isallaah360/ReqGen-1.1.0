"use client";

import type { ReactNode } from "react";
import {
  Eye,
  Pencil,
  Trash2,
  Power,
  PowerOff,
  Download,
  Printer,
  RotateCcw,
  KeyRound,
  UserCog,
} from "lucide-react";

/**
 * ReqGen v3.0.2 standard row action: one icon button, same size everywhere,
 * with a tooltip and an accessible label. Use inside <IconActions>.
 *   view → eye · edit → pen · delete/remove → bin · activate/deactivate → power
 */
export type IconActionKind =
  | "view"
  | "edit"
  | "delete"
  | "activate"
  | "deactivate"
  | "download"
  | "print"
  | "reset"
  | "password"
  | "roles";

const ICONS: Record<IconActionKind, (size: number) => ReactNode> = {
  view: (s) => <Eye size={s} />,
  edit: (s) => <Pencil size={s} />,
  delete: (s) => <Trash2 size={s} />,
  activate: (s) => <Power size={s} />,
  deactivate: (s) => <PowerOff size={s} />,
  download: (s) => <Download size={s} />,
  print: (s) => <Printer size={s} />,
  reset: (s) => <RotateCcw size={s} />,
  password: (s) => <KeyRound size={s} />,
  roles: (s) => <UserCog size={s} />,
};

const TONES: Record<IconActionKind, string> = {
  view: "is-neutral",
  edit: "is-primary",
  delete: "is-danger",
  activate: "is-success",
  deactivate: "is-warning",
  download: "is-neutral",
  print: "is-neutral",
  reset: "is-warning",
  password: "is-neutral",
  roles: "is-primary",
};

export function IconAction({
  kind,
  label,
  onClick,
  disabled = false,
}: {
  kind: IconActionKind;
  /** Plain-language action, shown as the tooltip and read by screen readers. */
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className={`rg-icon-action ${TONES[kind]}`}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      data-tooltip={label}
    >
      {ICONS[kind](16)}
    </button>
  );
}

export function IconActions({ children }: { children: ReactNode }) {
  return <div className="rg-icon-actions">{children}</div>;
}
