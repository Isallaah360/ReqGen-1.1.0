import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  FileText,
  ShieldCheck,
  UsersRound,
  WalletCards,
} from "lucide-react";
import ERPCard from "@/app/components/erp/ui/ERPCard";
import ERPGrid from "@/app/components/erp/layout/ERPGrid";

export interface DashboardMetric {
  label: string;
  value: string | number;
  note?: string;
  trend?: string;
  tone?: "blue" | "gold" | "success" | "danger";
}

export interface DashboardActivity {
  id: string;
  title: string;
  description?: string;
  time: string;
  status?: "complete" | "pending" | "warning";
}

export interface DashboardRequest {
  id: string;
  subject: string;
  owner: string;
  department: string;
  status: string;
  updatedAt: string;
}

export interface ERPExecutiveDashboardProps {
  metrics: DashboardMetric[];
  activities: DashboardActivity[];
  requests: DashboardRequest[];
  chart?: ReactNode;
  departmentChart?: ReactNode;
}

const metricIcons = [FileText, Clock3, UsersRound, WalletCards];

/** Native ERP dashboard composition. Bind this component to existing Supabase data. */
export default function ERPExecutiveDashboard({
  metrics,
  activities,
  requests,
  chart,
  departmentChart,
}: ERPExecutiveDashboardProps) {
  return (
    <div className="erp2-dashboard">
      <ERPGrid columns={4} minItemWidth={190} gap="md">
        {metrics.slice(0, 4).map((metric, index) => {
          const Icon = metricIcons[index] ?? ShieldCheck;
          return (
            <article className={`erp2-kpi erp2-kpi--${metric.tone ?? "blue"}`} key={metric.label}>
              <span className="erp2-kpi__icon"><Icon size={20} /></span>
              <div className="erp2-kpi__content">
                <span className="erp2-kpi__label">{metric.label}</span>
                <strong>{metric.value}</strong>
                <div className="erp2-kpi__meta">
                  {metric.trend ? <b>{metric.trend}</b> : null}
                  {metric.note ? <span>{metric.note}</span> : null}
                </div>
              </div>
            </article>
          );
        })}
      </ERPGrid>

      <div className="erp2-dashboard__analytics">
        <ERPCard title="REQUEST AND APPROVAL TREND" description="Operational movement across the selected reporting period">
          <div className="erp2-chart-slot">{chart ?? <div className="erp2-chart-placeholder">Connect the existing dashboard chart here.</div>}</div>
        </ERPCard>
        <ERPCard title="DEPARTMENT PERFORMANCE" description="Distribution of activity by department">
          <div className="erp2-chart-slot">{departmentChart ?? <div className="erp2-chart-placeholder">Connect the existing department chart here.</div>}</div>
        </ERPCard>
      </div>

      <div className="erp2-dashboard__operations">
        <ERPCard
          title="RECENT REQUESTS"
          description="Latest records requiring attention"
          padding="none"
          action={<Link className="erp2-text-link" href="/erp-2/requests">View all <ArrowUpRight size={14} /></Link>}
        >
          <div className="erp2-compact-list">
            {requests.length ? requests.slice(0, 6).map((request) => (
              <article key={request.id}>
                <div><strong>{request.subject}</strong><span>{request.id} · {request.owner}</span></div>
                <div><span>{request.department}</span><b>{request.status}</b></div>
                <time>{request.updatedAt}</time>
              </article>
            )) : <div className="erp2-empty-inline">No recent requests are available.</div>}
          </div>
        </ERPCard>

        <ERPCard title="RECENT ACTIVITY" description="Latest workflow and system events">
          <div className="erp2-activity-list">
            {activities.length ? activities.slice(0, 6).map((activity) => (
              <article key={activity.id} className={`erp2-activity erp2-activity--${activity.status ?? "pending"}`}>
                <span><CheckCircle2 size={16} /></span>
                <div><strong>{activity.title}</strong>{activity.description ? <p>{activity.description}</p> : null}<time>{activity.time}</time></div>
              </article>
            )) : <div className="erp2-empty-inline">No recent activity is available.</div>}
          </div>
        </ERPCard>
      </div>
    </div>
  );
}
