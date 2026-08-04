"use client";

import { useState, type ReactNode } from "react";
import ERPSidebar, { type ERPSidebarGroup } from "@/app/components/erp/navigation/ERPSidebar";
import ERPTopNavbar, { type ERPTopNavbarUser } from "@/app/components/erp/navigation/ERPTopNavbar";
import ERPWorkspace from "@/app/components/erp/layout/ERPWorkspace";

export interface ERPApplicationShellProps {
  children: ReactNode;
  navigation: ERPSidebarGroup[];
  user: ERPTopNavbarUser;
  moduleTitle: string;
  roleSwitcher?: ReactNode;
  notificationCount?: number;
  onLogout?: () => void | Promise<void>;
}

/**
 * Mount this once in app/erp-2/layout.tsx. Route changes then replace only children,
 * preventing the topbar and sidebar from flickering or disappearing.
 */
export default function ERPApplicationShell({
  children,
  navigation,
  user,
  moduleTitle,
  roleSwitcher,
  notificationCount,
  onLogout,
}: ERPApplicationShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className={`erp2-shell ${collapsed ? "is-sidebar-collapsed" : ""}`}>
      <a className="erp2-skip-link" href="#erp-main-content">Skip to main content</a>
      <ERPSidebar
        groups={navigation}
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onToggle={() => setCollapsed((value) => !value)}
        onMobileClose={() => setMobileOpen(false)}
      />
      <div className="erp2-shell__body">
        <ERPTopNavbar
          user={user}
          moduleTitle={moduleTitle}
          roleSwitcher={roleSwitcher}
          notificationCount={notificationCount}
          onMobileMenu={() => setMobileOpen(true)}
          onLogout={onLogout}
        />
        <ERPWorkspace>{children}</ERPWorkspace>
      </div>
    </div>
  );
}
