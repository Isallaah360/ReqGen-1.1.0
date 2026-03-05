"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Profile = {
  id: string;
  full_name: string;
  role: string;
  gender: string | null;
  phone: string | null;
  dept_id: string | null;
  signature_url: string | null;
};

export default function DashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [deptName, setDeptName] = useState<string>("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      setMsg(null);

      const { data: authData } = await supabase.auth.getUser();
      const user = authData.user;

      if (!user) {
        router.push("/login");
        return;
      }

      const { data: prof, error: profErr } = await supabase
        .from("profiles")
        .select("id,full_name,role,gender,phone,dept_id,signature_url")
        .eq("id", user.id)
        .single();

      if (profErr) {
        setMsg("Failed to load profile: " + profErr.message);
        setLoading(false);
        return;
      }

      setProfile(prof as Profile);

      if ((prof as any)?.dept_id) {
        const { data: dept } = await supabase
          .from("departments")
          .select("name")
          .eq("id", (prof as any).dept_id)
          .single();

        if (dept?.name) setDeptName(dept.name);
      }

      setLoading(false);
    }

    load();
  }, [router]);

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 px-4">
        <div className="mx-auto max-w-3xl py-10 text-slate-600">Loading...</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4">
      <div className="mx-auto max-w-3xl py-10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
              Dashboard
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Welcome back. Manage your requests and profile.
            </p>
          </div>

          <button
            onClick={() => router.push("/profile")}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100"
          >
            My Profile
          </button>
        </div>

        {msg && (
          <div className="mt-4 rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-800">
            {msg}
          </div>
        )}

        {profile && (
          <div className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
            <div className="grid gap-4 md:grid-cols-2">
              <Info label="Name" value={profile.full_name} />
              <Info label="Role" value={profile.role} />
              <Info label="Department" value={deptName || "—"} />
              <Info label="Gender" value={profile.gender || "—"} />
              <Info label="Phone" value={profile.phone || "—"} />
              <Info
                label="Signature"
                value={profile.signature_url ? "Uploaded ✅" : "Not uploaded ❌"}
              />
            </div>

            {!profile.signature_url && (
              <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                You must upload your signature in <b>My Profile</b> before submitting requests.
              </div>
            )}

            <div className="mt-6 grid gap-3 md:grid-cols-2">
              <button
                onClick={() => router.push("/requests/new")}
                className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
              >
                Create New Request
              </button>

              <button
                onClick={() => router.push("/requests")}
                className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-100"
              >
                View My Requests
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
      <div className="text-xs font-semibold text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-semibold text-slate-900">{value}</div>
    </div>
  );
}