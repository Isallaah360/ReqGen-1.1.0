"use client";

import type { ReactNode } from "react";

export interface ERPTabItem<Value extends string = string> {
  value: Value;
  label: string;
  count?: number;
  icon?: ReactNode;
  disabled?: boolean;
}

export interface ERPTabsProps<Value extends string = string> {
  tabs: ERPTabItem<Value>[];
  value: Value;
  onChange: (value: Value) => void;
  ariaLabel?: string;
  className?: string;
}

/** Compact, keyboard-accessible ERP tab bar with a gold active accent. */
export default function ERPTabs<Value extends string = string>({
  tabs,
  value,
  onChange,
  ariaLabel = "Page sections",
  className = "",
}: ERPTabsProps<Value>) {
  function move(currentIndex: number, direction: 1 | -1) {
    for (let step = 1; step <= tabs.length; step += 1) {
      const candidate = tabs[(currentIndex + step * direction + tabs.length) % tabs.length];
      if (!candidate.disabled) {
        onChange(candidate.value);
        document.getElementById(`erp2-tab-${candidate.value}`)?.focus();
        break;
      }
    }
  }

  return (
    <div className={`erp2-tabs ${className}`.trim()} role="tablist" aria-label={ariaLabel}>
      {tabs.map((tab, index) => {
        const active = tab.value === value;
        return (
          <button
            id={`erp2-tab-${tab.value}`}
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            disabled={tab.disabled}
            className={active ? "erp2-tab is-active" : "erp2-tab"}
            onClick={() => onChange(tab.value)}
            onKeyDown={(event) => {
              if (event.key === "ArrowRight") { event.preventDefault(); move(index, 1); }
              if (event.key === "ArrowLeft") { event.preventDefault(); move(index, -1); }
            }}
          >
            {tab.icon}
            <span>{tab.label}</span>
            {typeof tab.count === "number" ? <b>{tab.count}</b> : null}
          </button>
        );
      })}
    </div>
  );
}
