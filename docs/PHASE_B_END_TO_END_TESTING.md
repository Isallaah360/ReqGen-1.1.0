# ReqGen Phase B — End-to-End Workflow Testing

Use `/admin/workflow-test` while operating under the Admin active role.

## Required test accounts

- Admin
- DG
- Auditor
- Account Officer
- HR Boss
- Assigned HR Officer
- Registry
- Ordinary requester

## Evidence to capture

For every failed or blocked test record:

- test account and active role;
- request or voucher reference;
- expected result;
- actual result;
- screenshot;
- browser and screen size;
- severity;
- database or application error text.

## Exit criteria

Phase B is complete only when:

- all critical workflow tests pass;
- no role can act outside its active context;
- Action Centre counts reconcile with database records;
- every sensitive action appears in Enterprise Audit;
- Finance reservation and voucher lifecycle tests reconcile exactly;
- Registry privacy and HR limited-funding boundaries pass.
