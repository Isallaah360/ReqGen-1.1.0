"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Icon from "./Icon";
import { placeMenu } from "./Select";

/**
 * ReqGen v4.1.2 — every plain dropdown in ReqGen opens the v4 list.
 *
 * Older pages still use the browser's <select>. On a laptop or desktop, a
 * click (or Enter / Space / Alt+Down) on any of them opens the same styled list
 * as the v4 <Select> instead of the browser's grey list. The <select> stays in
 * the page and keeps its value, so every existing form keeps working; the new
 * choice is written back with a normal "change" event. Phones keep their own
 * picker, which is easier to use with a thumb. Add data-native to a <select>
 * to opt out.
 */

type Opt = { value: string; label: string; group?: string; disabled: boolean };

const SKIP = "select[multiple], select[size]:not([size='0']):not([size='1']), select[data-native], [data-native-selects] select";

function eligible(el: EventTarget | null): el is HTMLSelectElement {
  if (!(el instanceof HTMLSelectElement)) return false;
  if (el.disabled || el.matches(SKIP)) return false;
  if (!el.closest(".v4-root")) return false;
  return window.matchMedia("(pointer: fine)").matches;
}

function readOptions(sel: HTMLSelectElement): Opt[] {
  return Array.from(sel.options).map((o) => ({
    value: o.value,
    label: (o.label || o.text || "").trim() || "—",
    group: o.parentElement instanceof HTMLOptGroupElement ? o.parentElement.label : undefined,
    disabled: o.disabled || (o.parentElement instanceof HTMLOptGroupElement && o.parentElement.disabled),
  }));
}

function writeValue(sel: HTMLSelectElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
  if (setter) setter.call(sel, value); else sel.value = value;
  sel.dispatchEvent(new Event("input", { bubbles: true }));
  sel.dispatchEvent(new Event("change", { bubbles: true }));
}

export default function NativeSelectUpgrade() {
  const [target, setTarget] = useState<HTMLSelectElement | null>(null);
  const [opts, setOpts] = useState<Opt[]>([]);
  const [active, setActive] = useState(-1);
  const [query, setQuery] = useState("");
  const [place, setPlace] = useState<ReturnType<typeof placeMenu> | null>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const typed = useRef({ text: "", at: 0 });
  const targetRef = useRef<HTMLSelectElement | null>(null);
  useEffect(() => { targetRef.current = target; }, [target]);

  const close = useCallback((refocus = true) => {
    const t = targetRef.current;
    targetRef.current = null;
    setTarget(null);
    setQuery("");
    if (refocus) t?.focus();
  }, []);

  const open = useCallback((sel: HTMLSelectElement) => {
    const list = readOptions(sel);
    setOpts(list);
    setActive(Math.max(0, sel.selectedIndex));
    setQuery("");
    setPlace(placeMenu(sel.getBoundingClientRect(), 200));
    targetRef.current = sel;
    setTarget(sel);
  }, []);

  // Intercept the browser's own list on pointer devices.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (e.button !== 0 || !eligible(e.target)) return;
      e.preventDefault();
      const sel = e.target;
      sel.focus();
      if (targetRef.current === sel) close(false);
      else open(sel);
    };
    const onKey = (e: KeyboardEvent) => {
      if (!eligible(e.target)) return;
      if (e.key === "Enter" || e.key === " " || e.key === "F4" || (e.altKey && (e.key === "ArrowDown" || e.key === "ArrowUp"))) {
        e.preventDefault();
        open(e.target);
      }
    };
    document.addEventListener("mousedown", onDown, true);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("mousedown", onDown, true);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open, close]);

  // While open: follow the field, close on outside click.
  useEffect(() => {
    if (!target) return;
    const follow = (e: Event) => {
      if (popRef.current && e.target instanceof Node && popRef.current.contains(e.target)) return;
      if (!target.isConnected) { close(false); return; }
      setPlace(placeMenu(target.getBoundingClientRect(), 200));
    };
    const outside = (e: PointerEvent) => {
      const t = e.target as Node;
      if (popRef.current?.contains(t) || t === target) return;
      close(false);
    };
    window.addEventListener("resize", follow);
    window.addEventListener("scroll", follow, true);
    document.addEventListener("pointerdown", outside, true);
    const focusT = window.setTimeout(() => (opts.length > 8 ? searchRef.current : listRef.current)?.focus(), 0);
    return () => {
      window.removeEventListener("resize", follow);
      window.removeEventListener("scroll", follow, true);
      document.removeEventListener("pointerdown", outside, true);
      window.clearTimeout(focusT);
    };
  }, [target, close, opts.length]);

  const q = query.trim().toLowerCase();
  const shown = opts.map((o, i) => ({ ...o, i })).filter((o) => !q || `${o.label} ${o.group || ""}`.toLowerCase().includes(q));

  useEffect(() => {
    if (!target || active < 0) return;
    listRef.current?.querySelector<HTMLElement>(`[data-i="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [target, active]);

  if (!target || !place) return null;

  function pick(i: number) {
    const o = opts[i];
    if (!o || o.disabled || !target) return;
    const sel = target;
    close();
    if (sel.value !== o.value) writeValue(sel, o.value);
  }

  function move(dir: 1 | -1) {
    if (!shown.length) return;
    const pos = shown.findIndex((o) => o.i === active);
    let p = pos;
    for (let n = 0; n < shown.length; n += 1) {
      p = (p + dir + shown.length) % shown.length;
      if (!shown[p].disabled) { setActive(shown[p].i); return; }
    }
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); move(1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); move(-1); }
    else if (e.key === "Home") { e.preventDefault(); const f = shown.find((o) => !o.disabled); if (f) setActive(f.i); }
    else if (e.key === "End") { e.preventDefault(); const l = [...shown].reverse().find((o) => !o.disabled); if (l) setActive(l.i); }
    else if (e.key === "Enter") { e.preventDefault(); pick(active); }
    else if (e.key === "Escape") { e.preventDefault(); close(); }
    else if (e.key === "Tab") { close(); }
    else if (opts.length <= 8 && e.key.length === 1 && /\S/.test(e.key)) {
      const now = e.timeStamp;
      typed.current = { text: (now - typed.current.at < 700 ? typed.current.text : "") + e.key.toLowerCase(), at: now };
      const hit = opts.findIndex((o) => !o.disabled && o.label.toLowerCase().startsWith(typed.current.text));
      if (hit >= 0) setActive(hit);
    }
  }

  const current = target.value;
  const label = target.getAttribute("aria-label") || target.labels?.[0]?.textContent?.trim() || "Choose";

  return createPortal(
    <div
      ref={popRef}
      className={`v4-sel-pop${place.up ? " is-up" : ""}`}
      style={{ left: place.left, width: place.width, ...(place.up ? { bottom: window.innerHeight - place.top } : { top: place.top }) }}
      onKeyDown={onKey}
      data-native-upgrade=""
    >
      {opts.length > 8 ? (
        <div className="v4-sel-search">
          <Icon name="search" size="sm" />
          <input ref={searchRef} value={query} placeholder="Type to search…" aria-label="Search the list" onChange={(e) => {
            setQuery(e.target.value);
            const nq = e.target.value.trim().toLowerCase();
            const first = opts.findIndex((o) => !o.disabled && (!nq || `${o.label} ${o.group || ""}`.toLowerCase().includes(nq)));
            setActive(first);
          }} />
        </div>
      ) : null}
      <div ref={listRef} role="listbox" tabIndex={-1} aria-label={label} className="v4-sel-list" style={{ maxHeight: place.maxHeight - (opts.length > 8 ? 52 : 0) }}
        aria-activedescendant={active >= 0 ? `v4-nsel-${active}` : undefined}>
        {shown.length === 0 ? <p className="v4-sel-empty">Nothing matches your search.</p> : null}
        {shown.map((o, k) => {
          const head = o.group && (k === 0 || shown[k - 1].group !== o.group) ? o.group : null;
          const isSel = o.value === current;
          return (
            <div key={o.i} role="presentation">
              {head ? <div className="v4-sel-group" role="presentation">{head}</div> : null}
              <div id={`v4-nsel-${o.i}`} data-i={o.i} role="option" aria-selected={isSel} aria-disabled={o.disabled || undefined}
                className={`v4-sel-opt${o.i === active ? " is-active" : ""}${isSel ? " is-selected" : ""}`}
                onPointerMove={() => { if (!o.disabled && active !== o.i) setActive(o.i); }}
                onClick={() => pick(o.i)}>
                <span className="v4-sel-text"><span>{o.label}</span></span>
                {isSel ? <Icon name="tick" size="sm" className="v4-sel-tick" /> : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>,
    document.body,
  );
}
