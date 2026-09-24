import type { Metadata, Viewport } from "next";
import "./globals.css";

import SessionTimeout from "./components/SessionTimeout";
import MfaGuard from "./components/MfaGuard";
import RouteAccessGuard from "./components/RouteAccessGuard";
import GlobalTips from "./components/GlobalTips";
import GovernmentAppShell from "./components/GovernmentAppShell";
import { REQGEN_PRODUCT_NAME } from "@/lib/version";

export const metadata: Metadata = {
  metadataBase: new URL("https://req-gen-1-1-0.vercel.app"),
  title: {
    default: REQGEN_PRODUCT_NAME,
    template: `%s | ${REQGEN_PRODUCT_NAME}`,
  },
  description: "Islamic Education Trust (IET) secure request management system.",
  applicationName: REQGEN_PRODUCT_NAME,
  creator: "Barderian Enterprises",
  authors: [{ name: "Barderian Enterprises" }],
  keywords: [
    "IET",
    "ReqGen",
    "Request Management",
    "Approvals",
    "Finance",
    "Registry",
    "Human Resources",
    "Audit",
    "Workflow",
    "Supabase",
    "Next.js",
  ],
};

export const viewport: Viewport = {
  themeColor: "#0b2d57",
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <GovernmentAppShell>
          <MfaGuard>
            <RouteAccessGuard>
              <SessionTimeout />
              {children}
              <GlobalTips />
            </RouteAccessGuard>
          </MfaGuard>
        </GovernmentAppShell>
      </body>
    </html>
  );
}
