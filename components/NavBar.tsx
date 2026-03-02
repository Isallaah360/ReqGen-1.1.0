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
    supabase.auth.getSession().then(({ data }) => {
      setSignedIn(!!data.session);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setSignedIn(!!session);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  async function logout() {
    await supabase.auth.signOut();
    router.push("/");
  }

  const linkClass = (href: string) =>
    `px-3 py-2 rounded-lg text-sm font-medium transition ${
      pathname === href ? "bg-black text-white" : "text-slate-700 hover:bg-slate-100"
    }`;

  return (
    <header className="sticky top-0 z-10 border-b bg-white/80 backdrop-blur">
      <div className="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between">
        <Link href="/" className="font-bold text-lg tracking-tight">
          ReqGen <span className="text-slate-400">1.1.0</span>
        </Link>

        <nav className="flex items-center gap-2">
          {!signedIn ? (
            <>
              <Link className={linkClass("/signup")} href="/signup">
                Sign Up
              </Link>
              <Link
                className="ml-2 px-3 py-2 rounded-lg text-sm font-semibold bg-black text-white hover:bg-slate-800 transition"
                href="/login"
              >
                Login
              </Link>
            </>
          ) : (
            <>
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
                className="ml-2 px-3 py-2 rounded-lg text-sm font-semibold bg-red-600 text-white hover:bg-red-700 transition"
              >
                Logout
              </button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}