"use client";

import Link from "next/link";
import {
    ArrowLeft,
    Download,
    FileText,
    FileCheck,
    GraduationCap,
    Search,
    Printer,
    Filter,
    CalendarDays,
    FolderOpen,
} from "lucide-react";
import { useMemo, useState } from "react";

type DownloadItem = {
    id: number;
    title: string;
    category: string;
    date: string;
    status: "Available" | "Pending";
    href: string;
};

const documents: DownloadItem[] = [
    {
        id: 1,
        title: "Appointment Letter",
        category: "HR",
        date: "12 Jan 2025",
        status: "Available",
        href: "#",
    },
    {
        id: 2,
        title: "Approved Official Request",
        category: "Requests",
        date: "04 Aug 2026",
        status: "Available",
        href: "/requests",
    },
    {
        id: 3,
        title: "Training Certificate",
        category: "Training",
        date: "29 Jul 2026",
        status: "Available",
        href: "/staff/training",
    },
    {
        id: 4,
        title: "Leave Approval Letter",
        category: "Leave",
        date: "18 Jun 2026",
        status: "Available",
        href: "/staff/leave",
    },
];

export default function DownloadsPage() {
    const [search, setSearch] = useState("");

    const filtered = useMemo(() => {
        return documents.filter((d) =>
            d.title.toLowerCase().includes(search.toLowerCase())
        );
    }, [search]);

    return (
        <div className="space-y-8">

            {/* HERO */}

            <section className="rounded-3xl bg-gradient-to-r from-slate-900 via-cyan-900 to-blue-900 p-8 shadow-xl">

                <div className="flex flex-col lg:flex-row justify-between gap-8">

                    <div>

                        <p className="uppercase tracking-[0.35em] text-cyan-300 font-bold">
                            Enterprise Downloads
                        </p>

                        <h1 className="text-5xl font-black text-white mt-2">
                            My Downloads
                        </h1>

                        <p className="mt-4 text-white/90 max-w-2xl">
                            Download your official documents,
                            letters, certificates and approved reports.
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

                        <button
                            className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-5 py-3 flex items-center gap-2"
                        >
                            <Printer size={18} />
                            Print List
                        </button>

                    </div>

                </div>

            </section>

            {/* KPI */}

            <section className="grid md:grid-cols-4 gap-5">

                <Card icon={FolderOpen} title="Documents" value="18" color="from-cyan-600 to-blue-700" />
                <Card icon={FileText} title="Letters" value="7" color="from-emerald-600 to-green-700" />
                <Card icon={GraduationCap} title="Certificates" value="10" color="from-violet-600 to-fuchsia-700" />
                <Card icon={CalendarDays} title="This Month" value="4" color="from-amber-500 to-orange-600" />

            </section>

            {/* SEARCH */}

            <section className="rounded-2xl bg-white dark:bg-slate-900 shadow-lg p-5">

                <div className="flex flex-col lg:flex-row gap-4 justify-between">

                    <div className="relative w-full lg:w-96">

                        <Search
                            size={18}
                            className="absolute left-3 top-3 text-slate-500"
                        />

                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search documents..."
                            className="pl-10 w-full rounded-xl border px-4 py-3"
                        />

                    </div>

                    <button className="rounded-xl bg-cyan-700 hover:bg-cyan-800 text-white px-5 py-3 font-bold flex items-center gap-2">
                        <Filter size={18} />
                        Filter
                    </button>

                </div>

            </section>

            {/* TABLE */}

            <section className="rounded-2xl bg-white dark:bg-slate-900 shadow-lg overflow-hidden">

                <div className="border-b p-6">

                    <h2 className="text-2xl font-black">
                        Available Downloads
                    </h2>

                </div>

                <div className="overflow-auto">

                    <table className="w-full">

                        <thead className="bg-slate-100 dark:bg-slate-800">

                            <tr>

                                <th className="text-left p-4">Document</th>
                                <th className="text-left p-4">Category</th>
                                <th className="text-left p-4">Date</th>
                                <th className="text-left p-4">Status</th>
                                <th className="text-left p-4">Action</th>

                            </tr>

                        </thead>

                        <tbody>

                            {filtered.map((doc) => (

                                <tr
                                    key={doc.id}
                                    className="border-b hover:bg-slate-50 dark:hover:bg-slate-800"
                                >

                                    <td className="p-4 font-semibold">
                                        {doc.title}
                                    </td>

                                    <td className="p-4">
                                        {doc.category}
                                    </td>

                                    <td className="p-4">
                                        {doc.date}
                                    </td>

                                    <td className="p-4">

                                        <span className="rounded-full bg-emerald-100 text-emerald-700 px-3 py-1 font-bold">
                                            {doc.status}
                                        </span>

                                    </td>

                                    <td className="p-4">

                                        <Link
                                            href={doc.href}
                                            className="rounded-xl bg-cyan-700 hover:bg-cyan-800 text-white px-4 py-2 font-bold inline-flex items-center gap-2"
                                        >
                                            <Download size={16} />
                                            Download
                                        </Link>

                                    </td>

                                </tr>

                            ))}

                        </tbody>

                    </table>

                </div>

            </section>

            {/* ENTERPRISE NOTE */}

            <section className="rounded-2xl bg-gradient-to-r from-cyan-700 to-blue-700 p-6 text-white shadow-lg">

                <div className="flex items-center gap-3">

                    <FileCheck size={34} />

                    <div>

                        <h2 className="text-2xl font-black">
                            Enterprise Print Engine
                        </h2>

                        <p className="text-white/90 mt-2">
                            All downloadable documents are generated using the official
                            IET enterprise print templates and remain subject to your
                            assigned role permissions.
                        </p>

                    </div>

                </div>

            </section>

        </div>
    );
}

function Card({
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
        <div className={`rounded-2xl bg-gradient-to-br ${color} p-5 text-white shadow-lg`}>
            <div className="flex justify-between">
                <div>
                    <p className="font-semibold">{title}</p>
                    <h2 className="text-4xl font-black mt-3">{value}</h2>
                </div>
                <Icon size={34} />
            </div>
        </div>
    );
}