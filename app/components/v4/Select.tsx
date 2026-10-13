"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Icon from "./Icon";

/**
 * ReqGen v4.1.2 — the one dropdown.
 *
 * A button that opens a styled list (never the browser's grey list). Works
 * with the mouse, touch and keyboard (arrows, Home/End, Enter, Escape, Tab and
 * type-to-find), and shows a search box when the list is long. The list is
 * drawn in a layer above the page so a card or table can never clip it.
 */

export type SelectOption = {
  value: string;
  label: string;
  /** Small grey text under or beside the label (e.g. the bank of an account). */
  hint?: string;
  /** Options with the same group are listed under one heading. */
  group?: string;
  disabled?: boolean;
  icon?: string;
};

type Props = {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  name?: string;
  /** Accessible name when no visible <label htmlFor> points at this control. */
  ariaLabel?: string;
  /** Shows a search box; on by default when there are more than 8 options. */
  searchable?: boolean;
  /** "field" is the full-height form control; "compact" suits toolbars and filters. */
  size?: "field" | "compact";
  className?: string;
  invalid?: boolean;
  /** Text under the list when the search finds nothing. */
  emptyText?: string;
  /** Custom rendering of the closed button's content. */
  renderValue?: (option: SelectOption | null) => ReactNode;
  /** Minimum width of the open list in pixels (defaults to the button width). */
  menuMinWidth?: number;
  align?: "start" | "end";
};

type Placement = { top: number; left: number; width: number; maxHeight: number; up: boolean };

export function placeMenu(anchor: DOMRect, minWidth: number, align: "start" | "end" = "start"): Placement {
  const gap = 6;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const width = Math.min(Math.max(anchor.width, minWidth), vw - 16);
  let left = align === "end" ? anchor.right - width : anchor.left;
  left = Math.max(8, Math.min(left, vw - width - 8));
  const below = vh - anchor.bottom - gap - 8;
  const above = anchor.top - gap - 8;
  const up = below < 220 && above > below;
  const maxHeight = Math.max(160, Math.min(360, up ? above : below));
  const top = up ? anchor.top - gap : anchor.bottom + gap;
  return { top, left, width, maxHeight, up };
}

export function Select({
  value,
  onChange,
  options,
  placeholder = "Choose…",
  disabled,
  id,
  name,
  ariaLabel,
  searchable,
  size = "field",
  className,
  invalid,
  emptyText = "Nothing matches your search.",
  renderValue,
  menuMinWidth = 220,
  align = "start",
}: Props) {
  const autoId = useId();
  const baseId = id || `v4sel-${autoId.replace(/[^a-zA-Z0-9]/g, "")}`;
  const listId = `${baseId}-list`;
  const btnRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const typed = useRef<{ text: string; at: number }>({ text: "", at: 0 });
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(-1);
  const [place, setPlace] = useState<Placement | null>(null);
  const [mounted, setMounted] = useState(false);
  // where the list is drawn: inside a dialog it must sit in the dialog's layer, above the dialog
  const [host, setHost] = useState<HTMLElement | null>(null);

  useEffect(() => { queueMicrotask(() => setMounted(true)); }, []);

  const selected = useMemo(() => options.find((o) => o.value === value) || null, [options, value]);
  const showSearch = searchable ?? options.length > 8;

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => `${o.label} ${o.hint || ""} ${o.group || ""}`.toLowerCase().includes(q));
  }, [options, query]);

  const reposition = useCallback(() => {
    const el = btnRef.current;
    if (!el) return;
    setPlace(placeMenu(el.getBoundingClientRect(), menuMinWidth, align));
  }, [menuMinWidth, align]);

  const close = useCallback((focusButton = true) => {
    setOpen(false);
    setQuery("");
    if (focusButton) btnRef.current?.focus();
  }, []);

  function openMenu() {
    if (disabled) return;
    reposition();
    setHost(btnRef.current?.closest<HTMLElement>(".v4-modal-layer") || document.body.querySelector<HTMLElement>(".v4-ui") || document.body);
    const idx = Math.max(0, options.findIndex((o) => o.value === value));
    setActive(idx);
    setOpen(true);
  }

  function choose(option: SelectOption | undefined) {
    if (!option || option.disabled) return;
    if (option.value !== value) onChange(option.value);
    close();
  }

  // Keep the list attached to the button while the page scrolls or resizes.
  useLayoutEffect(() => {
    if (!open) return;
    const onMove = (e: Event) => {
      if (listRef.current && e.target instanceof Node && listRef.current.contains(e.target)) return;
      reposition();
    };
    window.addEventListener("resize", onMove);
    window.addEventListener("scroll", onMove, true);
    return () => {
      window.removeEventListener("resize", onMove);
      window.removeEventListener("scroll", onMove, true);
    };
  }, [open, reposition]);

  // Close when clicking anywhere else.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || listRef.current?.contains(t)) return;
      close(false);
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [open, close]);

  // Focus the search box (or the list) when it opens; keep the active row in view.
  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => (showSearch ? searchRef.current : listRef.current)?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [open, showSearch]);

  useEffect(() => {
    if (!open || active < 0) return;
    const row = listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`);
    row?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  function step(from: number, dir: 1 | -1) {
    if (!visible.length) return -1;
    let i = from;
    for (let n = 0; n < visible.length; n += 1) {
      i = (i + dir + visible.length) % visible.length;
      if (!visible[i].disabled) return i;
    }
    return from;
  }

  function onListKey(e: ReactKeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => step(a, 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => step(a < 0 ? 0 : a, -1)); }
    else if (e.key === "Home") { e.preventDefault(); setActive(step(-1, 1)); }
    else if (e.key === "End") { e.preventDefault(); setActive(step(0, -1)); }
    else if (e.key === "Enter") { e.preventDefault(); choose(visible[active]); }
    else if (e.key === "Escape") { e.preventDefault(); close(); }
    else if (e.key === "Tab") { close(false); }
    else if (!showSearch && e.key.length === 1 && /\S/.test(e.key)) {
      const now = e.timeStamp;
      typed.current = { text: (now - typed.current.at < 700 ? typed.current.text : "") + e.key.toLowerCase(), at: now };
      const hit = visible.findIndex((o) => !o.disabled && o.label.toLowerCase().startsWith(typed.current.text));
      if (hit >= 0) setActive(hit);
    }
  }

  function onButtonKey(e: ReactKeyboardEvent) {
    if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
      e.preventDefault();
      openMenu();
    }
  }

  const menu = open && place && mounted
    ? createPortal(
        <div
          className={`v4-sel-pop${place.up ? " is-up" : ""}`}
          style={{ left: place.left, width: place.width, ...(place.up ? { bottom: window.innerHeight - place.top } : { top: place.top }) }}
          onKeyDown={onListKey}
        >
          {showSearch ? (
            <div className="v4-sel-search">
              <Icon name="search" size="sm" />
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => { setQuery(e.target.value); setActive(0); }}
                placeholder="Type to search…"
                aria-label="Search the list"
                aria-controls={listId}
                aria-activedescendant={active >= 0 ? `${baseId}-opt-${active}` : undefined}
              />
            </div>
          ) : null}
          <div
            ref={listRef}
            id={listId}
            role="listbox"
            tabIndex={-1}
            aria-label={ariaLabel || placeholder}
            aria-activedescendant={active >= 0 ? `${baseId}-opt-${active}` : undefined}
            className="v4-sel-list"
            style={{ maxHeight: place.maxHeight - (showSearch ? 52 : 0) }}
          >
            {visible.length === 0 ? <p className="v4-sel-empty">{emptyText}</p> : null}
            {visible.map((o, i) => {
              const head = o.group && (i === 0 || visible[i - 1].group !== o.group) ? o.group : null;
              const isSel = o.value === value;
              return (
                <div key={`${o.value}-${i}`} role="presentation">
                  {head ? <div className="v4-sel-group" role="presentation">{head}</div> : null}
                  <div
                    id={`${baseId}-opt-${i}`}
                    data-index={i}
                    role="option"
                    aria-selected={isSel}
                    aria-disabled={o.disabled || undefined}
                    className={`v4-sel-opt${i === active ? " is-active" : ""}${isSel ? " is-selected" : ""}`}
                    onPointerMove={() => { if (!o.disabled && active !== i) setActive(i); }}
                    onClick={() => choose(o)}
                  >
                    {o.icon ? <Icon name={o.icon} /> : null}
                    <span className="v4-sel-text">
                      <span>{o.label}</span>
                      {o.hint ? <small>{o.hint}</small> : null}
                    </span>
                    {isSel ? <Icon name="tick" size="sm" className="v4-sel-tick" /> : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>,
        host || document.body,
      )
    : null;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        id={baseId}
        name={name}
        value={value}
        className={`v4-sel v4-sel-${size}${invalid ? " is-invalid" : ""}${open ? " is-open" : ""}${className ? ` ${className}` : ""}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => (open ? close() : openMenu())}
        onKeyDown={onButtonKey}
      >
        <span className={`v4-sel-value${selected ? "" : " is-placeholder"}`}>
          {renderValue ? renderValue(selected) : selected ? (
            <>
              {selected.icon ? <Icon name={selected.icon} /> : null}
              <span>{selected.label}</span>
              {selected.hint && size === "field" ? <small>{selected.hint}</small> : null}
            </>
          ) : placeholder}
        </span>
        <Icon name="chevron" className="v4-sel-caret" />
      </button>
      {menu}
    </>
  );
}

export default Select;
