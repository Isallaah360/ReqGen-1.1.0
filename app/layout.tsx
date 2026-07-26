import type { Metadata, Viewport } from "next";
import "./globals.css";
import NavBar from "./components/NavBar";
import SessionTimeout from "./components/SessionTimeout";
import MfaGuard from "./components/MfaGuard";

export const metadata: Metadata = {
  metadataBase: new URL("https://req-gen-1-1-0.vercel.app"),

  title: {
    default: "ReqGen 1.1.0",
    template: "%s | ReqGen 1.1.0",
  },

  description:
    "Islamic Education Trust (IET) Request Management & Finance Control System.",

  applicationName: "ReqGen 1.1.0",

  creator: "Barderian Enterprises",

  authors: [
    {
      name: "Barderian Enterprises",
    },
  ],

  keywords: [
    "IET",
    "Request Generator",
    "Finance",
    "Workflow",
    "Approval",
    "Voucher",
    "Payment",
    "Supabase",
    "Next.js",
  ],
};

export const viewport: Viewport = {
  themeColor: "#2563eb",
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className="min-h-screen bg-gradient-to-b from-gray-50 to-white text-gray-900 antialiased"
      >
        <MfaGuard />

        <NavBar />

        <SessionTimeout />

        <main>{children}</main>
      </body>
    </html>
  );
}