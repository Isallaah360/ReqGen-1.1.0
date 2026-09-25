# ReqGen Sections 1-4 Mockup-Lock Audit

Overall source/spec conformance: **86%**

Merge-conflict files: **0**  
Invalid :hidden selectors: **0**  
Prohibited Enterprise module labels: **0**

| Section | Page | Route | Score |
|---:|---:|---|---:|
| 1 | 1 | /dashboard | 75% |
| 2 | 1 | /requests | 100% |
| 2 | 2 | /requests/new | 100% |
| 3 | 1 | /approvals | 75% |
| 3 | 2 | /approvals/action-centre | 25% |
| 4 | 1 | /finance | 60% |
| 4 | 2 | /finance/manage-accounts | 100% |
| 4 | 3 | /finance/manage-accounts/assign | 100% |
| 4 | 4 | /finance/subheads | 100% |
| 4 | 5 | /finance/departments | 71% |
| 4 | 6 | /finance/account-ledger | 100% |
| 4 | 7 | /finance/subhead-ledger | 100% |
| 4 | 8 | /finance/account-transfers | 100% |
| 4 | 9 | /finance/transactions | 100% |
| 5 | manual | /payment-vouchers/manual | 100% |
| 4 | 11 | /finance/vouchers | 100% |
| 4 | 12 | /finance/reports | 100% |
| 4 | 13 | /finance/reports/monthly | 100% |

## Failed checks
- S1 P1 /dashboard: Pending Approvals
- S1 P1 /dashboard: Completed / Paid
- S1 P1 /dashboard: Total Disbursed
- S3 P1 /approvals: Approvals Overview
- S3 P2 /approvals/action-centre: Action Centre
- S3 P2 /approvals/action-centre: Pending Requests
- S3 P2 /approvals/action-centre: Request Details
- S3 P2 /approvals/action-centre: Approval Workflow
- S3 P2 /approvals/action-centre: Quick Actions
- S3 P2 /approvals/action-centre: Approval Notifications
- S4 P1 /finance: Total Budget
- S4 P1 /finance: Total Expenditure
- S4 P5 /finance/departments: Finance Departments
- S4 P5 /finance/departments: With Subheads