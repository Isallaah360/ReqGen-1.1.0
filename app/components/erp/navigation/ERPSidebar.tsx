"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

export interface ERPSidebarItem {
  label: string;
  href: string;
  icon: ComponentType<{ size?: number; strokeWidth?: number }>;
  badge?: string | number;
  visible?: boolean;
}

export interface ERPSidebarGroup {
  label?: string;
  items: ERPSidebarItem[];
}

export interface ERPSidebarProps {
  groups: ERPSidebarGroup[];
  collapsed: boolean;
  mobileOpen: boolean;
  onToggle: () => void;
  onMobileClose: () => void;
  logoSrc?: string;
  productName?: string;
  companyName?: string;
  environment?: string;
  version?: string;
}

/** Persistent role-aware sidebar. Pass only items permitted for the active role. */
export default function ERPSidebar({
  groups,
  collapsed,
  mobileOpen,
  onToggle,
  onMobileClose,
  logoSrc = "/iet-logo.png",
  productName = "ReqGen ERP",
  companyName = "IET Family",
  environment = "Production",
  version = "2.0",
}: ERPSidebarProps) {
  const pathname = usePathname();

  return (
    <>
      <button
        type="button"
        className={`erp2-sidebar-backdrop ${mobileOpen ? "is-open" : ""}`}
        aria-label="Close navigation"
        onClick={onMobileClose}
      />
      <aside className={`erp2-sidebar ${collapsed ? "is-collapsed" : ""} ${mobileOpen ? "is-mobile-open" : ""}`}>
        <header className="erp2-sidebar__brand">
          <Image src={logoSrc} alt="IET logo" width={42} height={42} priority />
          <div><strong>{productName}</strong><span>{companyName}</span></div>
          <button type="button" className="erp2-sidebar__mobile-close" onClick={onMobileClose} aria-label="Close navigation"><X size={18} /></button>
        </header>

        <nav className="erp2-sidebar__nav" aria-label="ERP modules">
          {groups.map((group, groupIndex) => {
            const visibleItems = group.items.filter((item) => item.visible !== false);
            if (!visibleItems.length) return null;
            return (
              <section key={`${group.label ?? "group"}-${groupIndex}`}>
                {group.label ? <h2>{group.label}</h2> : null}
                <div>
                  {visibleItems.map((item) => {
                    const Icon = item.icon;
                    const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                    return (
                      <Link
                        href={item.href}
                        key={item.href}
                        className={active ? "erp2-sidebar__link is-active" : "erp2-sidebar__link"}
                        title={collapsed ? item.label : undefined}
                        onClick={onMobileClose}
                      >
                        <Icon size={19} strokeWidth={2} />
                        <span>{item.label}</span>
                        {item.badge !== undefined ? <b>{item.badge}</b> : null}
                      </Link>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </nav>

        <footer className="erp2-sidebar__footer">
          <div><i /><span>{environment}</span><b>v{version}</b></div>
          <button type="button" onClick={onToggle} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
            {collapsed ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}
            <span>{collapsed ? "Expand" : "Collapse"}</span>
          </button>
        </footer>
      </aside>
    </>
  );
}
