"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import AdminNavigation from "@/app/components/admin/AdminNavigation";
import {
  ACCESS_MATRIX,
  ACCESS_MATRIX_ROLES,
  type AccessMode,
} from "@/lib/accessMatrix";

function modeStyle(mode: AccessMode) {
  if (mode === "allow") {
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  }
  if (mode === "authenticated") {
    return "border-blue-200 bg-blue-50 text-blue-800";
  }
  return "border-rose-200 bg-rose-50 text-rose-800";
}

function modeLabel(mode: AccessMode) {
  if (mode === "allow") return "Allowed";
  if (mode === "authenticated") return "Authenticated";
  return "Denied";
}

export default function AdminAccessAuditPage() {
  const [query, setQuery] = useState("");
  const [role, setRole] = useState<string>("all");

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return ACCESS_MATRIX.filter((row) => {
      const matchesText =
        !needle ||
        row.label.toLowerCase().includes(needle) ||
        row.route.toLowerCase().includes(needle);

      const matchesRole =
        role === "all" || row[role as keyof typeof row] !== "deny";

      return matchesText && matchesRole;
    });
  }, [query, role]);

  const counts = useMemo(() => {
    let allowed = 0;
    let denied = 0;
    let authenticated = 0;

    for (const row of ACCESS_MATRIX) {
      for (const roleKey of ACCESS_MATRIX_ROLES) {
        const mode = row[roleKey];
        if (mode === "allow") allowed += 1;
        if (mode === "deny") denied += 1;
        if (mode === "authenticated") authenticated += 1;
      }
    }

    return { allowed, denied, authenticated };
  }, []);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(37,99,235,0.10),_transparent_30%),linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1500px] space-y-6">
        <AdminNavigation />

        <section className="rg-module-header">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs font-black uppercase tracking-[0.28em] text-cyan-300">
                Phase A · Security and Role Audit
              </p>
              <h1 className="mt-3 text-3xl font-black sm:text-4xl">
                Route Access Audit Matrix
              </h1>
              <p className="mt-3 text-sm font-semibold leading-7 text-blue-100 sm:text-base">
                A single inspection point for the active-role routes that protect ReqGen. Use it during role-by-role acceptance testing and verify the matching Supabase RLS policies separately.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/admin/security"
                className="rounded-xl bg-cyan-500 px-4 py-3 text-sm font-black text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-cyan-400"
              >
                Security Centre
              </Link>
              <Link
                href="/audit-centre"
                className="rounded-xl bg-violet-600 px-4 py-3 text-sm font-black text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-violet-500"
              >
                Audit
              </Link>
            </div>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-emerald-200 bg-white/90 p-5 shadow-lg">
            <div className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Explicitly Allowed</div>
            <div className="mt-2 text-3xl font-black text-slate-950">{counts.allowed}</div>
            <div className="mt-1 text-sm font-semibold text-slate-500">Role-route permissions</div>
          </div>
          <div className="rounded-2xl border border-blue-200 bg-white/90 p-5 shadow-lg">
            <div className="text-xs font-black uppercase tracking-[0.18em] text-blue-700">Authenticated</div>
            <div className="mt-2 text-3xl font-black text-slate-950">{counts.authenticated}</div>
            <div className="mt-1 text-sm font-semibold text-slate-500">Workflow routes with internal controls</div>
          </div>
          <div className="rounded-2xl border border-rose-200 bg-white/90 p-5 shadow-lg">
            <div className="text-xs font-black uppercase tracking-[0.18em] text-rose-700">Explicitly Denied</div>
            <div className="mt-2 text-3xl font-black text-slate-950">{counts.denied}</div>
            <div className="mt-1 text-sm font-semibold text-slate-500">Isolation checks to verify</div>
          </div>
        </section>

        <section className="rounded-[2rem] border border-slate-200 bg-white/90 p-4 shadow-xl backdrop-blur sm:p-6">
          <div className="grid gap-3 md:grid-cols-[1fr_240px]">
            <label className="block">
              <span className="mb-2 block text-xs font-black uppercase tracking-[0.15em] text-slate-600">Search routes</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search route or workspace..."
                className="min-h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm font-bold text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-xs font-black uppercase tracking-[0.15em] text-slate-600">Show role access</span>
              <select
                value={role}
                onChange={(event) => setRole(event.target.value)}
                className="min-h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm font-bold text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              >
                <option value="all">All routes</option>
                {ACCESS_MATRIX_ROLES.map((roleKey) => (
                  <option key={roleKey} value={roleKey}>
                    {roleKey}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-6 hidden overflow-x-auto lg:block">
            <table className="w-full min-w-[1200px] border-separate border-spacing-y-2 text-left">
              <thead>
                <tr className="text-xs font-black uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2">Workspace</th>
                  {ACCESS_MATRIX_ROLES.map((roleKey) => (
                    <th key={roleKey} className="px-2 py-2 text-center">{roleKey}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.route} className="bg-slate-50 shadow-sm">
                    <td className="rounded-l-xl px-3 py-3">
                      <div className="font-black text-slate-950">{row.label}</div>
                      <code className="mt-1 block text-xs font-bold text-blue-700">{row.route}</code>
                    </td>
                    {ACCESS_MATRIX_ROLES.map((roleKey, index) => {
                      const mode = row[roleKey];
                      return (
                        <td key={roleKey} className={`px-2 py-3 text-center ${index === ACCESS_MATRIX_ROLES.length - 1 ? "rounded-r-xl" : ""}`}>
                          <span className={`inline-flex rounded-lg border px-2 py-1 text-[10px] font-black uppercase ${modeStyle(mode)}`}>
                            {modeLabel(mode)}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6 grid gap-4 lg:hidden">
            {rows.map((row) => (
              <article key={row.route} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
                <div className="font-black text-slate-950">{row.label}</div>
                <code className="mt-1 block text-xs font-bold text-blue-700">{row.route}</code>
                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {ACCESS_MATRIX_ROLES.map((roleKey) => {
                    const mode = row[roleKey];
                    return (
                      <div key={roleKey} className={`rounded-xl border p-2 ${modeStyle(mode)}`}>
                        <div className="text-[10px] font-black uppercase">{roleKey}</div>
                        <div className="mt-1 text-xs font-bold">{modeLabel(mode)}</div>
                      </div>
                    );
                  })}
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
