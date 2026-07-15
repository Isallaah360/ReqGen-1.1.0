"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type RequestRow = {
    id: string;
    request_no: string | null;
    title: string;
    details: string | null;
    amount: number | null;
    status: string | null;
    current_stage: string | null;
    current_owner: string | null;
    created_by: string | null;
    dept_id: string | null;
    request_type: string | null;
    personal_category: string | null;
    created_at: string;
    requester_name: string | null;
    assigned_account_officer_name: string | null;
};

type ProfileRow = {
    id: string;
    full_name: string | null;
    role: string | null;
};

type DepartmentRow = {
    id: string;
    name: string;
};

type ProfileRole = {
    id: string;
    profile_id: string;
    role_key: string;
    role_name: string;
    is_primary: boolean;
    is_active: boolean;
};

type DepartmentMovement = {
    dept_id: string;
    dept_name: string;
    total: number;
    today: number;
    po: number;
    dod: number;
    dinAdmin: number;
    registrar: number;
    hod: number;
    hr: number;
    dg: number;
    account: number;
    hrFiling: number;
    completed: number;
    rejected: number;
};

type StageFilter =
    | "ALL"
    | "TODAY"
    | "PO"
    | "DOD"
    | "DINADMIN"
    | "REGISTRAR"
    | "HOD"
    | "DG"
    | "HRFILING"
    | "HR"
    | "ACCOUNT"
    | "COMPLETED"
    | "REJECTED";

function roleKey(role: string | null | undefined) {
    return (role || "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "")
        .replace(/_/g, "");
}

function stageKey(stage: string | null | undefined) {
    return (stage || "")
        .trim()
        .toUpperCase()
        .replace(/\s+/g, "")
        .replace(/_/g, "");
}

function categoryKey(category: string | null | undefined) {
    return (category || "")
        .trim()
        .toUpperCase()
        .replace(/\s+/g, "")
        .replace(/_/g, "");
}

function normalize(v: string | null | undefined) {
    return (v || "").toLowerCase().replace(/[^a-z]/g, "");
}

function hasAnyRole(roleSet: Set<string>, roles: string[]) {
    return roles.some((r) => roleSet.has(roleKey(r)));
}

function shortDate(d: string | null | undefined) {
    if (!d) return "—";
    return new Date(d).toLocaleDateString();
}

function shortDateTime(d: string | null | undefined) {
    if (!d) return "—";
    return new Date(d).toLocaleString();
}

function naira(n: number | null | undefined) {
    return "₦" + Math.round(Number(n || 0)).toLocaleString();
}

function isToday(dateText: string | null | undefined) {
    if (!dateText) return false;

    const d = new Date(dateText);
    const now = new Date();

    return (
        d.getFullYear() === now.getFullYear() &&
        d.getMonth() === now.getMonth() &&
        d.getDate() === now.getDate()
    );
}

function isClosed(r: RequestRow) {
    const s = String(r.status || "").toLowerCase();
    const stg = stageKey(r.current_stage);

    return (
        ["COMPLETED", "REJECTED", "DELETED", "CANCELLED"].includes(stg) ||
        s.includes("complete") ||
        s.includes("paid") ||
        s.includes("reject") ||
        s.includes("delete") ||
        s.includes("cancel")
    );
}

function isRejected(r: RequestRow) {
    const s = String(r.status || "").toLowerCase();
    const stg = stageKey(r.current_stage);

    return (
        ["REJECTED", "DELETED", "CANCELLED"].includes(stg) ||
        s.includes("reject") ||
        s.includes("delete") ||
        s.includes("cancel")
    );
}

function isCompleted(r: RequestRow) {
    const s = String(r.status || "").toLowerCase();
    const stg = stageKey(r.current_stage);

    return stg === "COMPLETED" || s.includes("complete") || s.includes("paid");
}

function requestTypeLabel(r: RequestRow) {
    if (normalize(r.request_type) === "official") return "Official";

    if (normalize(r.request_type) === "personal") {
        if (categoryKey(r.personal_category) === "FUND") return "Personal Fund";

        const cat = String(r.personal_category || "").trim();

        if (!cat || categoryKey(cat) === "NONFUND") return "Personal Other";

        return `Personal ${cat}`;
    }

    return "—";
}

function amountLabel(r: RequestRow) {
    if (normalize(r.request_type) === "personal" && categoryKey(r.personal_category) !== "FUND") {
        return "N/A";
    }

    return naira(r.amount);
}

function stageLabel(stage: string | null | undefined) {
    const s = stageKey(stage);

    if (s === "PO") return "PO";
    if (s === "DOD") return "DOD";
    if (s === "DINADMIN") return "DIN Admin";
    if (s === "REGISTRAR") return "Registrar";
    if (s === "HOD") return "HOD";
    if (s === "HR") return "HR";
    if (s === "DG") return "DG";
    if (s === "ACCOUNT") return "AccountOfficer";
    if (s === "HRFILING") return "HR Filing";
    if (s === "COMPLETED") return "Completed";
    if (s === "REJECTED") return "Rejected";
    if (s === "DELETED") return "Deleted";
    if (s === "CANCELLED") return "Cancelled";

    return stage || "—";
}

function stageBadgeClass(stage: string | null | undefined, status?: string | null) {
    const s = stageKey(stage);
    const st = String(status || "").toLowerCase();

    if (s === "DG") return "border-indigo-200 bg-indigo-50 text-indigo-700";
    if (s === "HRFILING") return "border-purple-200 bg-purple-50 text-purple-700";
    if (s === "HR") return "border-blue-200 bg-blue-50 text-blue-700";
    if (s === "ACCOUNT") return "border-amber-200 bg-amber-50 text-amber-700";
    if (["PO", "DOD", "HOD", "DINADMIN", "REGISTRAR"].includes(s)) {
        return "border-emerald-200 bg-emerald-50 text-emerald-700";
    }

    if (s === "COMPLETED" || st.includes("paid") || st.includes("complete")) {
        return "border-emerald-200 bg-emerald-50 text-emerald-700";
    }

    if (["REJECTED", "DELETED", "CANCELLED"].includes(s) || st.includes("reject")) {
        return "border-red-200 bg-red-50 text-red-700";
    }

    return "border-slate-200 bg-slate-50 text-slate-700";
}

function typeBadgeClass(r: RequestRow) {
    const type = normalize(r.request_type);
    const cat = categoryKey(r.personal_category);

    if (type === "official") return "border-blue-200 bg-blue-50 text-blue-700";
    if (cat === "FUND") return "border-indigo-200 bg-indigo-50 text-indigo-700";
    if (cat === "LEAVE") return "border-emerald-200 bg-emerald-50 text-emerald-700";
    if (cat === "CONTRACTRENEWAL") return "border-purple-200 bg-purple-50 text-purple-700";
    if (cat === "RESIGNATION") return "border-red-200 bg-red-50 text-red-700";
    if (cat === "OTHERS") return "border-amber-200 bg-amber-50 text-amber-800";

    return "border-slate-200 bg-slate-50 text-slate-700";
}

function roleSummary(fallbackRole: string, roles: ProfileRole[]) {
    const active = roles.filter((r) => r.is_active);

    if (active.length === 0) return fallbackRole || "Staff";

    return active
        .slice()
        .sort((a, b) => {
            if (a.is_primary && !b.is_primary) return -1;
            if (!a.is_primary && b.is_primary) return 1;
            return a.role_name.localeCompare(b.role_name);
        })
        .map((r) => r.role_name)
        .join(", ");
}

export default function RegistryPage() {
    const router = useRouter();

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [msg, setMsg] = useState<string | null>(null);
    const [copyMsg, setCopyMsg] = useState<string | null>(null);

    const [myRole, setMyRole] = useState("Staff");
    const [myRoles, setMyRoles] = useState<ProfileRole[]>([]);

    const [requests, setRequests] = useState<RequestRow[]>([]);
    const [profiles, setProfiles] = useState<ProfileRow[]>([]);
    const [departments, setDepartments] = useState<DepartmentRow[]>([]);

    const [search, setSearch] = useState("");
    const [stageFilter, setStageFilter] = useState<StageFilter>("ALL");
    const [deptFilter, setDeptFilter] = useState("ALL");

    const roleSet = useMemo(() => {
        const set = new Set<string>();

        if (myRole) set.add(roleKey(myRole));

        myRoles.forEach((r) => {
            if (r.is_active) set.add(roleKey(r.role_key));
        });

        return set;
    }, [myRole, myRoles]);

    const canAccess = useMemo(() => {
        return hasAnyRole(roleSet, ["admin", "auditor", "registry"]);
    }, [roleSet]);

    const profileMap = useMemo(() => {
        const map = new Map<string, ProfileRow>();

        profiles.forEach((p) => {
            map.set(p.id, p);
        });

        return map;
    }, [profiles]);

    const deptMap = useMemo(() => {
        const map = new Map<string, string>();

        departments.forEach((d) => {
            map.set(d.id, d.name);
        });

        return map;
    }, [departments]);

    const load = useCallback(
        async (options?: { silent?: boolean }) => {
            if (options?.silent) {
                setRefreshing(true);
            } else {
                setLoading(true);
            }

            setMsg(null);
            setCopyMsg(null);

            const { data: auth } = await supabase.auth.getUser();

            if (!auth.user) {
                router.push("/login");
                return;
            }

            const [profRes, rolesRes] = await Promise.all([
                supabase.from("profiles").select("role").eq("id", auth.user.id).maybeSingle(),

                supabase
                    .from("profile_roles")
                    .select("id,profile_id,role_key,role_name,is_primary,is_active")
                    .eq("profile_id", auth.user.id)
                    .eq("is_active", true),
            ]);

            if (profRes.error) {
                setMsg("Failed to load your profile: " + profRes.error.message);
                setLoading(false);
                setRefreshing(false);
                return;
            }

            const fallbackRole = String(profRes.data?.role || "Staff");
            const activeRoles = (rolesRes.data || []) as ProfileRole[];

            setMyRole(fallbackRole);
            setMyRoles(activeRoles);

            const nextRoleSet = new Set<string>();

            if (fallbackRole) nextRoleSet.add(roleKey(fallbackRole));

            activeRoles.forEach((r) => {
                if (r.is_active) nextRoleSet.add(roleKey(r.role_key));
            });

            const allowed = hasAnyRole(nextRoleSet, ["admin", "auditor", "registry"]);

            if (!allowed) {
                setMsg("Access denied. Only Registry, Admin and Auditor can access Registry Desk.");
                setRequests([]);
                setProfiles([]);
                setDepartments([]);
                setLoading(false);
                setRefreshing(false);
                return;
            }

            const [reqRes, profilesRes, deptRes] = await Promise.all([
                supabase
                    .from("requests")
                    .select(
                        "id,request_no,title,details,amount,status,current_stage,current_owner,created_by,dept_id,request_type,personal_category,created_at,requester_name,assigned_account_officer_name"
                    )
                    .order("created_at", { ascending: false })
                    .limit(1000),

                supabase.from("profiles").select("id,full_name,role"),

                supabase.from("departments").select("id,name").order("name", { ascending: true }),
            ]);

            if (reqRes.error) {
                setMsg("Failed to load requests: " + reqRes.error.message);
                setRequests([]);
            } else {
                setRequests((reqRes.data || []) as RequestRow[]);
            }

            if (profilesRes.error) {
                setProfiles([]);
            } else {
                setProfiles((profilesRes.data || []) as ProfileRow[]);
            }

            if (deptRes.error) {
                setDepartments([]);
            } else {
                setDepartments((deptRes.data || []) as DepartmentRow[]);
            }

            setLoading(false);
            setRefreshing(false);
        },
        [router]
    );

    useEffect(() => {
        load();

        const refreshOnFocus = () => {
            load({ silent: true });
        };

        const refreshOnVisible = () => {
            if (document.visibilityState === "visible") {
                load({ silent: true });
            }
        };

        window.addEventListener("focus", refreshOnFocus);
        document.addEventListener("visibilitychange", refreshOnVisible);

        return () => {
            window.removeEventListener("focus", refreshOnFocus);
            document.removeEventListener("visibilitychange", refreshOnVisible);
        };
    }, [load]);

    const stats = useMemo(() => {
        const total = requests.length;
        const today = requests.filter((r) => isToday(r.created_at)).length;
        const dgPending = requests.filter((r) => stageKey(r.current_stage) === "DG" && !isClosed(r)).length;
        const hrFiling = requests.filter((r) => stageKey(r.current_stage) === "HRFILING" && !isClosed(r)).length;
        const account = requests.filter((r) => stageKey(r.current_stage) === "ACCOUNT" && !isClosed(r)).length;
        const hr = requests.filter((r) => stageKey(r.current_stage) === "HR" && !isClosed(r)).length;
        const completed = requests.filter(isCompleted).length;
        const rejected = requests.filter(isRejected).length;

        const official = requests.filter((r) => normalize(r.request_type) === "official").length;
        const personal = requests.filter((r) => normalize(r.request_type) === "personal").length;
        const personalFund = requests.filter(
            (r) => normalize(r.request_type) === "personal" && categoryKey(r.personal_category) === "FUND"
        ).length;
        const personalOther = requests.filter(
            (r) => normalize(r.request_type) === "personal" && categoryKey(r.personal_category) !== "FUND"
        ).length;

        return {
            total,
            today,
            dgPending,
            hrFiling,
            account,
            hr,
            completed,
            rejected,
            official,
            personal,
            personalFund,
            personalOther,
        };
    }, [requests]);

    const departmentMovements = useMemo<DepartmentMovement[]>(() => {
        return departments
            .map((dept) => {
                const rows = requests.filter((r) => r.dept_id === dept.id);

                return {
                    dept_id: dept.id,
                    dept_name: dept.name,
                    total: rows.length,
                    today: rows.filter((r) => isToday(r.created_at)).length,
                    po: rows.filter((r) => stageKey(r.current_stage) === "PO" && !isClosed(r)).length,
                    dod: rows.filter((r) => stageKey(r.current_stage) === "DOD" && !isClosed(r)).length,
                    dinAdmin: rows.filter((r) => stageKey(r.current_stage) === "DINADMIN" && !isClosed(r)).length,
                    registrar: rows.filter((r) => stageKey(r.current_stage) === "REGISTRAR" && !isClosed(r)).length,
                    hod: rows.filter((r) => stageKey(r.current_stage) === "HOD" && !isClosed(r)).length,
                    hr: rows.filter((r) => stageKey(r.current_stage) === "HR" && !isClosed(r)).length,
                    dg: rows.filter((r) => stageKey(r.current_stage) === "DG" && !isClosed(r)).length,
                    account: rows.filter((r) => stageKey(r.current_stage) === "ACCOUNT" && !isClosed(r)).length,
                    hrFiling: rows.filter((r) => stageKey(r.current_stage) === "HRFILING" && !isClosed(r)).length,
                    completed: rows.filter(isCompleted).length,
                    rejected: rows.filter(isRejected).length,
                };
            })
            .filter((row) => row.total > 0)
            .sort((a, b) => b.total - a.total || a.dept_name.localeCompare(b.dept_name));
    }, [departments, requests]);

    const filteredRows = useMemo(() => {
        const s = search.trim().toLowerCase();

        return requests.filter((r) => {
            if (deptFilter !== "ALL" && r.dept_id !== deptFilter) return false;

            if (stageFilter === "TODAY" && !isToday(r.created_at)) return false;
            if (stageFilter === "PO" && stageKey(r.current_stage) !== "PO") return false;
            if (stageFilter === "DOD" && stageKey(r.current_stage) !== "DOD") return false;
            if (stageFilter === "DINADMIN" && stageKey(r.current_stage) !== "DINADMIN") return false;
            if (stageFilter === "REGISTRAR" && stageKey(r.current_stage) !== "REGISTRAR") return false;
            if (stageFilter === "HOD" && stageKey(r.current_stage) !== "HOD") return false;
            if (stageFilter === "DG" && stageKey(r.current_stage) !== "DG") return false;
            if (stageFilter === "HRFILING" && stageKey(r.current_stage) !== "HRFILING") return false;
            if (stageFilter === "HR" && stageKey(r.current_stage) !== "HR") return false;
            if (stageFilter === "ACCOUNT" && stageKey(r.current_stage) !== "ACCOUNT") return false;
            if (stageFilter === "COMPLETED" && !isCompleted(r)) return false;
            if (stageFilter === "REJECTED" && !isRejected(r)) return false;

            if (s) {
                const ownerName = r.current_owner ? profileMap.get(r.current_owner)?.full_name || "" : "";
                const deptName = r.dept_id ? deptMap.get(r.dept_id) || "" : "";

                const haystack = [
                    r.request_no,
                    r.title,
                    r.details,
                    r.status,
                    r.current_stage,
                    r.requester_name,
                    ownerName,
                    deptName,
                    r.request_type,
                    r.personal_category,
                ]
                    .join(" ")
                    .toLowerCase();

                if (!haystack.includes(s)) return false;
            }

            return true;
        });
    }, [requests, search, stageFilter, deptFilter, profileMap, deptMap]);

    const dgPendingRows = useMemo(() => {
        return requests.filter((r) => stageKey(r.current_stage) === "DG" && !isClosed(r));
    }, [requests]);

    const todayRows = useMemo(() => {
        return requests.filter((r) => isToday(r.created_at));
    }, [requests]);

    const hrFilingRows = useMemo(() => {
        return requests.filter((r) => stageKey(r.current_stage) === "HRFILING" && !isClosed(r));
    }, [requests]);

    function openRequest(requestId: string) {
        router.push(`/requests/${requestId}?updated=${Date.now()}`);
        router.refresh();
    }

    function goDashboard() {
        router.push(`/dashboard?updated=${Date.now()}`);
        router.refresh();
    }

    async function copyText(text: string) {
        try {
            await navigator.clipboard.writeText(text);
            setCopyMsg("Copied reminder text successfully.");
        } catch {
            setCopyMsg("Could not copy automatically. Please select and copy manually.");
        }
    }

    function buildDGReminder() {
        const lines = dgPendingRows.slice(0, 12).map((r, index) => {
            const owner = r.current_owner ? profileMap.get(r.current_owner)?.full_name || "DG" : "DG";
            const dept = r.dept_id ? deptMap.get(r.dept_id) || "Unknown Department" : "Unknown Department";

            return `${index + 1}. ${r.request_no || "No Ref"} - ${r.title} (${requestTypeLabel(
                r
            )}, ${dept}) - Pending with ${owner}`;
        });

        if (lines.length === 0) {
            return "Assalamu Alaikum Sir. There is currently no request pending at DG stage on ReqGen.";
        }

        return `Assalamu Alaikum Sir.\n\nKind reminder: the following request(s) are pending at DG stage on ReqGen:\n\n${lines.join(
            "\n"
        )}\n\nKindly review when convenient.\n\nRegistry Desk`;
    }

    function buildDailySummary() {
        const lines = todayRows.slice(0, 15).map((r, index) => {
            const dept = r.dept_id ? deptMap.get(r.dept_id) || "Unknown Department" : "Unknown Department";

            return `${index + 1}. ${r.request_no || "No Ref"} - ${r.title} (${requestTypeLabel(
                r
            )}, ${dept}, Stage: ${stageLabel(r.current_stage)})`;
        });

        if (lines.length === 0) {
            return "Daily Registry Summary: No new request was submitted today on ReqGen.";
        }

        return `Daily Registry Summary\n\nNew request(s) submitted today:\n\n${lines.join(
            "\n"
        )}\n\nRegistry Desk`;
    }

    function buildHRFilingReminder() {
        const lines = hrFilingRows.slice(0, 12).map((r, index) => {
            const dept = r.dept_id ? deptMap.get(r.dept_id) || "Unknown Department" : "Unknown Department";

            return `${index + 1}. ${r.request_no || "No Ref"} - ${r.title} (${requestTypeLabel(
                r
            )}, ${dept})`;
        });

        if (lines.length === 0) {
            return "Assalamu Alaikum. There is currently no request waiting at HR Filing stage on ReqGen.";
        }

        return `Assalamu Alaikum.\n\nKind reminder: the following request(s) are currently waiting at HR Filing stage on ReqGen:\n\n${lines.join(
            "\n"
        )}\n\nRegistry Desk`;
    }

    if (loading) {
        return (
            <main className="min-h-screen bg-slate-50 px-4">
                <div className="mx-auto max-w-7xl py-10 text-slate-600">Loading Registry Desk...</div>
            </main>
        );
    }

    if (!canAccess) {
        return (
            <main className="min-h-screen bg-slate-50 px-4">
                <div className="mx-auto max-w-3xl py-10">
                    <div className="rounded-3xl border bg-white p-6 shadow-sm">
                        <h1 className="text-xl font-extrabold text-slate-900">Registry Desk Access</h1>

                        <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                            {msg || "Access denied."}
                        </div>

                        <button
                            type="button"
                            onClick={goDashboard}
                            className="mt-5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700"
                        >
                            Back to Dashboard
                        </button>
                    </div>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-slate-50 px-4">
            <div className="mx-auto max-w-7xl py-8">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
                            Registry Desk
                        </h1>
                        <p className="mt-2 text-sm text-slate-600">
                            Monitoring and reminder desk for request submissions. Registry does not approve or
                            reject requests.
                        </p>
                        <p className="mt-1 text-xs font-semibold text-slate-500">
                            Active capacity: <b className="text-slate-800">{roleSummary(myRole, myRoles)}</b>
                        </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={() => load({ silent: true })}
                            disabled={refreshing}
                            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-900 shadow-sm hover:bg-slate-100 disabled:opacity-60"
                        >
                            {refreshing ? "Refreshing..." : "Refresh"}
                        </button>

                        <button
                            type="button"
                            onClick={goDashboard}
                            disabled={refreshing}
                            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-900 shadow-sm hover:bg-slate-100 disabled:opacity-60"
                        >
                            Dashboard
                        </button>
                    </div>
                </div>

                {msg && (
                    <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 shadow-sm">
                        {msg}
                    </div>
                )}

                {copyMsg && (
                    <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
                        {copyMsg}
                    </div>
                )}

                <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs font-semibold text-blue-900">
                    Registry can monitor, summarize and remind. Approval actions remain with PO, DOD, DIN
                    Admin, Registrar, HOD, HR, DG and AccountOfficer.
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-3 xl:grid-cols-6">
                    <StatCard title="Total Loaded" value={String(stats.total)} tone="slate" />
                    <StatCard title="Submitted Today" value={String(stats.today)} tone="blue" />
                    <StatCard title="DG Pending" value={String(stats.dgPending)} tone="indigo" />
                    <StatCard title="HR Filing" value={String(stats.hrFiling)} tone="purple" />
                    <StatCard title="Account Stage" value={String(stats.account)} tone="amber" />
                    <StatCard title="Completed/Paid" value={String(stats.completed)} tone="emerald" />
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-3 xl:grid-cols-6">
                    <StatCard title="Official" value={String(stats.official)} tone="blue" />
                    <StatCard title="Personal" value={String(stats.personal)} tone="purple" />
                    <StatCard title="Personal Fund" value={String(stats.personalFund)} tone="indigo" />
                    <StatCard title="Personal Other" value={String(stats.personalOther)} tone="amber" />
                    <StatCard title="Initial HR" value={String(stats.hr)} tone="blue" />
                    <StatCard title="Rejected/Deleted" value={String(stats.rejected)} tone="red" />
                </div>

                <div className="mt-6 rounded-3xl border bg-white p-5 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                            <h2 className="text-lg font-extrabold text-slate-900">
                                Department Movement Summary
                            </h2>
                            <p className="mt-1 text-sm text-slate-600">
                                Registry overview of request movement by department and current workflow stage.
                            </p>
                        </div>

                        <span className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">
                            {departmentMovements.length} active department(s)
                        </span>
                    </div>

                    {departmentMovements.length === 0 ? (
                        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                            No department movement found yet.
                        </div>
                    ) : (
                        <div className="mt-4 overflow-x-auto">
                            <div className="min-w-[1180px] overflow-hidden rounded-2xl border">
                                <div className="grid grid-cols-[2fr_0.8fr_0.8fr_0.8fr_0.8fr_0.9fr_0.9fr_0.8fr_0.8fr_0.8fr_0.9fr_1fr_1fr] bg-slate-100 px-4 py-3 text-xs font-black uppercase tracking-wide text-slate-600">
                                    <div>Department</div>
                                    <div>Total</div>
                                    <div>Today</div>
                                    <div>PO</div>
                                    <div>DOD</div>
                                    <div>DIN Admin</div>
                                    <div>Registrar</div>
                                    <div>HOD</div>
                                    <div>HR</div>
                                    <div>DG</div>
                                    <div>Account</div>
                                    <div>HR Filing</div>
                                    <div>Completed</div>
                                </div>

                                {departmentMovements.map((row) => (
                                    <div
                                        key={row.dept_id}
                                        className="grid grid-cols-[2fr_0.8fr_0.8fr_0.8fr_0.8fr_0.9fr_0.9fr_0.8fr_0.8fr_0.8fr_0.9fr_1fr_1fr] items-center border-t px-4 py-3 text-sm hover:bg-slate-50"
                                    >
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setDeptFilter(row.dept_id);
                                                setStageFilter("ALL");
                                            }}
                                            className="text-left font-extrabold text-blue-700 hover:underline"
                                        >
                                            {row.dept_name}
                                        </button>

                                        <MovementNumber value={row.total} tone="slate" />
                                        <MovementNumber value={row.today} tone={row.today > 0 ? "blue" : "slate"} />
                                        <MovementNumber value={row.po} tone={row.po > 0 ? "red" : "slate"} />
                                        <MovementNumber value={row.dod} tone={row.dod > 0 ? "red" : "slate"} />
                                        <MovementNumber value={row.dinAdmin} tone={row.dinAdmin > 0 ? "red" : "slate"} />
                                        <MovementNumber value={row.registrar} tone={row.registrar > 0 ? "red" : "slate"} />
                                        <MovementNumber value={row.hod} tone={row.hod > 0 ? "red" : "slate"} />
                                        <MovementNumber value={row.hr} tone={row.hr > 0 ? "amber" : "slate"} />
                                        <MovementNumber value={row.dg} tone={row.dg > 0 ? "indigo" : "slate"} />
                                        <MovementNumber value={row.account} tone={row.account > 0 ? "amber" : "slate"} />
                                        <MovementNumber value={row.hrFiling} tone={row.hrFiling > 0 ? "purple" : "slate"} />
                                        <MovementNumber value={row.completed} tone={row.completed > 0 ? "emerald" : "slate"} />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className="mt-6 grid gap-4 lg:grid-cols-3">
                    <ReminderCard
                        title="DG Pending Reminder"
                        description="Copy a clean reminder for requests currently pending with DG."
                        buttonText="Copy DG Reminder"
                        onClick={() => copyText(buildDGReminder())}
                    />

                    <ReminderCard
                        title="Daily Submission Summary"
                        description="Copy today’s submissions summary for registry reporting."
                        buttonText="Copy Daily Summary"
                        onClick={() => copyText(buildDailySummary())}
                    />

                    <ReminderCard
                        title="HR Filing Reminder"
                        description="Copy a reminder for requests waiting at HR Filing."
                        buttonText="Copy HR Filing Reminder"
                        onClick={() => copyText(buildHRFilingReminder())}
                    />
                </div>

                <div className="mt-6 rounded-3xl border bg-white p-5 shadow-sm">
                    <div className="grid gap-4 md:grid-cols-3">
                        <div>
                            <label className="text-sm font-semibold text-slate-800">Search</label>
                            <input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search request no, title, requester, owner..."
                                className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-3 text-slate-900 outline-none focus:border-blue-500"
                            />
                        </div>

                        <div>
                            <label className="text-sm font-semibold text-slate-800">Department</label>
                            <select
                                value={deptFilter}
                                onChange={(e) => setDeptFilter(e.target.value)}
                                className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-3 text-slate-900 outline-none focus:border-blue-500"
                            >
                                <option value="ALL">All Departments</option>
                                {departments.map((d) => (
                                    <option key={d.id} value={d.id}>
                                        {d.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="text-sm font-semibold text-slate-800">Registry View</label>
                            <select
                                value={stageFilter}
                                onChange={(e) => setStageFilter(e.target.value as StageFilter)}
                                className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-3 text-slate-900 outline-none focus:border-blue-500"
                            >
                                <option value="ALL">All Requests</option>
                                <option value="TODAY">Submitted Today</option>
                                <option value="PO">PO Stage</option>
                                <option value="DOD">DOD Stage</option>
                                <option value="DINADMIN">DIN Admin Stage</option>
                                <option value="REGISTRAR">Registrar Stage</option>
                                <option value="HOD">HOD Stage</option>
                                <option value="DG">Pending at DG</option>
                                <option value="HR">Initial HR Review</option>
                                <option value="ACCOUNT">Account Stage</option>
                                <option value="HRFILING">HR Filing</option>
                                <option value="COMPLETED">Completed / Paid</option>
                                <option value="REJECTED">Rejected / Deleted</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div className="mt-6 grid gap-4 xl:hidden">
                    {filteredRows.length === 0 ? (
                        <EmptyState />
                    ) : (
                        filteredRows.map((r) => {
                            const owner = r.current_owner ? profileMap.get(r.current_owner)?.full_name || "—" : "—";
                            const dept = r.dept_id ? deptMap.get(r.dept_id) || "—" : "—";

                            return (
                                <div key={r.id} className="rounded-3xl border bg-white p-5 shadow-sm">
                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                        <div>
                                            <div className="text-lg font-extrabold text-slate-900">
                                                {r.request_no || "No Ref"}
                                            </div>
                                            <div className="mt-1 font-semibold text-slate-800">{r.title}</div>
                                            <div className="mt-1 text-sm text-slate-500">{dept}</div>
                                        </div>

                                        <div className="flex flex-col items-end gap-1">
                                            <span className={`rounded-full border px-3 py-1 text-xs font-bold ${typeBadgeClass(r)}`}>
                                                {requestTypeLabel(r)}
                                            </span>

                                            <span
                                                className={`rounded-full border px-3 py-1 text-xs font-bold ${stageBadgeClass(
                                                    r.current_stage,
                                                    r.status
                                                )}`}
                                            >
                                                {stageLabel(r.current_stage)}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                                        <InfoLine label="Requester" value={r.requester_name || "—"} />
                                        <InfoLine label="Current Owner" value={owner} />
                                        <InfoLine label="Amount" value={amountLabel(r)} />
                                        <InfoLine label="Status" value={r.status || "—"} />
                                        <InfoLine label="Submitted" value={shortDateTime(r.created_at)} />
                                        <InfoLine label="AccountOfficer" value={r.assigned_account_officer_name || "—"} />
                                    </div>

                                    <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
                                        <div className="font-semibold text-slate-900">Details</div>
                                        <div className="mt-1 line-clamp-3 whitespace-pre-wrap">
                                            {r.details || "No details"}
                                        </div>
                                    </div>

                                    <div className="mt-4 flex justify-end">
                                        <button
                                            type="button"
                                            onClick={() => openRequest(r.id)}
                                            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700"
                                        >
                                            View Request
                                        </button>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                <div className="mt-6 hidden overflow-hidden rounded-3xl border bg-white shadow-sm xl:block">
                    <div className="border-b bg-slate-50 px-6 py-4">
                        <h2 className="text-lg font-bold text-slate-900">Registry Monitoring Register</h2>
                        <p className="mt-1 text-sm text-slate-600">
                            Read-only register for submissions, pending DG items and HR filing follow-up.
                        </p>
                    </div>

                    {filteredRows.length === 0 ? (
                        <EmptyState />
                    ) : (
                        <div className="overflow-x-auto">
                            <div className="min-w-[1320px]">
                                <div className="grid grid-cols-[1.1fr_2fr_1.35fr_1fr_1fr_1fr_1.35fr_1.35fr_0.95fr_1fr] bg-slate-100 px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
                                    <div>Request No</div>
                                    <div>Title</div>
                                    <div>Department</div>
                                    <div>Type</div>
                                    <div>Amount</div>
                                    <div>Stage</div>
                                    <div>Requester</div>
                                    <div>Current Owner</div>
                                    <div>Date</div>
                                    <div className="text-right">Action</div>
                                </div>

                                {filteredRows.map((r) => {
                                    const owner = r.current_owner ? profileMap.get(r.current_owner)?.full_name || "—" : "—";
                                    const dept = r.dept_id ? deptMap.get(r.dept_id) || "—" : "—";

                                    return (
                                        <div
                                            key={r.id}
                                            className="grid grid-cols-[1.1fr_2fr_1.35fr_1fr_1fr_1fr_1.35fr_1.35fr_0.95fr_1fr] items-center border-t px-6 py-4 text-sm hover:bg-slate-50"
                                        >
                                            <div className="font-extrabold text-slate-900">
                                                {r.request_no || "No Ref"}
                                            </div>

                                            <div>
                                                <div className="font-semibold text-slate-900">{r.title}</div>
                                                <div className="mt-1 line-clamp-1 text-xs text-slate-500">
                                                    {r.details || "No details"}
                                                </div>
                                            </div>

                                            <div className="text-slate-700">{dept}</div>

                                            <div>
                                                <span className={`rounded-full border px-2 py-1 text-[11px] font-bold ${typeBadgeClass(r)}`}>
                                                    {requestTypeLabel(r)}
                                                </span>
                                            </div>

                                            <div className="font-semibold text-slate-900">{amountLabel(r)}</div>

                                            <div>
                                                <span
                                                    className={`rounded-full border px-2 py-1 text-[11px] font-bold ${stageBadgeClass(
                                                        r.current_stage,
                                                        r.status
                                                    )}`}
                                                >
                                                    {stageLabel(r.current_stage)}
                                                </span>
                                            </div>

                                            <div className="text-slate-700">{r.requester_name || "—"}</div>

                                            <div className="text-slate-700">{owner}</div>

                                            <div className="text-slate-600">{shortDate(r.created_at)}</div>

                                            <div className="flex justify-end">
                                                <button
                                                    type="button"
                                                    onClick={() => openRequest(r.id)}
                                                    className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-700"
                                                >
                                                    View
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                <div className="mt-6 rounded-3xl border border-blue-100 bg-blue-50 p-5 text-sm text-blue-900">
                    <div className="font-bold">Registry Desk Note</div>
                    <p className="mt-1">
                        This page is intentionally read-only. Registry monitors submissions, prepares daily
                        summaries, reminds DG/HR when necessary, and supports administrative follow-up without
                        approving, rejecting, editing or paying requests.
                    </p>
                </div>
            </div>
        </main>
    );
}

function StatCard({
    title,
    value,
    tone,
}: {
    title: string;
    value: string;
    tone: "blue" | "emerald" | "purple" | "slate" | "amber" | "red" | "indigo";
}) {
    const cls =
        tone === "emerald"
            ? "bg-emerald-50 text-emerald-700"
            : tone === "purple"
                ? "bg-purple-50 text-purple-700"
                : tone === "amber"
                    ? "bg-amber-50 text-amber-700"
                    : tone === "red"
                        ? "bg-red-50 text-red-700"
                        : tone === "indigo"
                            ? "bg-indigo-50 text-indigo-700"
                            : tone === "slate"
                                ? "bg-slate-50 text-slate-700"
                                : "bg-blue-50 text-blue-700";

    return (
        <div className="rounded-3xl border bg-white p-5 shadow-sm">
            <div className="text-sm font-semibold text-slate-500">{title}</div>
            <div className={`mt-3 inline-flex rounded-2xl px-3 py-2 text-2xl font-extrabold ${cls}`}>
                {value}
            </div>
        </div>
    );
}

function ReminderCard({
    title,
    description,
    buttonText,
    onClick,
}: {
    title: string;
    description: string;
    buttonText: string;
    onClick: () => void;
}) {
    return (
        <div className="rounded-3xl border bg-white p-5 shadow-sm">
            <div className="text-lg font-extrabold text-slate-900">{title}</div>
            <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
            <button
                type="button"
                onClick={onClick}
                className="mt-4 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700"
            >
                {buttonText}
            </button>
        </div>
    );
}

function InfoLine({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <span className="text-slate-500">{label}:</span>{" "}
            <b className="text-slate-900">{value}</b>
        </div>
    );
}

function EmptyState() {
    return (
        <div className="rounded-2xl border bg-white p-6 text-sm text-slate-700 shadow-sm xl:rounded-none xl:border-0 xl:shadow-none">
            No request found for the selected filter.
        </div>
    );
}

function MovementNumber({
    value,
    tone,
}: {
    value: number;
    tone: "blue" | "emerald" | "purple" | "slate" | "amber" | "red" | "indigo";
}) {
    const cls =
        tone === "emerald"
            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
            : tone === "purple"
                ? "border-purple-200 bg-purple-50 text-purple-700"
                : tone === "amber"
                    ? "border-amber-200 bg-amber-50 text-amber-800"
                    : tone === "red"
                        ? "border-red-200 bg-red-50 text-red-700"
                        : tone === "indigo"
                            ? "border-indigo-200 bg-indigo-50 text-indigo-700"
                            : tone === "blue"
                                ? "border-blue-200 bg-blue-50 text-blue-700"
                                : "border-slate-200 bg-slate-50 text-slate-700";

    return (
        <span className={`inline-flex w-fit rounded-full border px-2.5 py-1 text-xs font-black ${cls}`}>
            {value}
        </span>
    );
}