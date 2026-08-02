"use client";

import { ActiveRoleSwitcher } from "@/app/components/ActiveRoleSwitcher";

export default function StaffRoleSwitcher() {
  return (
    <div className="w-full max-w-md rounded-2xl border border-cyan-300/30 bg-white/10 p-4 shadow-xl backdrop-blur-md">
      <p className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-cyan-100">
        Current Working Role
      </p>
      <ActiveRoleSwitcher compact hero />
    </div>
  );
}
