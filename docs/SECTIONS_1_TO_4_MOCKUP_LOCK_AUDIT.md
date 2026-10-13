# ReqGen Sections 1-4 Mockup-Lock Audit

Overall source/spec conformance: **64%**

Merge-conflict files: **0**  
Invalid :hidden selectors: **0**  
Prohibited Enterprise module labels: **0**

| Section | Page | Route | Score |
|---:|---:|---|---:|
| 1 | 1 | /dashboard | 17% |
| 2 | 1 | /requests | 25% |
| 2 | 2 | /requests/new | 67% |
| 3 | 1 | /approvals | 50% |
| 3 | 2 | /approvals/action-centre | 25% |
| 4 | 1 | /finance | 60% |
| 4 | 2 | /finance/manage-accounts | 50% |
| 4 | 3 | /finance/manage-accounts/assign | 67% |
| 4 | 4 | /finance/subheads | 67% |
| 4 | 5 | /finance/departments | 71% |
| 4 | 6 | /finance/account-ledger | 100% |
| 4 | 7 | /finance/subhead-ledger | 100% |
| 4 | 8 | /finance/account-transfers | 100% |
| 4 | 9 | /finance/transactions | 100% |
| 5 | manual | /payment-vouchers/manual | 80% |
| 4 | 11 | /finance/vouchers | 100% |
| 4 | 12 | /finance/reports | 100% |
| 4 | 13 | /finance/reports/monthly | 100% |

## Failed checks
- S1 P1 /dashboard: Pending Approvals
- S1 P1 /dashboard: Completed / Paid
- S1 P1 /dashboard: Total Disbursed
- S1 P1 /dashboard: Overdue
- S1 P1 /dashboard: Request Trend
- S1 P1 /dashboard: Recent Activities
- S1 P1 /dashboard: Requests by Category
- S1 P1 /dashboard: Requests by Status
- S1 P1 /dashboard: Quick Actions
- S1 P1 /dashboard: Security Tip
- S2 P1 /requests: Total Requests
- S2 P1 /requests: Active Workflow
- S2 P1 /requests: Completed / Paid
- S2 P1 /requests: Official Requests
- S2 P1 /requests: Rejected / Deleted
- S2 P1 /requests: All Requests
- S2 P1 /requests: Personal Fund
- S2 P1 /requests: Personal Other
- S2 P1 /requests: New Request
- S2 P2 /requests/new: Create New Request
- S3 P1 /approvals: Approvals Overview
- S3 P1 /approvals: Action Centre
- S3 P2 /approvals/action-centre: Action Centre
- S3 P2 /approvals/action-centre: Pending Requests
- S3 P2 /approvals/action-centre: Request Details
- S3 P2 /approvals/action-centre: Approval Workflow
- S3 P2 /approvals/action-centre: Quick Actions
- S3 P2 /approvals/action-centre: Approval Notifications
- S4 P1 /finance: Total Budget
- S4 P1 /finance: Total Expenditure
- S4 P2 /finance/manage-accounts: IET Bank Accounts
- S4 P2 /finance/manage-accounts: account numbers are not stored
- S4 P3 /finance/manage-accounts/assign: Assign Bank to Officer
- S4 P4 /finance/subheads: Finance Subheads
- S4 P5 /finance/departments: Finance Departments
- S4 P5 /finance/departments: With Subheads
- S5 Pmanual /payment-vouchers/manual: Create Manual Payment Voucher