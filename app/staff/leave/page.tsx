"use client";

import Link from "next/link";
import {
    ArrowLeft,
    CalendarClock,
    CalendarDays,
    Clock3,
    PlaneTakeoff,
    Printer,
    CheckCircle2,
    XCircle,
    Hourglass,
    PlusCircle,
} from "lucide-react";

const summary = [
    {
        title: "Annual Balance",
        value: "18 Days",
        color: "from-emerald-600 to-green-700",
        icon: CalendarDays,
    },
    {
        title: "Pending",
        value: "1",
        color: "from-amber-500 to-orange-600",
        icon: Hourglass,
    },
    {
        title: "Approved",
        value: "4",
        color: "from-cyan-600 to-blue-700",
        icon: CheckCircle2,
    },
    {
        title: "Rejected",
        value: "0",
        color: "from-red-600 to-rose-700",
        icon: XCircle,
    },
];

const history = [
    {
        type: "Annual Leave",
        period: "01 Aug 2026 - 14 Aug 2026",
        days: 14,
        status: "Approved",
    },
    {
        type: "Casual Leave",
        period: "18 Jun 2026",
        days: 1,
        status: "Approved",
    },
    {
        type: "Study Leave",
        period: "12 May 2026 - 15 May 2026",
        days: 4,
        status: "Pending",
    },
];

export default function LeavePage() {
    return (
        <div className="space-y-8">

            {/* HERO */}

            <section className="rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-900 to-cyan-900 p-8 shadow-xl">

                <div className="flex flex-col lg:flex-row justify-between gap-8">

                    <div>

                        <p className="uppercase tracking-[0.35em] text-cyan-300 font-bold">
                            Leave Management
                        </p>

                        <h1 className="text-5xl font-black text-white mt-2">
                            My Leave
                        </h1>

                        <p className="mt-4 text-white/90 max-w-2xl">
                            View your leave balance, applications,
                            approvals and complete leave history.
                        </p>

                    </div>

                    <div className="flex gap-3 self-start">

                        <Link
                            href="/staff"
                            className="px-5 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold flex items-center gap-2"
                        >
                            <ArrowLeft size={18} />
                            Staff Workspace
                        </Link>

                        <button className="px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-2">
                            <Printer size={18} />
                            Print
                        </button>

                    </div>

                </div>

            </section>

            {/* SUMMARY */}

            <section className="grid md:grid-cols-2 xl:grid-cols-4 gap-5">

                {summary.map((item) => {

                    const Icon = item.icon;

                    return (

                        <div
                            key={item.title}
                            className={`rounded-2xl bg-gradient-to-br ${item.color} p-5 shadow-lg text-white`}
                        >

                            <div className="flex justify-between">

                                <div>

                                    <p className="font-semibold">
                                        {item.title}
                                    </p>

                                    <h2 className="text-4xl font-black mt-3">
                                        {item.value}
                                    </h2>

                                </div>

                                <Icon size={34} />

                            </div>

                        </div>

                    );

                })}

            </section>

            {/* QUICK ACTION */}

            <section className="rounded-2xl bg-white dark:bg-slate-900 shadow-lg p-6">

                <div className="flex justify-between items-center">

                    <div>

                        <h2 className="text-2xl font-black">
                            Leave Centre
                        </h2>

                        <p className="text-slate-500 mt-2">
                            Submit and monitor your leave applications.
                        </p>

                    </div>

                    <Link
                        href="/leave/new"
                        className="rounded-xl bg-cyan-700 hover:bg-cyan-800 text-white font-bold px-5 py-3 flex items-center gap-2"
                    >
                        <PlusCircle size={18} />
                        Apply Leave
                    </Link>

                </div>

            </section>

            {/* CALENDAR */}

            <section className="grid lg:grid-cols-3 gap-5">

                <div className="rounded-2xl bg-white dark:bg-slate-900 shadow-lg p-6">

                    <div className="flex items-center gap-3">

                        <CalendarClock className="text-cyan-600" />

                        <h2 className="text-xl font-black">
                            Current Leave
                        </h2>

                    </div>

                    <h3 className="text-4xl font-black text-cyan-700 mt-8">
                        None
                    </h3>

                </div>

                <div className="rounded-2xl bg-white dark:bg-slate-900 shadow-lg p-6">

                    <div className="flex items-center gap-3">

                        <Clock3 className="text-amber-500" />

                        <h2 className="text-xl font-black">
                            Next Eligibility
                        </h2>

                    </div>

                    <p className="mt-8 text-3xl font-black">
                        Jan 2027
                    </p>

                </div>

                <div className="rounded-2xl bg-white dark:bg-slate-900 shadow-lg p-6">

                    <div className="flex items-center gap-3">

                        <PlaneTakeoff className="text-emerald-600" />

                        <h2 className="text-xl font-black">
                            Last Leave
                        </h2>

                    </div>

                    <p className="mt-8 text-3xl font-black">
                        Aug 2026
                    </p>

                </div>

            </section>

            {/* HISTORY */}

            <section className="rounded-2xl bg-white dark:bg-slate-900 shadow-lg overflow-hidden">

                <div className="p-6 border-b">

                    <h2 className="text-2xl font-black">
                        Leave History
                    </h2>

                </div>

                <div className="overflow-auto">

                    <table className="w-full">

                        <thead className="bg-slate-100 dark:bg-slate-800">

                            <tr>

                                <th className="text-left p-4">Leave Type</th>
                                <th className="text-left p-4">Period</th>
                                <th className="text-left p-4">Days</th>
                                <th className="text-left p-4">Status</th>

                            </tr>

                        </thead>

                        <tbody>

                            {history.map((row) => (
                                <tr
                                    key={row.period}
                                    className="border-b hover:bg-slate-50 dark:hover:bg-slate-800"
                                >

                                    <td className="p-4">{row.type}</td>

                                    <td className="p-4">{row.period}</td>

                                    <td className="p-4">{row.days}</td>

                                    <td className="p-4">

                                        <span
                                            className={`rounded-full px-3 py-1 font-bold ${row.status === "Approved"
                                                    ? "bg-emerald-100 text-emerald-700"
                                                    : "bg-amber-100 text-amber-700"
                                                }`}
                                        >
                                            {row.status}
                                        </span>

                                    </td>

                                </tr>
                            ))}

                        </tbody>

                    </table>

                </div>

            </section>

        </div>
    );
}