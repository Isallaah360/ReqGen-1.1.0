"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BriefcaseBusiness,
  CheckCircle2,
  Clock3,
  RotateCcw,
  Send,
  TimerReset,
  Workflow,
} from "lucide-react";

import { supabase } from "@/lib/supabaseClient";
import { HRNavigation } from "@/app/components/hr";
import {
  HRAlert,
  HRBadge,
  HRButton,
  HREmpty,
  HRHero,
  HRPageShell,
  HRPanel,
  HRRefreshButton,
  HRStatCard,
  formatDate,
  pretty,
} from "@/app/components/hr/HREnterprisePage";

type RequestSummary = {
  request_no?: string | null;
  title?: string | null;
  current_stage?: string | null;
  status?: string | null;
};

type WorkItem = {
  id: string;
  request_id: string;
  section_key: string;
  status: string;
  priority: string;
  due_at: string | null;
  assigned_at: string;
  submitted_at: string | null;
  boss_comment: string | null;
  officer_recommendation: string | null;
  requests?: RequestSummary | null;
};

const tabs = [
  "all",
  "assigned",
  "in_progress",
  "returned",
  "submitted",
  "approved",
  "completed",
] as const;

type WorkTab = (typeof tabs)[number];

const CLOSED_STATUSES = new Set(["completed", "approved"]);

function normalizeRows(value: unknown): WorkItem[] {
  if (!Array.isArray(value)) return [];

  return value.filter(
    (row): row is WorkItem =>
      Boolean(row) &&
      typeof row === "object" &&
      "id" in row &&
      "request_id" in row
  );
}

export default function HRMyWorkPage() {
  const [items, setItems] = useState<WorkItem[]>([]);
  const [active, setActive] = useState<WorkTab>("all");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage("");

    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();

      if (authError) throw authError;

      const user = authData.user;

      if (!user) {
        setItems([]);
        setMessage("Your session has expired. Please sign in again.");
        return;
      }

      const { data, error } = await supabase
        .from("hr_request_assignments")
        .select(
          "id,request_id,section_key,status,priority,due_at,assigned_at,submitted_at,boss_comment,officer_recommendation,requests(request_no,title,current_stage,status)"
        )
        .eq("officer_id", user.id)
        .order("assigned_at", { ascending: false });

      if (error) throw error;

      setItems(normalizeRows(data));
    } catch (error) {
      console.error("Unable to load HR assignments:", error);
      setItems([]);
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to load your HR assignments at this time."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const channel = supabase
      .channel("hr-my-work-live")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "hr_request_assignments",
        },
        () => void load()
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [load]);

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return items.filter((item) => {
      const matchesTab = active === "all" || item.status === active;

      const haystack = [
        item.requests?.request_no,
        item.requests?.title,
        item.section_key,
        item.status,
        item.priority,
        item.requests?.current_stage,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return matchesTab && (!needle || haystack.includes(needle));
    });
  }, [items, active, query]);

  const overdue = useMemo(
    () =>
      items.filter((item) => {
        if (!item.due_at || CLOSED_STATUSES.has(item.status)) return false;
        return new Date(item.due_at).getTime() < Date.now();
      }).length,
    [items]
  );

  async function updateStatus(id: string, status: string) {
    setMessage("");
    setUpdatingId(id);

    try {
      const patch: Record<string, unknown> = {
        status,
        updated_at: new Date().toISOString(),
      };

      if (status === "in_progress") {
        patch.started_at = new Date().toISOString();
      }

      if (status === "submitted") {
        patch.submitted_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from("hr_request_assignments")
        .update(patch)
        .eq("id", id);

      if (error) throw error;

      await load();
    } catch (error) {
      console.error("Unable to update HR assignment:", error);
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to update this HR assignment."
      );
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <HRPageShell>
      <HRHero
        eyebrow="Assigned HR Officer Workspace"
        title="My HR Work"
        description="A personal enterprise work queue showing every HR assignment delegated to your account, due dates, review feedback and submission status."
        icon={BriefcaseBusiness}
        tone="cyan"
        action={<HRRefreshButton onClick={() => void load()} loading={loading} />}
      />

      <HRNavigation />

      {message ? <HRAlert message={message} /> : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <HRStatCard
          label="Assigned Work"
          value={items.length}
          note="Total HR tasks allocated to you"
          icon={Workflow}
          tone="blue"
        />

        <HRStatCard
          label="In Progress"
          value={items.filter((item) => item.status === "in_progress").length}
          note="Tasks currently being processed"
          icon={TimerReset}
          tone="cyan"
        />

        <HRStatCard
          label="Submitted"
          value={items.filter((item) => item.status === "submitted").length}
          note="Awaiting HR Boss review"
          icon={Send}
          tone="violet"
        />

        <HRStatCard
          label="Overdue"
          value={overdue}
          note="Assignments beyond their due date"
          icon={Clock3}
          tone={overdue > 0 ? "rose" : "emerald"}
        />
      </section>

      <HRPanel
        title="Assigned Work Register"
        eyebrow="Officer Operations"
        action={
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search assigned work..."
            className="min-h-11 w-full rounded-xl border border-slate-200 px-4 text-sm font-semibold outline-none transition focus:border-blue-500 sm:w-72"
          />
        }
      >
        <div className="mb-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          {tabs.map((tab) => {
            const count =
              tab === "all"
                ? items.length
                : items.filter((item) => item.status === tab).length;

            return (
              <button
                key={tab}
                type="button"
                onClick={() => setActive(tab)}
                className={`rounded-xl px-3 py-2.5 text-xs font-black text-white shadow transition hover:-translate-y-0.5 hover:shadow-md ${
                  active === tab
                    ? "bg-slate-950 ring-4 ring-slate-200"
                    : "bg-cyan-600 hover:bg-cyan-700"
                }`}
              >
                {pretty(tab)}
                <span className="ml-1 rounded-full bg-white/20 px-2 py-1">
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {loading ? (
          <p className="py-12 text-center font-bold text-slate-500">
            Loading assigned work...
          </p>
        ) : shown.length === 0 ? (
          <HREmpty title="No matching HR assignments" />
        ) : (
          <div className="grid gap-4">
            {shown.map((item) => {
              const isUpdating = updatingId === item.id;

              return (
                <article
                  key={item.id}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-5 transition hover:bg-white hover:shadow-md"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap gap-2">
                        <HRBadge value={item.section_key} tone="blue" />
                        <HRBadge
                          value={item.priority}
                          tone={item.priority === "urgent" ? "rose" : "amber"}
                        />
                        <HRBadge
                          value={item.status}
                          tone={item.status === "completed" ? "emerald" : "slate"}
                        />
                      </div>

                      <h3 className="mt-3 break-words text-lg font-black text-slate-950">
                        {item.requests?.request_no || item.request_id} — {" "}
                        {item.requests?.title || "HR-bound request"}
                      </h3>

                      <p className="mt-2 text-sm font-semibold text-slate-600">
                        Assigned {formatDate(item.assigned_at)} · Due {formatDate(item.due_at)} · Current stage {pretty(item.requests?.current_stage)}
                      </p>

                      {item.officer_recommendation ? (
                        <p className="mt-3 rounded-xl bg-blue-50 p-3 text-sm font-bold text-blue-900">
                          Officer recommendation: {item.officer_recommendation}
                        </p>
                      ) : null}

                      {item.boss_comment ? (
                        <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm font-bold text-amber-900">
                          HR Boss feedback: {item.boss_comment}
                        </p>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Link
                        href={`/requests/${item.request_id}`}
                        className="rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-black text-white shadow transition hover:bg-blue-800"
                      >
                        Open Request
                      </Link>

                      {["assigned", "returned"].includes(item.status) ? (
                        <HRButton
                          onClick={() => void updateStatus(item.id, "in_progress")}
                          tone="amber"
                          disabled={isUpdating}
                        >
                          <RotateCcw className="h-4 w-4" />
                          {isUpdating ? "Updating..." : "Start Work"}
                        </HRButton>
                      ) : null}

                      {item.status === "in_progress" ? (
                        <HRButton
                          onClick={() => void updateStatus(item.id, "submitted")}
                          tone="violet"
                          disabled={isUpdating}
                        >
                          <Send className="h-4 w-4" />
                          {isUpdating ? "Submitting..." : "Submit to HR Boss"}
                        </HRButton>
                      ) : null}

                      {item.status === "completed" ? (
                        <div className="inline-flex items-center gap-2 rounded-xl bg-emerald-100 px-4 py-2.5 text-sm font-black text-emerald-700">
                          <CheckCircle2 className="h-4 w-4" />
                          Completed
                        </div>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </HRPanel>
    </HRPageShell>
  );
}
