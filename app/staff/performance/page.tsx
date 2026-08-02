"use client";

import Link from "next/link";
import {
    ArrowLeft,
    Award,
    BarChart3,
    ClipboardCheck,
    GraduationCap,
    Printer,
    Star,
    Target,
    TrendingUp,
    UserCheck,
} from "lucide-react";

const stats = [
    {
        title: "Performance Score",
        value: "92%",
        color: "from-cyan-600 to-blue-700",
        icon: TrendingUp,
    },
    {
        title: "Completed Tasks",
        value: "146",
        color: "from-emerald-600 to-green-700",
        icon: ClipboardCheck,
    },
    {
        title: "Training Score",
        value: "88%",
        color: "from-violet-600 to-fuchsia-700",
        icon: GraduationCap,
    },
    {
        title: "Attendance",
        value: "96%",
        color: "from-amber-500 to-orange-600",
        icon: UserCheck,
    },
];

const achievements = [
    {
        title: "Outstanding Attendance",
        period: "July 2026",
        status: "Excellent",
    },
    {
        title: "Leadership Training",
        period: "June 2026",
        status: "Completed",
    },
    {
        title: "Request Processing",
        period: "Q2 2026",
        status: "Excellent",
    },
];

export default function PerformancePage() {
    return (
        <div className="space-y-8">

            {/* HERO */}

            <section className="rounded-3xl bg-gradient-to-r from-slate-900 via-blue-900 to-cyan-900 p-8 shadow-xl">

                <div className="flex flex-col lg:flex-row justify-between gap-8">

                    <div>

                        <p className="uppercase tracking-[0.35em] text-cyan-300 font-bold">
                            Performance Centre
                        </p>

                        <h1 className="text-5xl font-black text-white mt-2">
                            My Performance
                        </h1>

                        <p className="text-white/90 mt-4 max-w-2xl">
                            Monitor your achievements, KPIs, completed work,
                            attendance contribution and professional growth.
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

            {/* KPI CARDS */}

            <section className="grid md:grid-cols-2 xl:grid-cols-4 gap-5">

                {stats.map((item) => {

                    const Icon = item.icon;

                    return (

                        <div
                            key={item.title}
                            className={`rounded-2xl bg-gradient-to-br ${item.color} p-5 text-white shadow-lg`}
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

            {/* PERFORMANCE SUMMARY */}

            <section className="grid lg:grid-cols-3 gap-5">

                <div className="rounded-2xl bg-white dark:bg-slate-900 shadow-lg p-6">

                    <div className="flex items-center gap-3">

                        <Target className="text-cyan-600" />

                        <h2 className="text-xl font-black">
                            KPI Achievement
                        </h2>

                    </div>

                    <h3 className="mt-8 text-5xl font-black text-cyan-700">
                        92%
                    </h3>

                    <p className="mt-3 text-slate-500">
                        Excellent performance against assigned KPIs.
                    </p>

                </div>

                <div className="rounded-2xl bg-white dark:bg-slate-900 shadow-lg p-6">

                    <div className="flex items-center gap-3">

                        <BarChart3 className="text-emerald-600" />

                        <h2 className="text-xl font-black">
                            Department Rank
                        </h2>

                    </div>

                    <h3 className="mt-8 text-5xl font-black text-emerald-700">
                        #2
                    </h3>

                    <p className="mt-3 text-slate-500">
                        Based on departmental performance metrics.
                    </p>

                </div>

                <div className="rounded-2xl bg-white dark:bg-slate-900 shadow-lg p-6">

                    <div className="flex items-center gap-3">

                        <Award className="text-amber-600" />

                        <h2 className="text-xl font-black">
                            Achievement Level
                        </h2>

                    </div>

                    <div className="mt-8 flex items-center gap-2">

                        <Star className="text-yellow-500 fill-yellow-500" />

                        <Star className="text-yellow-500 fill-yellow-500" />

                        <Star className="text-yellow-500 fill-yellow-500" />

                        <Star className="text-yellow-500 fill-yellow-500" />

                        <Star className="text-yellow-500 fill-yellow-500" />

                    </div>

                    <p className="mt-4 font-bold text-emerald-700">
                        Outstanding
                    </p>

                </div>

            </section>

            {/* ACHIEVEMENTS */}

            <section className="rounded-2xl bg-white dark:bg-slate-900 shadow-lg overflow-hidden">

                <div className="border-b p-6">

                    <h2 className="text-2xl font-black">
                        Achievement Timeline
                    </h2>

                </div>

                <div className="divide-y">

                    {achievements.map((item) => (

                        <div
                            key={item.title}
                            className="flex justify-between items-center p-6 hover:bg-slate-50 dark:hover:bg-slate-800"
                        >

                            <div>

                                <h3 className="font-bold">
                                    {item.title}
                                </h3>

                                <p className="text-slate-500">
                                    {item.period}
                                </p>

                            </div>

                            <span className="rounded-full bg-emerald-100 text-emerald-700 px-4 py-2 font-bold">
                                {item.status}
                            </span>

                        </div>

                    ))}

                </div>

            </section>

            {/* SUPERVISOR REMARK */}

            <section className="rounded-2xl bg-gradient-to-r from-cyan-700 to-blue-700 p-6 text-white shadow-lg">

                <h2 className="text-2xl font-black">
                    Supervisor Remarks
                </h2>

                <p className="mt-4 text-white/90 leading-7">
                    Continue demonstrating excellent commitment to
                    institutional responsibilities. Maintain punctuality,
                    teamwork and continuous professional development.
                </p>

            </section>

        </div>
    );
}