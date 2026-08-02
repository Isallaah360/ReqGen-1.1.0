"use client";

import { CalendarDays } from "lucide-react";
import { HRAccessGuard, HRNavigation } from "@/app/components/hr";
import LeaveDashboard from "@/app/components/hr/LeaveDashboard";
import { HRHero, HRPageShell } from "@/app/components/hr/HREnterprisePage";

export default function HRLeavePage(){return <HRAccessGuard section="leave" permission="view"><HRPageShell><HRHero eyebrow="HR Leave Administration" title="Leave Operations Centre" description="A complete operational workspace for leave review, HR recommendations, approval tracking, current leave monitoring and final filing." icon={CalendarDays} tone="violet"/><HRNavigation/><div className="[&>main]:min-h-0 [&>main]:bg-transparent [&>main]:p-0 [&>main>div]:max-w-none [&>main>div>section:first-child]:hidden [&>main>div>nav]:hidden"><LeaveDashboard/></div></HRPageShell></HRAccessGuard>}
