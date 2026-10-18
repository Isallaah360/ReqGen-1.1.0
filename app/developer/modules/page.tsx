"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { promptDialog } from "@/lib/dialog";
import { forgetModuleSwitches, loadModuleSwitches, type ModuleSwitch } from "@/lib/v4/moduleSwitches";
import { NEEDS_STEP, whenText } from "@/lib/v4/developer";
import { useIdentity } from "@/app/components/v4/useIdentity";
import { Card, Chip, Notice, PageHead, Skeleton, V4Page } from "@/app/components/v4/ui";

const WHAT: Record<string, string> = {
  requests: "New requests, My Requests, editing and printing requests.",
  approvals: "Approving, returning and signing requests and vouchers.",
  finance: "Fund releases, accounts, subheads, transfers, integrity.",
  vouchers: "Payment vouchers: preparing, signing, paying, printing.",
  registry: "Incoming and outgoing mail, dispatch, filing, tracking.",
  reports: "Every report and export.",
  audit: "Audit Log, Workflow Trace, Reconciliation, Master Backup.",
};

/** Developer Console › Modules (v4.6.6): switch a module off for maintenance, with a message. */
export default function DeveloperModulesPage() {
  const me = useIdentity();
  const [rows, setRows] = useState<ModuleSwitch[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tone: "green" | "red"; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const list = await loadModuleSwitches(true);
    setRows(list);
    setError(list.length ? null : NEEDS_STEP);
  }, []);
  useEffect(() => { if (me.ready) queueMicrotask(() => { void load(); }); }, [me.ready, load]);

  async function flip(row: ModuleSwitch) {
    setMsg(null);
    let note: string | null = null;
    if (row.enabled) {
      note = await promptDialog({
        title: `Switch ${row.label} off?`,
        message: "Everyone except you will see this message instead of its pages until you switch it on again. Nothing is deleted.",
        label: "Message for staff",
        placeholder: "e.g. Finance is being updated. It will be back at 4 pm.",
        confirmLabel: "Switch off",
        tone: "danger",
      });
      if (!note) return;
    }
    setBusy(row.module_key);
    const { error: e } = await supabase.rpc("reqgen_set_module", { p_key: row.module_key, p_enabled: !row.enabled, p_note: note });
    setBusy(null);
    if (e) { setMsg({ tone: "red", text: e.message }); return; }
    forgetModuleSwitches();
    setMsg({ tone: "green", text: `${row.label} is ${row.enabled ? "off. Staff see your message" : "on again for everyone"}.` });
    await load();
  }

  return (
    <V4Page>
      <PageHead title="Modules" sub="Switch a module off while you work on it. Staff see your message instead of its pages; you can still open everything. Nothing is deleted." />
      {error ? <Notice tone="amber">{error}</Notice> : null}
      {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
      <Card>
        {rows === null ? <div className="v4-card-body"><Skeleton lines={7} /></div> : rows.map((r) => (
          <div key={r.module_key} className="v4-switch-row">
            <button type="button" role="switch" className="v4-toggle" aria-checked={r.enabled} aria-label={`${r.label} ${r.enabled ? "on" : "off"}`} disabled={busy === r.module_key} onClick={() => void flip(r)} />
            <span>
              <strong>{r.label} {r.enabled ? <Chip tone="green">On</Chip> : <Chip tone="red">Off</Chip>}</strong>
              <small>{WHAT[r.module_key] || ""}</small>
              {!r.enabled && r.note ? <small>Message: &ldquo;{r.note}&rdquo;</small> : null}
            </span>
            <small className="v4-hide-sm" style={{ textAlign: "right" }}>{r.changed_label ? <>Changed by {r.changed_label}<br />{whenText(r.changed_at)}</> : "Never changed"}</small>
          </div>
        ))}
      </Card>
      <Notice tone="blue">Dashboard, Notifications, My Account and Administration cannot be switched off, so nobody is ever locked out.</Notice>
    </V4Page>
  );
}
