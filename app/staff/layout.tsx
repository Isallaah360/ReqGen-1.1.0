import type { ReactNode } from "react";
import StaffFooter from "@/app/components/staff/StaffFooter";
import StaffNavigation from "@/app/components/staff/StaffNavigation";

export default function StaffLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_#dbeafe_0,_#f8fafc_42%,_#eef2ff_100%)] px-3 py-5 sm:px-5 lg:px-7">
      <div className="mx-auto w-full max-w-[1420px]">
        {children}
        <StaffFooter />
      </div>
    </div>
  );
}

export function StaffWorkspaceNavigation() {
  return <StaffNavigation />;
}
