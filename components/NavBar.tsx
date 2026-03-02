"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "../lib/supabaseClient";

export default function NavBar() {
  const router = useRouter();
  const pathname = usePathname();
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setSignedIn(!!session);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  async function logout() {
    await supabase.auth.signOut();
    router.push("/");
  }

  const headerStyle: React.CSSProperties = {
    position: "sticky",
    top: 0,
    zIndex: 50,
    background: "#ffffff",
    borderBottom: "1px solid #d7deea",
    boxShadow: "0 1px 6px rgba(11, 18, 32, 0.06)",
  };

  const wrapStyle: React.CSSProperties = {
    maxWidth: 980,
    margin: "0 auto",
    padding: "12px 16px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  };

  const brandStyle: React.CSSProperties = {
    fontWeight: 800,
    fontSize: 18,
    color: "#0b1220",
    letterSpacing: "-0.2px",
  };

  const navStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  };

  const pillBase: React.CSSProperties = {
    padding: "10px 14px",
    borderRadius: 12,
    fontSize: 13,
    fontWeight: 700,
    border: "1px solid #d7deea",
    background: "#ffffff",
    color: "#0b1220",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    lineHeight: 1,
    cursor: "pointer",
  };

  const pillActive: React.CSSProperties = {
    ...pillBase,
    border: "1px solid #1d4ed8",
    background: "#1d4ed8", // blue-700
    color: "#ffffff",
    boxShadow: "0 6px 16px rgba(29, 78, 216, 0.22)",
  };

  const pillHover: React.CSSProperties = {
    ...pillBase,
    background: "#eef2ff", // very light blue
    border: "1px solid #c7d2fe",
    color: "#1d4ed8",
  };

  // small helper component so hover looks nice without Tailwind
  function NavPill({ href, label }: { href: string; label: string }) {
    const active = pathname === href;
    const [hover, setHover] = useState(false);

    return (
      <Link
        href={href}
        style={active ? pillActive : hover ? pillHover : pillBase}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
      >
        {label}
      </Link>
    );
  }

  return (
    <header style={headerStyle}>
      <div style={wrapStyle}>
        <Link href="/" style={brandStyle}>
          ReqGen <span style={{ color: "#64748b", fontWeight: 800 }}>1.1.0</span>
        </Link>

        {signedIn && (
          <nav style={navStyle}>
            <NavPill href="/dashboard" label="Dashboard" />
            <NavPill href="/requests" label="My Requests" />
            <NavPill href="/requests/new" label="New Request" />

            <button
              onClick={logout}
              style={{
                ...pillBase,
                border: "1px solid #ef4444",
                background: "#ef4444",
                color: "#ffffff",
                boxShadow: "0 6px 16px rgba(239, 68, 68, 0.18)",
              }}
            >
              Logout
            </button>
          </nav>
        )}
      </div>
    </header>
  );
}