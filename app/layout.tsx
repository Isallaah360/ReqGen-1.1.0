import type { Metadata } from "next";
import "./globals.css";
import NavBar from "./components/NavBar";
import SessionTimeout from "./components/SessionTimeout";

export const metadata: Metadata = {
  title: "ReqGen 1.1.0",
  description: "IET Request Generator",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gradient-to-b from-gray-50 to-white text-gray-900">
        <NavBar />
        <SessionTimeout />
        {children}
      </body>
    </html>
  );
}