"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getActiveRole, getAvailableRoles, switchActiveRole, type AvailableRole } from "@/lib/activeRole";
import { normalizeRole, roleDisplayName } from "@/lib/roles";
import { alertDialog } from "@/lib/dialog";
import Icon from "./Icon";
import { placeMenu } from "./Select";

/** Position label for the "Acting as" box (system accounts get their own name). */
export function positionName(key: string, raw: string, systemAccount?: string | null) {
  const k = normalizeRole(key);
  if (k === "admin" && systemAccount === "developer") return "Developer";
  return roleDisplayName(k || raw);
}

/** A small picture for each position, so the list reads at a glance. */
export function positionIcon(key: string) {
  const k = normalizeRole(key);
  if (k === "admin" || k === "developer") return "admin";
  if (k === "dg" || k === "generalsecretary" || k === "padg") return "landmark";
  if (k === "registry") return "archive";
  if (k === "auditor") return "audit";
  if (k.startsWith("account")) return "wallet";
  if (k.startsWith("hr")) return "users";
  if (k === "pvsigner" || k === "pvcountersigner") return "pen";
  if (k === "staff") return "user";
  return "shield";
}

/**
 * Top-bar "ACTING AS" switcher. Lists only the positions this person holds;
 * the chosen position decides what the menu shows and is written on every action.
 */
export default function RoleSelect({ systemAccount }: { systemAccount?: string | null }) {
  const router = useRouter();
  const [roles, setRoles] = useState<AvailableRole[]>([]);
  const [current, setCurrent] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [place, setPlace] = useState<ReturnType<typeof placeMenu> | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;
    const [available, activeRole] = await Promise.all([getAvailableRoles(data.user.id), getActiveRole(data.user.id)]);
    // One entry per position (old and new keys collapse into one).
    const seen = new Set<string>();
    const unique = available.filter((r) => { const k = normalizeRole(r.key); if (seen.has(k)) return false; seen.add(k); return true; });
    setRoles(unique);
    setCurrent(normalizeRole(activeRole?.active_role_key || unique[0]?.key || "staff"));
    setLoading(false);
  }, []);

  useEffect(() => {
    queueMicrotask(() => { void load(); });
    const handler = () => void load();
    window.addEventListener("reqgen-active-role-changed", handler);
    return () => window.removeEventListener("reqgen-active-role-changed", handler);
  }, [load]);

  const close = useCallback((refocus = true) => {
    setOpen(false);
    if (refocus) btnRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    const follow = () => { if (btnRef.current) setPlace(placeMenu(btnRef.current.getBoundingClientRect(), 280, "end")); };
    const outside = (e: PointerEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || popRef.current?.contains(t)) return;
      close(false);
    };
    window.addEventListener("resize", follow);
    window.addEventListener("scroll", follow, true);
    document.addEventListener("pointerdown", outside, true);
    const t = window.setTimeout(() => listRef.current?.focus(), 0);
    return () => {
      window.removeEventListener("resize", follow);
      window.removeEventListener("scroll", follow, true);
      document.removeEventListener("pointerdown", outside, true);
      window.clearTimeout(t);
    };
  }, [open, close]);

  async function change(next: string) {
    close();
    if (!next || next === current) return;
    const target = roles.find((r) => normalizeRole(r.key) === next);
    setSaving(true);
    try {
      const result = await switchActiveRole(target?.key || next);
      setCurrent(normalizeRole(result.active_role_key));
      window.dispatchEvent(new CustomEvent("reqgen-active-role-changed", { detail: { roleKey: result.active_role_key, roleName: result.active_role_name } }));
      router.refresh();
    } catch (error) {
      await alertDialog({ title: "Could not change position", message: error instanceof Error ? error.message : "Please try again." });
    } finally {
      setSaving(false);
    }
  }

  function toggle() {
    if (roles.length < 2 || saving) return;
    if (open) { close(); return; }
    if (btnRef.current) setPlace(placeMenu(btnRef.current.getBoundingClientRect(), 280, "end"));
    setActive(Math.max(0, roles.findIndex((r) => normalizeRole(r.key) === current)));
    setOpen(true);
  }

  function onKey(e: ReactKeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => (a + 1) % roles.length); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => (a - 1 + roles.length) % roles.length); }
    else if (e.key === "Home") { e.preventDefault(); setActive(0); }
    else if (e.key === "End") { e.preventDefault(); setActive(roles.length - 1); }
    else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); void change(normalizeRole(roles[active]?.key)); }
    else if (e.key === "Escape") { e.preventDefault(); close(); }
    else if (e.key === "Tab") { close(false); }
  }

  if (loading) return <div className="v4-acting" aria-hidden="true"><div className="v4-acting-btn"><span className="v4-acting-txt"><small>ACTING AS</small><strong className="v4-muted">…</strong></span></div></div>;

  const currentName = positionName(current, roles.find((r) => normalizeRole(r.key) === current)?.name || current, systemAccount);
  const single = roles.length < 2;

  return (
    <div className="v4-acting">
      <button
        ref={btnRef}
        type="button"
        className="v4-acting-btn"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Acting as ${currentName}${single ? "" : ". Change position"}`}
        title={single ? "This is the only position you hold." : "Change the position you are acting as"}
        disabled={saving || single}
        onClick={toggle}
        onKeyDown={(e) => { if (["ArrowDown", "Enter", " "].includes(e.key) && !open) { e.preventDefault(); toggle(); } }}
      >
        <span className="v4-acting-ico"><Icon name={positionIcon(current)} /></span>
        <span className="v4-acting-txt">
          <small>ACTING AS</small>
          <strong>{saving ? "Switching…" : currentName}</strong>
        </span>
        {single ? null : <Icon name="chevron" className="v4-sel-caret" />}
      </button>
      {open && place
        ? createPortal(
            <div
              ref={popRef}
              className={`v4-sel-pop v4-acting-pop${place.up ? " is-up" : ""}`}
              style={{ left: place.left, width: place.width, top: place.top }}
              onKeyDown={onKey}
            >
              <div className="v4-acting-head">
                <strong>Act as</strong>
                <p>Your choice is written on everything you sign or send.</p>
              </div>
              <div ref={listRef} role="listbox" tabIndex={-1} aria-label="Positions you hold" className="v4-sel-list"
                aria-activedescendant={`v4-acting-opt-${active}`} style={{ maxHeight: place.maxHeight - 110 }}>
                {roles.map((r, i) => {
                  const k = normalizeRole(r.key);
                  const isSel = k === current;
                  return (
                    <div key={k} id={`v4-acting-opt-${i}`} role="option" aria-selected={isSel}
                      className={`v4-sel-opt${i === active ? " is-active" : ""}${isSel ? " is-selected" : ""}`}
                      onPointerMove={() => setActive(i)} onClick={() => void change(k)}>
                      <span className="v4-acting-dot"><Icon name={positionIcon(k)} size="sm" /></span>
                      <span className="v4-sel-text">
                        <span>{positionName(k, r.name, systemAccount)}</span>
                        <small>{isSel ? "Acting now" : "Switch to this position"}</small>
                      </span>
                      {isSel ? <Icon name="tick" size="sm" className="v4-sel-tick" /> : null}
                    </div>
                  );
                })}
              </div>
              <div className="v4-acting-foot">Positions are given by the Super Admin. <Link href="/profile/access" onClick={() => close(false)}>My Access</Link></div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
