"use client";

import type { ReactNode } from "react";
import DirectorateWorkspaceMenu, { type DirectorateWorkspaceItem } from "@/app/components/ui/DirectorateWorkspaceMenu";

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}

const items: DirectorateWorkspaceItem[] = [
  {
    href: "/hr",
    title: "HR Dashboard",
    description: "Directorate overview, live HR workload and decision indicators.",
    gradient: "from-slate-950 via-slate-800 to-blue-900",
    badge: "Home",
    icon: <Icon><path d="m3 11 9-8 9 8" /><path d="M5 10v10h14V10" /><path d="M9 20v-6h6v6" /></Icon>,
  },
  {
    href: "/hr/assignments",
    title: "Officer Assignments",
    description: "Assign multiple HR functions, permissions and operational scopes.",
    gradient: "from-violet-700 via-indigo-600 to-blue-600",
    icon: <Icon><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="m19 8 2 2 3-3" /></Icon>,
  },
  {
    href: "/hr/my-work",
    title: "My HR Work",
    description: "Assigned duties, returned work and completed officer submissions.",
    gradient: "from-cyan-700 via-sky-600 to-blue-600",
    icon: <Icon><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M8 2v4M16 2v4M3 10h18" /><path d="m9 15 2 2 4-4" /></Icon>,
  },
  {
    href: "/hr/review",
    title: "HR Boss Review",
    description: "Review recommendations, return corrections and finalize HR positions.",
    gradient: "from-orange-700 via-amber-600 to-yellow-600",
    icon: <Icon><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></Icon>,
  },
  {
    href: "/hr/filing",
    title: "HR Filing",
    description: "Monitor HR-bound requests and complete final filing actions.",
    gradient: "from-emerald-700 via-green-600 to-teal-600",
    icon: <Icon><path d="M4 4h16v16H4z" /><path d="M8 2v4M16 2v4M8 11h8M8 15h5" /></Icon>,
  },
  {
    href: "/hr/staff",
    title: "Staff Files",
    description: "Manage summarized personnel-file workflows and staff records.",
    gradient: "from-blue-800 via-blue-600 to-cyan-600",
    icon: <Icon><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></Icon>,
  },
  {
    href: "/hr/leave",
    title: "Leave Records",
    description: "Review leave workflows, HR actions and filing progress.",
    gradient: "from-fuchsia-700 via-purple-600 to-violet-600",
    icon: <Icon><path d="M8 2v4M16 2v4" /><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M3 10h18M8 14h.01M12 14h.01M16 14h.01" /></Icon>,
  },
  {
    href: "/hr/archive",
    title: "HR Archive",
    description: "Access completed, closed and archived HR workflow records.",
    gradient: "from-amber-800 via-orange-700 to-red-600",
    icon: <Icon><path d="M3 6h18M5 6l1 15h12l1-15M8 6V3h8v3M9 11h6" /></Icon>,
  },
  {
    href: "/hr/registrar",
    title: "Registrar Centre",
    description: "Control personnel files, movement, classification and archive readiness.",
    gradient: "from-teal-800 via-cyan-700 to-sky-600",
    icon: <Icon><path d="M3 21h18M5 21V5l7-3 7 3v16M9 9h6M9 13h6M9 17h6" /></Icon>,
  },
  {
    href: "/hr/audit",
    title: "Audit Trail",
    description: "Inspect assignments, reviews, decisions and authority changes.",
    gradient: "from-rose-800 via-red-700 to-orange-600",
    icon: <Icon><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" /><path d="m9 12 2 2 4-4" /></Icon>,
  },
];

export default function HRNavigation() {
  return (
    <DirectorateWorkspaceMenu
      title="HR Workspace Menu"
      subtitle="Ten centralized HR workspaces arranged in two balanced rows of five on wide screens."
      items={items}
    />
  );
}
