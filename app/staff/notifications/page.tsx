"use client";

import Link from "next/link";
import StaffNavigation from "@/app/components/staff/StaffNavigation";
import {
    ArrowLeft,
    Bell,
    BellRing,
    Check,
    CheckCheck,
    Clock3,
    Filter,
    RefreshCw,
    Search,
    ShieldCheck,
    Printer,
} from "lucide-react";
import { useMemo, useState } from "react";

type Notification = {
    id: number;
    title: string;
    message: string;
    category: "Request" | "Leave" | "Training" | "Attendance" | "System";
    priority: "High" | "Normal" | "Low";
    status: "Unread" | "Read";
    date: string;
    href: string;
};

const sample: Notification[] = [
    {
        id: 1,
        title: "Official Request Approved",
        message: "DG has approved your Official Request.",
        category: "Request",
        priority: "High",
        status: "Unread",
        date: "04 Aug 2026, 9:14 AM",
        href: "/requests",
    },
    {
        id: 2,
        title: "Leave Application",
        message: "Your leave application has been forwarded.",
        category: "Leave",
        priority: "Normal",
        status: "Unread",
        date: "03 Aug 2026, 3:08 PM",
        href: "/staff/leave",
    },
    {
        id: 3,
        title: "Wednesday Seminar",
        message: "Attendance successfully recorded.",
        category: "Training",
        priority: "Low",
        status: "Read",
        date: "29 Jul 2026",
        href: "/staff/training",
    },
];

export default function StaffNotificationsPage() {
    const [notifications, setNotifications] = useState(sample);
    const [filter, setFilter] = useState<"All" | "Unread" | "Read">("All");
    const [search, setSearch] = useState("");

    const filtered = useMemo(() => {
        return notifications.filter((n) => {
            const matchesFilter =
                filter === "All" ? true : n.status === filter;

            const q = search.toLowerCase();

            const matchesSearch =
                n.title.toLowerCase().includes(q) ||
                n.message.toLowerCase().includes(q);

            return matchesFilter && matchesSearch;
        });
    }, [notifications, filter, search]);

    function markAllRead() {
        setNotifications((prev) =>
            prev.map((n) => ({ ...n, status: "Read" }))
        );
    }

    function markRead(id: number) {
        setNotifications((prev) =>
            prev.map((n) =>
                n.id === id ? { ...n, status: "Read" } : n
            )
        );
    }

    return (
        <div className="rg-module-page rg-adopted-page space-y-4">

            {/* HERO */}

            <section className="rg-module-header">

                <div className="flex flex-col lg:flex-row justify-between gap-8">

                    <div>

                        <p className="uppercase tracking-[0.35em] text-cyan-300 font-bold">
                            Notification Centre
                        </p>

                        <h1 className="text-5xl font-black text-white mt-2">
                            My Notifications
                        </h1>

                        <p className="mt-4 text-white/90 max-w-2xl">
                            View workflow updates, approvals,
                            HR notices and enterprise alerts.
                        </p>

                    </div>

                    <div className="flex gap-3 self-start">

                        <Link
                            href="/staff"
                            className="rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold px-5 py-3 flex items-center gap-2"
                        >
                            <ArrowLeft size={18} />
                            Staff Workspace
                        </Link>

                        <button type="button" onClick={() => window.print()}
                            className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-5 py-3 flex items-center gap-2"
                        >
                            <Printer size={18} />
                            Print
                        </button>

                    </div>

                </div>

            </section>

            <StaffNavigation />

            {/* KPI */}

            <section className="grid md:grid-cols-4 gap-5">

                <Stat
                    icon={BellRing}
                    title="Unread"
                    value={notifications.filter(x => x.status === "Unread").length.toString()}
                    color="from-red-600 to-rose-700"
                />

                <Stat
                    icon={Bell}
                    title="Total"
                    value={notifications.length.toString()}
                    color="from-cyan-600 to-blue-700"
                />

                <Stat
                    icon={Clock3}
                    title="Today"
                    value="2"
                    color="from-amber-500 to-orange-600"
                />

                <Stat
                    icon={ShieldCheck}
                    title="System"
                    value="1"
                    color="from-emerald-600 to-green-700"
                />

            </section>

            {/* TOOLBAR */}

            <section className="rounded-2xl bg-white dark:bg-slate-900 shadow-lg p-5">

                <div className="flex flex-col lg:flex-row gap-4 justify-between">

                    <div className="flex gap-3">

                        {["All", "Unread", "Read"].map((item) => (
                            <button
                                key={item}
                                onClick={() => setFilter(item as any)}
                                className={`rounded-full px-5 py-2 font-bold ${filter === item
                                        ? "bg-cyan-700 text-white"
                                        : "bg-slate-100 dark:bg-slate-800"
                                    }`}
                            >
                                {item}
                            </button>
                        ))}

                    </div>

                    <div className="flex gap-3">

                        <div className="relative">

                            <Search
                                size={18}
                                className="absolute left-3 top-3 text-slate-500"
                            />

                            <input
                                className="pl-10 rounded-xl border px-4 py-2"
                                placeholder="Search notifications..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />

                        </div>

                        <button
                            onClick={markAllRead}
                            className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-4 font-bold flex items-center gap-2"
                        >
                            <CheckCheck size={18} />
                            Mark All Read
                        </button>

                        <button
                            className="rounded-xl bg-cyan-700 hover:bg-cyan-800 text-white px-4"
                        >
                            <RefreshCw size={18} />
                        </button>

                    </div>

                </div>

            </section>

            {/* LIST */}

            <section className="rounded-2xl bg-white dark:bg-slate-900 shadow-lg divide-y">

                {filtered.map((n) => (

                    <div
                        key={n.id}
                        className="p-6 hover:bg-slate-50 dark:hover:bg-slate-800"
                    >

                        <div className="flex justify-between gap-5">

                            <div className="space-y-3">

                                <div className="flex flex-wrap gap-2">

                                    <span className="rounded-full bg-cyan-100 text-cyan-700 px-3 py-1 text-sm font-bold">
                                        {n.category}
                                    </span>

                                    <span className={`rounded-full px-3 py-1 text-sm font-bold ${n.priority === "High"
                                            ? "bg-red-100 text-red-700"
                                            : n.priority === "Normal"
                                                ? "bg-amber-100 text-amber-700"
                                                : "bg-slate-100 text-slate-700"
                                        }`}>
                                        {n.priority}
                                    </span>

                                </div>

                                <h3 className="text-xl font-black">
                                    {n.title}
                                </h3>

                                <p className="text-slate-500">
                                    {n.message}
                                </p>

                                <p className="text-sm text-slate-400">
                                    {n.date}
                                </p>

                            </div>

                            <div className="flex flex-col gap-3">

                                <Link
                                    href={n.href}
                                    className="rounded-xl bg-cyan-700 hover:bg-cyan-800 text-white px-5 py-2 font-bold text-center"
                                >
                                    Open
                                </Link>

                                {n.status === "Unread" && (

                                    <button
                                        onClick={() => markRead(n.id)}
                                        className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 font-bold flex items-center gap-2"
                                    >
                                        <Check size={18} />
                                        Read
                                    </button>

                                )}

                            </div>

                        </div>

                    </div>

                ))}

            </section>

        </div>
    );
}

function Stat({
    title,
    value,
    color,
    icon: Icon,
}: {
    title: string;
    value: string;
    color: string;
    icon: any;
}) {

    return (

        <div className={`rounded-2xl bg-gradient-to-br ${color} p-5 shadow-lg text-white`}>

            <div className="flex justify-between">

                <div>

                    <p className="font-semibold">
                        {title}
                    </p>

                    <h2 className="text-4xl font-black mt-3">
                        {value}
                    </h2>

                </div>

                <Icon size={34} />

            </div>

        </div>

    );

}