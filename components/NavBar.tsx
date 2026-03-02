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

  const linkClass = (href: string) => {
    const active = pathname === href;
    return [
      "px-4 py-2 rounded-xl text-sm font-semibold transition",
      "border",
      active
        ? "bg-blue-600 text-white border-blue-600 shadow-sm"
        : "bg-white text-slate-900 border-slate-200 hover:bg-slate-100",
    ].join(" ");
  };

  return (
    <header className="sticky top-0 z-50 border-b bg-white shadow-sm">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/" className="text-lg font-extrabold tracking-tight text-slate-900">
          ReqGen <span className="text-slate-400">1.1.0</span>
        </Link>

        {signedIn && (
          <nav className="flex items-center gap-2">
            <Link className={linkClass("/approvals")} href="/approvals">
            Approvals
          </Link>
            <Link className={linkClass("/dashboard")} href="/dashboard">
              Dashboard
            </Link>
            <Link className={linkClass("/requests")} href="/requests">
              My Requests
            </Link>
            <Link className={linkClass("/requests/new")} href="/requests/new">
              New Request
            </Link>

            <button
              onClick={logout}
              className="ml-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700"
            >
              Logout
            </button>
          </nav>
        )}
      </div>
    </header>
  );
}