import { Download, Plus } from "lucide-react";
import PageContainer from "@/app/components/erp/layout/PageContainer";
import ERPButton from "@/app/components/erp/ui/ERPButton";
import ERPExecutiveDashboard from "@/app/components/erp/dashboard/ERPExecutiveDashboard";

export default function ReferenceDashboardPage() {
  return (
    <PageContainer>
      <header className="erp2-page-header">
        <div>
          <span className="erp2-page-header__eyebrow">REQGEN ERP 2.0</span>
          <h1>EXECUTIVE COMMAND CENTRE</h1>
          <p>Enterprise overview, workflow performance and operational intelligence.</p>
        </div>
        <div className="erp2-page-header__actions">
          <ERPButton variant="secondary" leadingIcon={<Download size={16} />}>Export</ERPButton>
          <ERPButton variant="gold" leadingIcon={<Plus size={16} />}>New Request</ERPButton>
        </div>
      </header>

      <ERPExecutiveDashboard
        metrics={[
          { label: "Total Requests", value: 128, trend: "+8%", note: "This month", tone: "blue" },
          { label: "Pending Approvals", value: 18, trend: "-3%", note: "Since yesterday", tone: "gold" },
          { label: "Active Staff", value: 246, trend: "+2", note: "New this week", tone: "success" },
          { label: "Payment Vouchers", value: 42, trend: "+12%", note: "This month", tone: "blue" },
        ]}
        requests={[
          { id: "REQ-2026-0128", subject: "Payment voucher request", owner: "Amina Musa", department: "Finance", status: "Pending", updatedAt: "10:30 AM" },
          { id: "REQ-2026-0127", subject: "Official travel approval", owner: "John Daniel", department: "Administration", status: "In Review", updatedAt: "9:45 AM" },
          { id: "REQ-2026-0126", subject: "Staff record amendment", owner: "Musa Bello", department: "HR", status: "Approved", updatedAt: "Yesterday" },
        ]}
        activities={[
          { id: "1", title: "Request approved", description: "REQ-2026-0126 completed departmental review", time: "10 minutes ago", status: "complete" },
          { id: "2", title: "Voucher submitted", description: "PV-2026-0046 entered finance review", time: "35 minutes ago", status: "pending" },
          { id: "3", title: "Role access changed", description: "Permissions refreshed for active role", time: "1 hour ago", status: "warning" },
        ]}
      />
    </PageContainer>
  );
}
