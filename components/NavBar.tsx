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

    const { data: sub } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSignedIn(!!session);
      }
    );

    return () => sub.subscription.unsubscribe();
  }, []);

  async function logout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  const linkClass = (href: string) =>
    `px-3 py-2 rounded-lg text-sm font-medium transition ${
      pathname === href
        ? "bg-black text-white"
        : "text-gray-700 hover:bg-gray-100"
    }`;

  return (
    <header className="sticky top-0 z-10 border-b bg-white/80 backdrop-blur">
      <div className="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between">
        
        {/* Logo now links to Dashboard */}
        <Link href="/dashboard" className="font-bold text-lg tracking-tight">
          ReqGen <span className="text-gray-400">1.1.0</span>
        </Link>

        <nav className="flex items-center gap-2">

          <Link className={linkClass("/dashboard")} href="/dashboard">
            Dashboard
          </Link>

          <Link className={linkClass("/requests")} href="/requests">
            My Requests
          </Link>

          <Link className={linkClass("/requests/new")} href="/requests/new">
            New Request
          </Link>

          {signedIn ? (
            <button
              onClick={logout}
              className="ml-2 px-3 py-2 rounded-lg text-sm font-semibold bg-red-600 text-white hover:bg-red-700 transition"
            >
              Logout
            </button>
          ) : (
            <Link
              className="ml-2 px-3 py-2 rounded-lg text-sm font-semibold bg-black text-white hover:bg-gray-800 transition"
              href="/login"
            >
              Login
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}