# ReqGen Sections 1-4 Mockup-Lock Audit

Overall source/spec conformance: **34%**

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
| 4 | 1 | /finance | 40% |
| 4 | 2 | /finance/manage-accounts | 50% |
| 4 | 3 | /finance/manage-accounts/assign | 67% |
| 4 | 4 | /finance/subheads | 67% |
| 4 | 5 | /finance/departments | 71% |
| 4 | 6 | /finance/account-ledger | 14% |
| 4 | 7 | /finance/subhead-ledger | 14% |
| 4 | 8 | /finance/account-transfers | 20% |
| 4 | 9 | /finance/transactions | 17% |
| 5 | manual | /payment-vouchers/manual | 80% |
| 4 | 11 | /finance/vouchers | 25% |
| 4 | 12 | /finance/reports | 25% |
| 4 | 13 | /finance/reports/monthly | 25% |

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
- S4 P1 /finance: Finance Overview
- S4 P1 /finance: Total Budget
- S4 P1 /finance: Total Expenditure
- S4 P2 /finance/manage-accounts: IET Bank Accounts
- S4 P2 /finance/manage-accounts: account numbers are not stored
- S4 P3 /finance/manage-accounts/assign: Assign Bank to Officer
- S4 P4 /finance/subheads: Finance Subheads
- S4 P5 /finance/departments: Finance Departments
- S4 P5 /finance/departments: With Subheads
- S4 P6 /finance/account-ledger: file exists
- S4 P6 /finance/account-ledger: Account Ledger
- S4 P6 /finance/account-ledger: Opening Balance
- S4 P6 /finance/account-ledger: Total Debit
- S4 P6 /finance/account-ledger: Total Credit
- S4 P6 /finance/account-ledger: Closing Balance
- S4 P7 /finance/subhead-ledger: file exists
- S4 P7 /finance/subhead-ledger: Subhead Ledger
- S4 P7 /finance/subhead-ledger: Opening Balance
- S4 P7 /finance/subhead-ledger: Total Debit
- S4 P7 /finance/subhead-ledger: Total Credit
- S4 P7 /finance/subhead-ledger: Closing Balance
- S4 P8 /finance/account-transfers: file exists
- S4 P8 /finance/account-transfers: Account Transfers
- S4 P8 /finance/account-transfers: New Transfer
- S4 P8 /finance/account-transfers: post_account_transfer
- S4 P9 /finance/transactions: file exists
- S4 P9 /finance/transactions: Transactions Register
- S4 P9 /finance/transactions: Total Transactions
- S4 P9 /finance/transactions: Total Debit
- S4 P9 /finance/transactions: Total Credit
- S5 Pmanual /payment-vouchers/manual: Create Manual Payment Voucher
- S4 P11 /finance/vouchers: file exists
- S4 P11 /finance/vouchers: Finance Vouchers
- S4 P11 /finance/vouchers: Create Voucher
- S4 P12 /finance/reports: file exists
- S4 P12 /finance/reports: Finance Reports
- S4 P12 /finance/reports: Popular Reports
- S4 P13 /finance/reports/monthly: file exists
- S4 P13 /finance/reports/monthly: Monthly Reports
- S4 P13 /finance/reports/monthly: Monthly Summary