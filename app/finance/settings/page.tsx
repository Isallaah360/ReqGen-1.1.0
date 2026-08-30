"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { FinanceCard, FinancePageFrame, MetricCard, PrimaryButton, StatusPill } from "../_components/FinancePageFrame";

type SettingsState = {
  fiscalYear: string;
  voucherPrefix: string;
  transactionPrefix: string;
  approvalLimit: string;
  defaultPaymentMethod: string;
  requireNarration: boolean;
  allowDrafts: boolean;
  lockPostedRecords: boolean;
};

const defaults: SettingsState = {
  fiscalYear: String(new Date().getFullYear()),
  voucherPrefix: "IET/PV",
  transactionPrefix: "IET/FT",
  approvalLimit: "500000",
  defaultPaymentMethod: "Bank Transfer",
  requireNarration: true,
  allowDrafts: true,
  lockPostedRecords: true,
};

export default function FinanceSettingsPage() {
  const [settings, setSettings] = useState(defaults);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const stored = window.localStorage.getItem("reqgen-finance-settings");
    if (stored) {
      try {
        const parsed = { ...defaults, ...JSON.parse(stored) } as SettingsState;
        queueMicrotask(() => setSettings(parsed));
      } catch {
        /* ignore malformed local cache */
      }
    }
  }, []);

  async function saveSettings() {
    setSaving(true);
    setMessage("");
    window.localStorage.setItem("reqgen-finance-settings", JSON.stringify(settings));

    try {
      const { data: auth } = await supabase.auth.getUser();
      if (auth.user) {
        await supabase.from("finance_activity_history").insert({
          action: "Finance settings updated",
          module: "Finance Settings",
          actor_id: auth.user.id,
          details: settings,
        });
      }
    } catch {
      // Local settings remain saved even when an optional activity table is unavailable.
    }

    setMessage("Finance settings saved successfully.");
    setSaving(false);
  }

  const field = "mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100";

  return (
    <FinancePageFrame eyebrow="Finance Administration" title="Finance Settings" description="Control fiscal-year preferences, numbering conventions and workflow safeguards from one secure workspace." icon="⚙️" tone="violet">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Fiscal year" value={settings.fiscalYear} icon="📅" tone="blue" helper="Active reporting cycle" />
        <MetricCard label="Voucher prefix" value={settings.voucherPrefix} icon="🧾" tone="violet" helper="Payment voucher numbering" />
        <MetricCard label="Approval limit" value={`₦${Number(settings.approvalLimit || 0).toLocaleString("en-NG")}`} icon="🛡️" tone="amber" helper="Control threshold" />
        <MetricCard label="Record control" value={settings.lockPostedRecords ? "Locked" : "Editable"} icon="🔐" tone="emerald" helper="Posted transaction policy" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.35fr_.65fr]">
        <FinanceCard>
          <div className="flex items-center justify-between gap-4">
            <div><p className="text-xs font-black uppercase tracking-[0.15em] text-violet-700">Configuration</p><h2 className="mt-1 text-xl font-black">Core finance preferences</h2></div>
            <StatusPill tone="violet">Controlled settings</StatusPill>
          </div>

          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <label className="text-sm font-black text-slate-700">Financial year<input className={field} value={settings.fiscalYear} onChange={(e) => setSettings({ ...settings, fiscalYear: e.target.value })} /></label>
            <label className="text-sm font-black text-slate-700">Default payment method<select className={field} value={settings.defaultPaymentMethod} onChange={(e) => setSettings({ ...settings, defaultPaymentMethod: e.target.value })}><option>Bank Transfer</option><option>Cheque</option><option>Cash</option><option>Direct Debit</option></select></label>
            <label className="text-sm font-black text-slate-700">Voucher prefix<input className={field} value={settings.voucherPrefix} onChange={(e) => setSettings({ ...settings, voucherPrefix: e.target.value })} /></label>
            <label className="text-sm font-black text-slate-700">Transaction prefix<input className={field} value={settings.transactionPrefix} onChange={(e) => setSettings({ ...settings, transactionPrefix: e.target.value })} /></label>
            <label className="text-sm font-black text-slate-700 md:col-span-2">Approval threshold (₦)<input type="number" min="0" className={field} value={settings.approvalLimit} onChange={(e) => setSettings({ ...settings, approvalLimit: e.target.value })} /></label>
          </div>

          <div className="mt-6 border-t border-slate-200 pt-6">
            <PrimaryButton tone="violet" disabled={saving} onClick={saveSettings}><span>{saving ? "⏳" : "💾"}</span>{saving ? "Saving..." : "Save Finance Settings"}</PrimaryButton>
            {message ? <p className="mt-3 text-sm font-black text-emerald-700">✓ {message}</p> : null}
          </div>
        </FinanceCard>

        <FinanceCard>
          <p className="text-xs font-black uppercase tracking-[0.15em] text-blue-700">Workflow controls</p>
          <h2 className="mt-1 text-xl font-black">Safeguards</h2>
          <div className="mt-5 space-y-3">
            {[
              ["requireNarration", "Require narration", "Every posting must carry a clear purpose."],
              ["allowDrafts", "Allow draft vouchers", "Officers may save incomplete vouchers safely."],
              ["lockPostedRecords", "Lock posted records", "Posted entries cannot be silently edited."],
            ].map(([key, label, help]) => (
              <label key={key} className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:border-blue-300 hover:bg-blue-50/60">
                <input type="checkbox" className="mt-1 h-4 w-4 accent-blue-700" checked={Boolean(settings[key as keyof SettingsState])} onChange={(e) => setSettings({ ...settings, [key]: e.target.checked })} />
                <span><span className="block text-sm font-black text-slate-900">{label}</span><span className="mt-1 block text-xs font-semibold leading-5 text-slate-500">{help}</span></span>
              </label>
            ))}
          </div>
        </FinanceCard>
      </div>
    </FinancePageFrame>
  );
}
