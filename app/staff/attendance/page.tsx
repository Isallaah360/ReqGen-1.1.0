"use client";

import Link from "next/link";
import StaffNavigation from "@/app/components/staff/StaffNavigation";
import {
    CalendarDays,
    Clock3,
    ArrowLeft,
    CheckCircle2,
    XCircle,
    AlertTriangle,
    TimerReset,
    Printer,
    TrendingUp,
} from "lucide-react";

const summary = [
    {
        title: "Present",
        value: "22",
        color: "bg-emerald-600",
        icon: CheckCircle2,
    },
    {
        title: "Late",
        value: "2",
        color: "bg-amber-500",
        icon: AlertTriangle,
    },
    {
        title: "Absent",
        value: "1",
        color: "bg-red-600",
        icon: XCircle,
    },
    {
        title: "Attendance",
        value: "96%",
        color: "bg-cyan-700",
        icon: TrendingUp,
    },
];

const attendance = [
    {
        date: "04 Aug 2026",
        status: "Present",
        checkIn: "8:03 AM",
        checkOut: "4:15 PM",
        remarks: "On Time",
    },
    {
        date: "03 Aug 2026",
        status: "Present",
        checkIn: "8:01 AM",
        checkOut: "4:07 PM",
        remarks: "On Time",
    },
    {
        date: "31 Jul 2026",
        status: "Late",
        checkIn: "8:34 AM",
        checkOut: "4:03 PM",
        remarks: "Traffic",
    },
    {
        date: "30 Jul 2026",
        status: "Present",
        checkIn: "7:57 AM",
        checkOut: "4:18 PM",
        remarks: "Excellent",
    },
];

export default function AttendancePage() {
    return (
        <div className="rg-module-page rg-adopted-page space-y-4">

            {/* HERO */}

            <section className="rg-module-header">

                <div className="flex flex-col lg:flex-row justify-between gap-8">

                    <div>

                        <p className="uppercase tracking-[0.35em] text-cyan-300 font-bold">
                            Attendance & Time Management
                        </p>

                        <h1 className="text-5xl font-black text-white mt-2">
                            My Attendance
                        </h1>

                        <p className="text-white/90 mt-4 max-w-2xl">
                            Monitor your attendance history,
                            punctuality and overall attendance performance.
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

                        <button type="button" onClick={() => window.print()}
                            className="px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-2"
                        >
                            <Printer size={18} />
                            Print
                        </button>

                    </div>

                </div>

            </section>

            <StaffNavigation />

            {/* SUMMARY */}

            <section className="grid md:grid-cols-2 xl:grid-cols-4 gap-5">

                {summary.map((card) => {

                    const Icon = card.icon;

                    return (

                        <div
                            key={card.title}
                            className="rg-stat-card"
                        >

                            <div className="flex justify-between">

                                <div>

                                    <p className="font-semibold opacity-90">
                                        {card.title}
                                    </p>

                                    <h2 className="text-4xl font-black mt-3">
                                        {card.value}
                                    </h2>

                                </div>

                                <Icon size={34} />

                            </div>

                        </div>

                    );

                })}

            </section>

            {/* WEEK */}

            <section className="grid lg:grid-cols-3 gap-5">

                <div className="rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-lg">

                    <div className="flex items-center gap-3">

                        <CalendarDays className="text-cyan-600" />

                        <h2 className="text-xl font-black">
                            Current Week
                        </h2>

                    </div>

                    <div className="mt-6 space-y-3">

                        <div className="flex justify-between">
                            <span>Present</span>
                            <span className="font-bold">5 Days</span>
                        </div>

                        <div className="flex justify-between">
                            <span>Late</span>
                            <span className="font-bold">0</span>
                        </div>

                        <div className="flex justify-between">
                            <span>Absent</span>
                            <span className="font-bold">0</span>
                        </div>

                    </div>

                </div>

                <div className="rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-lg">

                    <div className="flex items-center gap-3">

                        <Clock3 className="text-emerald-600" />

                        <h2 className="text-xl font-black">
                            Average Check In
                        </h2>

                    </div>

                    <h3 className="mt-8 text-5xl font-black text-cyan-700">
                        08:04
                    </h3>

                </div>

                <div className="rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-lg">

                    <div className="flex items-center gap-3">

                        <TimerReset className="text-amber-600" />

                        <h2 className="text-xl font-black">
                            HR Verification
                        </h2>

                    </div>

                    <div className="mt-8">

                        <span className="rounded-full bg-emerald-100 text-emerald-700 px-4 py-2 font-bold">
                            Verified
                        </span>

                    </div>

                </div>

            </section>

            {/* HISTORY */}

            <section className="rounded-2xl bg-white dark:bg-slate-900 shadow-lg overflow-hidden">

                <div className="p-6 border-b">

                    <h2 className="text-2xl font-black">
                        Attendance History
                    </h2>

                </div>

                <div className="overflow-auto">

                    <table className="w-full">

                        <thead className="bg-slate-100 dark:bg-slate-800">

                            <tr>

                                <th className="text-left p-4">Date</th>
                                <th className="text-left p-4">Status</th>
                                <th className="text-left p-4">Check In</th>
                                <th className="text-left p-4">Check Out</th>
                                <th className="text-left p-4">Remarks</th>

                            </tr>

                        </thead>

                        <tbody>

                            {attendance.map((row) => (
                                <tr
                                    key={row.date}
                                    className="border-b hover:bg-slate-50 dark:hover:bg-slate-800"
                                >

                                    <td className="p-4">{row.date}</td>

                                    <td className="p-4">

                                        <span className="rounded-full px-3 py-1 bg-cyan-100 text-cyan-700 font-bold">
                                            {row.status}
                                        </span>

                                    </td>

                                    <td className="p-4">{row.checkIn}</td>

                                    <td className="p-4">{row.checkOut}</td>

                                    <td className="p-4">{row.remarks}</td>

                                </tr>
                            ))}

                        </tbody>

                    </table>

                </div>

            </section>

        </div>
    );
}