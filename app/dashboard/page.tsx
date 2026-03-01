"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";

type Profile = {
  id: string;
  full_name: string;
  role: string;
  gender: string | null;
  phone: string | null;
  dept_id: string | null;
  signature_url: string | null;
};

type Dept = { id: string; name: string };

type ReqRow = {
  id: string;
  request_no: string;
  title: string | null;
  request_type: "Personal" | "Official";
  personal_category: "Fund" | "NonFund" | null;
  amount: number;
  status: string;
  current_stage: string;
  created_at: string;
};

export default function DashboardPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [deptName, setDeptName] = useState<string>("");

  const [myRecent, setMyRecent] = useState<ReqRow[]>([]);
  const [myPendingActions, setMyPendingActions] = useState<ReqRow[]>([]);

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

      // Profile
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

      // Department name
      if (prof?.dept_id) {
        const { data: dept, error: deptErr } = await supabase
          .from("departments")
          .select("id,name")
          .eq("id", prof.dept_id)
          .single();

        if (!deptErr && dept) setDeptName((dept as Dept).name);
      }

      // My recent requests
      const { data: recent, error: recentErr } = await supabase
        .from("requests")
        .select(
          "id,request_no,title,request_type,personal_category,amount,status,current_stage,created_at"
        )
        .eq("created_by", user.id)
        .order("created_at", { ascending: false })
        .limit(5);

      if (!recentErr) setMyRecent((recent || []) as ReqRow[]);

      // My pending actions (requests currently assigned to me)
      const { data: pending, error: pendErr } = await supabase
        .from("requests")
        .select(
          "id,request_no,title,request_type,personal_category,amount,status,current_stage,created_at"
        )
        .eq("current_owner", user.id)
        .neq("status", "Completed")
        .neq("status", "Rejected")
        .order("created_at", { ascending: false })
        .limit(5);

      if (!pendErr) setMyPendingActions((pending || []) as ReqRow[]);

      setLoading(false);
    }

    load();
  }, [router]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="mt-2 text-sm text-gray-600">
            Welcome back{profile?.full_name ? `, ${profile.full_name}` : ""}.
          </p>
        </div>

        <div className="flex gap-2">
          <Link
            href="/requests/new"
            className="rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800"
          >
            New Request
          </Link>
          <button
            onClick={handleLogout}
            className="rounded-xl border px-4 py-2 text-sm font-semibold hover:bg-gray-50"
          >
            Logout
          </button>
        </div>
      </div>

      {loading && <p className="mt-6 text-gray-600">Loading...</p>}

      {msg && (
        <div className="mt-6 rounded-xl bg-gray-100 px-3 py-2 text-sm">
          {msg}
        </div>
      )}

      {profile && !loading && (
        <>
          {/* Profile Card */}
          <div className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold">My Profile</h2>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <p>
                <span className="text-sm text-gray-500">Name</span>
                <br />
                <b>{profile.full_name}</b>
              </p>
              <p>
                <span className="text-sm text-gray-500">Role</span>
                <br />
                <b>{profile.role}</b>
              </p>
              <p>
                <span className="text-sm text-gray-500">Department</span>
                <br />
                <b>{deptName || "—"}</b>
              </p>
              <p>
                <span className="text-sm text-gray-500">Phone</span>
                <br />
                <b>{profile.phone || "—"}</b>
              </p>
            </div>
          </div>

          {/* Two Lists */}
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            {/* Pending actions */}
            <div className="rounded-2xl border bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold">My Pending Actions</h2>
                <Link
                  href="/requests"
                  className="text-sm font-semibold underline"
                >
                  View all
                </Link>
              </div>

              {myPendingActions.length === 0 ? (
                <p className="mt-4 text-sm text-gray-600">
                  No pending actions assigned to you.
                </p>
              ) : (
                <div className="mt-4 space-y-3">
                  {myPendingActions.map((r) => (
                    <Link
                      key={r.id}
                      href={`/requests/${r.id}`}
                      className="block rounded-xl border p-3 hover:bg-gray-50"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="font-mono text-xs text-gray-500">
                            {r.request_no}
                          </div>
                          <div className="text-sm font-semibold">
                            {r.title || "—"}
                          </div>
                          <div className="text-xs text-gray-600">
                            {r.status} — {r.current_stage}
                          </div>
                        </div>
                        <div className="text-sm font-semibold">
                          ₦{Number(r.amount || 0).toLocaleString()}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* My recent requests */}
            <div className="rounded-2xl border bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold">My Recent Requests</h2>
                <Link
                  href="/requests"
                  className="text-sm font-semibold underline"
                >
                  View all
                </Link>
              </div>

              {myRecent.length === 0 ? (
                <p className="mt-4 text-sm text-gray-600">
                  You have not submitted any request yet.
                </p>
              ) : (
                <div className="mt-4 space-y-3">
                  {myRecent.map((r) => (
                    <Link
                      key={r.id}
                      href={`/requests/${r.id}`}
                      className="block rounded-xl border p-3 hover:bg-gray-50"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="font-mono text-xs text-gray-500">
                            {r.request_no}
                          </div>
                          <div className="text-sm font-semibold">
                            {r.title || "—"}
                          </div>
                          <div className="text-xs text-gray-600">
                            {r.request_type}
                            {r.personal_category ? ` (${r.personal_category})` : ""}
                            {" • "}
                            {r.status} — {r.current_stage}
                          </div>
                        </div>
                        <div className="text-sm font-semibold">
                          ₦{Number(r.amount || 0).toLocaleString()}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}