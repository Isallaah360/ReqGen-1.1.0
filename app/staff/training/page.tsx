"use client";

import Link from "next/link";
import StaffNavigation from "@/app/components/staff/StaffNavigation";
import {
    ArrowLeft,
    Award,
    BookOpen,
    CalendarDays,
    Download,
    GraduationCap,
    Printer,
    Clock3,
    CheckCircle2,
} from "lucide-react";

const summary = [
    {
        title: "Completed",
        value: "12",
        color: "from-emerald-600 to-green-700",
        icon: CheckCircle2,
    },
    {
        title: "Upcoming",
        value: "3",
        color: "from-cyan-600 to-blue-700",
        icon: CalendarDays,
    },
    {
        title: "Certificates",
        value: "10",
        color: "from-purple-600 to-fuchsia-700",
        icon: Award,
    },
    {
        title: "Learning Hours",
        value: "186",
        color: "from-amber-500 to-orange-600",
        icon: Clock3,
    },
];

const programmes = [
    {
        title: "Wednesday Weekly Seminar",
        provider: "Islamic Education Trust",
        status: "Completed",
        date: "Every Wednesday",
    },
    {
        title: "Leadership & Administration",
        provider: "IET HR Directorate",
        status: "Upcoming",
        date: "15 Aug 2026",
    },
    {
        title: "Financial Compliance",
        provider: "Finance Directorate",
        status: "Completed",
        date: "18 Jul 2026",
    },
];

export default function TrainingPage() {
    return (
        <div className="space-y-8">

            {/* HERO */}

            <section className="rounded-3xl bg-gradient-to-r from-slate-900 via-violet-900 to-cyan-900 p-8 shadow-xl">

                <div className="flex flex-col lg:flex-row justify-between gap-8">

                    <div>

                        <p className="uppercase tracking-[0.35em] text-cyan-300 font-bold">
                            Capacity Building
                        </p>

                        <h1 className="text-5xl font-black text-white mt-2">
                            My Training
                        </h1>

                        <p className="mt-4 text-white/90 max-w-2xl">
                            View completed courses, upcoming programmes,
                            certificates and your professional development.
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

                        <button type="button" onClick={() => window.print()} className="px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-2">
                            <Printer size={18} />
                            Print
                        </button>

                    </div>

                </div>

            </section>

            <StaffNavigation />

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

            {/* CERTIFICATES */}

            <section className="rounded-2xl bg-white dark:bg-slate-900 shadow-lg p-6">

                <div className="flex justify-between items-center">

                    <div>

                        <h2 className="text-2xl font-black flex items-center gap-2">
                            <Award className="text-cyan-600" />
                            Certificates
                        </h2>

                        <p className="text-slate-500 mt-2">
                            Download your completed training certificates.
                        </p>

                    </div>

                    <button className="rounded-xl bg-cyan-700 hover:bg-cyan-800 text-white font-bold px-5 py-3 flex items-center gap-2">
                        <Download size={18} />
                        Download All
                    </button>

                </div>

            </section>

            {/* TRAINING LIST */}

            <section className="rounded-2xl bg-white dark:bg-slate-900 shadow-lg overflow-hidden">

                <div className="p-6 border-b">

                    <h2 className="text-2xl font-black flex items-center gap-2">
                        <BookOpen className="text-cyan-600" />
                        Training History
                    </h2>

                </div>

                <div className="overflow-auto">

                    <table className="w-full">

                        <thead className="bg-slate-100 dark:bg-slate-800">

                            <tr>

                                <th className="text-left p-4">Programme</th>
                                <th className="text-left p-4">Provider</th>
                                <th className="text-left p-4">Date</th>
                                <th className="text-left p-4">Status</th>

                            </tr>

                        </thead>

                        <tbody>

                            {programmes.map((item) => (

                                <tr
                                    key={item.title}
                                    className="border-b hover:bg-slate-50 dark:hover:bg-slate-800"
                                >

                                    <td className="p-4 font-semibold">
                                        {item.title}
                                    </td>

                                    <td className="p-4">
                                        {item.provider}
                                    </td>

                                    <td className="p-4">
                                        {item.date}
                                    </td>

                                    <td className="p-4">

                                        <span
                                            className={`rounded-full px-3 py-1 font-bold ${item.status === "Completed"
                                                    ? "bg-emerald-100 text-emerald-700"
                                                    : "bg-cyan-100 text-cyan-700"
                                                }`}
                                        >
                                            {item.status}
                                        </span>

                                    </td>

                                </tr>

                            ))}

                        </tbody>

                    </table>

                </div>

            </section>

            {/* WEDNESDAY SEMINAR */}

            <section className="rounded-2xl bg-gradient-to-r from-cyan-700 to-sky-700 p-6 text-white shadow-lg">

                <div className="flex items-center gap-3">

                    <GraduationCap size={34} />

                    <div>

                        <h2 className="text-2xl font-black">
                            Wednesday Weekly Seminar
                        </h2>

                        <p className="text-white/90">
                            Attendance, participation and seminar history
                            are automatically synchronized with your Staff Workspace.
                        </p>

                    </div>

                </div>

            </section>

        </div>
    );
}