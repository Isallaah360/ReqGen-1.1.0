"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { confirmDialog } from "@/lib/dialog";
import { confirmOwnPassword, readSetupStripOff, useSetupSteps, writeSetupStripOff } from "@/lib/profileSetup";
import Icon from "@/app/components/v4/Icon";
import { Chip, Notice, PageHead, Skeleton, V4Page } from "@/app/components/v4/ui";

/** My Account › Setup Guide (mock-up 21): the steps that make an account ready. */
export default function SetupGuidePage() {
  const { steps, loading, refresh } = useSetupSteps();
  const [msg, setMsg] = useState<{ tone: "green" | "red"; text: string } | null>(null);
  const [stripOff, setStripOff] = useState(false);
  useEffect(() => { queueMicrotask(() => setStripOff(readSetupStripOff())); }, []);

  const list = steps || [];
  const done = list.filter((s) => s.done).length;
  const total = list.length || 4;
  const next = list.find((s) => !s.done) || null;
  const left = total - done;

  async function markPasswordOwn() {
    const ok = await confirmDialog({ title: "Is your password already your own?", message: "Confirm only if you have already replaced the temporary password the Super Admin gave you.", confirmLabel: "Yes, it is my own", cancelLabel: "No, change it now" });
    if (!ok) return;
    try {
      await confirmOwnPassword();
      setMsg({ tone: "green", text: "Thank you. The password step is confirmed." });
      await refresh();
    } catch (e) {
      setMsg({ tone: "red", text: e instanceof Error ? e.message : "Could not save. Please try again." });
    }
  }

  return (
    <V4Page>
      <PageHead title="Setup Guide" sub={`Four steps make your account ready. ${left ? "The guide shows what is still to do." : "Everything is done."}`}
        actions={[{ label: loading ? "Checking…" : "Check again", icon: "returned", kind: "secondary", disabled: loading, onClick: () => void refresh() }]} />
      {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
      <div className="v4-cols">
        <section className="v4-card">
          {!steps && loading ? <div className="v4-card-body"><Skeleton lines={6} /></div> : list.map((s, i) => (
            <div key={s.key} className={`v4-stepcard ${s.done ? "v4-done" : "v4-todo"}`}>
              <span className="v4-si">{s.done ? <Icon name="tick" /> : i + 1}</span>
              <div>
                <h3>{s.title} {!s.done && s.required ? <Chip tone="red">Required</Chip> : null}</h3>
                <p>{s.done ? "Done." : s.why}</p>
                {!s.done && next?.key === s.key ? <ol className="v4-numbered v4-how" style={{ fontSize: 13.5 }}>{s.howTo.map((line) => <li key={line}>{line}</li>)}</ol> : null}
              </div>
              {s.done ? <span className="v4-act"><Chip tone="green">Done</Chip></span> : (
                <span className="v4-act" style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                  <Link className="v4-btn v4-btn-primary" href={s.href}>Take me there</Link>
                  {s.key === "password" ? <button className="v4-btn v4-btn-ghost" type="button" onClick={() => void markPasswordOwn()}>I already changed it</button> : null}
                </span>
              )}
            </div>
          ))}
        </section>
        <aside className="v4-side-stack" style={{ position: "static" }}>
          <section className="v4-card v4-card-pad" style={{ display: "flex", gap: 18, alignItems: "center" }}>
            <span className="v4-ring-lg" style={{ ["--v4-p" as string]: `${Math.round((done / total) * 100)}%` }}><b>{done}/{total}</b></span>
            <div>
              <h2 className="v4-h3">{left === 0 ? "Your account is ready" : left === 1 ? "Almost ready" : `${left} steps left`}</h2>
              <p className="v4-help" style={{ margin: "4px 0 0" }}>{left === 0 ? "You can submit, approve and sign. Well done." : "The orange strip on your pages disappears as soon as the steps are done."}</p>
            </div>
          </section>
          <section className="v4-card v4-card-pad">
            <div className="v4-setting">
              <span><strong>Show the guide strip on my pages</strong><span>Turn off if you prefer not to see it. You can always come back here.</span></span>
              <button className="v4-switch" type="button" role="switch" aria-checked={!stripOff} aria-label="Show the guide strip" onClick={() => { writeSetupStripOff(!stripOff); setStripOff(!stripOff); }} />
            </div>
          </section>
        </aside>
      </div>
    </V4Page>
  );
}
