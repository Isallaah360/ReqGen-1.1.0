"use client";

import { usePathname } from "next/navigation";
import { getRouteRegistryItem } from "@/lib/routeRegistry";

function greeting(now = new Date()) {
  const hour = now.getHours();
  if (hour < 12) return { text: "Good Morning", icon: "🌅" };
  if (hour < 17) return { text: "Good Afternoon", icon: "☀️" };
  return { text: "Good Evening", icon: "🌙" };
}

export default function GlobalPageHeader({ userName }: { userName: string }) {
  const pathname = usePathname();
  const route = getRouteRegistryItem(pathname);
  const hello = greeting();

  return (
    <div className="rg-global-page-header">
      <div className="rg-global-page-title">
        <h1>{route?.title || "ReqGen"}</h1>
      </div>
      <div className="rg-global-greeting" aria-label={`${hello.text}, ${userName}`}>
        <span aria-hidden="true">{hello.icon}</span>
        <div><small>{hello.text}</small><strong>{userName}</strong></div>
      </div>
    </div>
  );
}
