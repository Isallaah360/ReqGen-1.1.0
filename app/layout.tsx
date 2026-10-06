import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./theme-iet.generated.css";
import "./theme-dark.generated.css";
import "./theme-dark.css";

import SessionTimeout from "./components/SessionTimeout";
import MfaGuard from "./components/MfaGuard";
import RouteAccessGuard from "./components/RouteAccessGuard";
import GlobalTips from "./components/GlobalTips";
import GovernmentAppShell from "./components/GovernmentAppShell";
import { REQGEN_PRODUCT_NAME } from "@/lib/version";
import { THEME_BOOT_SCRIPT } from "@/lib/theme";
import PasswordReveal from "@/app/components/PasswordReveal";
import TableCards from "@/app/components/TableCards";
import FieldShells from "@/app/components/FieldShells";

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
  colorScheme: "light dark",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head>
        {/* Applies the saved/system theme before first paint (no white flash). */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body suppressHydrationWarning>
        <PasswordReveal />
        <TableCards />
        <FieldShells />
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
