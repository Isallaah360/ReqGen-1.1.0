# ReqGen Enterprise Print Engine

The Enterprise Print Engine generates official IET A4 reports without printing the application interface.

## Protected approved templates

The following approved documents are intentionally unchanged:

- `app/requests/[id]/print/page.tsx`
- `app/payment-vouchers/[id]/print/page.tsx`

## Enterprise report templates

The central route `/output` provides role-authorized templates for:

- Requests Register
- Payment Voucher Register
- Finance Transactions
- Subhead Budget Report
- Institutional Accounts
- HR Leave Management
- HR Staff Files
- Wednesday Weekly Seminar
- Registry Operations
- Enterprise Audit
- User Administration
- Roles and Permissions
- Departments
- Security and Role Switching

## Document structure

Every new report includes:

- IET logo and institutional heading
- report title and description
- document ID
- generation date and time
- printed-by identity
- active role and department context
- executive summary cards
- official data table
- management observations and recommendations
- prepared, reviewed and approved signature blocks
- confidentiality footer and page numbering
- A4 portrait or landscape print control

Use the browser Print dialog to print or save the report as PDF.
