// ReqGen Edge Function: the office jobs that need the server, for the app.
//   /functions/v1/reqgen-office?route=<route>[&id=<staff id>]
// routes: admin_users (POST), admin_user (GET, PATCH, DELETE with id), handover, pv_remind, registry_remind,
//         finance_reset, backup_snapshot, backup_export, backup_files (GET), backup_restore (multipart)
// The logic is the website's own server code (generated into _shared/gen by scripts/build-edge.mjs), so the
// same checks apply: who may do it, the fresh confirmation, the audit log. The service key never leaves Supabase.
import { POST as adminUsers } from "../_shared/gen/office_admin_users.ts";
import { GET as adminUserGet, PATCH as adminUserPatch, DELETE as adminUserDelete } from "../_shared/gen/office_admin_user.ts";
import { POST as handover } from "../_shared/gen/office_handover.ts";
import { POST as pvRemind } from "../_shared/gen/office_pv_remind.ts";
import { POST as registryRemind } from "../_shared/gen/office_registry_remind.ts";
import { POST as financeReset } from "../_shared/gen/office_finance_reset.ts";
import { POST as backupSnapshot } from "../_shared/gen/office_backup_snapshot.ts";
import { POST as backupExport } from "../_shared/gen/office_backup_export.ts";
import { GET as backupFiles } from "../_shared/gen/office_backup_files.ts";
import { POST as backupRestore } from "../_shared/gen/office_backup_restore.ts";
import { preflight, withCors } from "../_shared/http.ts";

type Handler = (req: Request) => Promise<Response>;
type IdHandler = (req: Request, ctx: { params: Promise<{ id: string }> }) => Promise<Response>;
const ROUTES: Record<string, Partial<Record<string, Handler>>> = {
  admin_users: { POST: adminUsers },
  handover: { POST: handover },
  pv_remind: { POST: pvRemind },
  registry_remind: { POST: registryRemind },
  finance_reset: { POST: financeReset },
  backup_snapshot: { POST: backupSnapshot },
  backup_export: { POST: backupExport },
  backup_files: { GET: backupFiles },
  backup_restore: { POST: backupRestore },
};
const BY_ID: Partial<Record<string, IdHandler>> = { GET: adminUserGet, PATCH: adminUserPatch, DELETE: adminUserDelete };

const fail = (req: Request, error: string, status = 400) => withCors(req, Response.json({ ok: false, error }, { status }));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight(req);
  const url = new URL(req.url);
  const route = url.searchParams.get("route") || "";
  try {
    if (route === "admin_user") {
      const id = url.searchParams.get("id") || "";
      const run = BY_ID[req.method];
      if (!run || !/^[0-9a-f-]{36}$/i.test(id)) return fail(req, "Unknown staff member or action.");
      return withCors(req, await run(req, { params: Promise.resolve({ id }) }));
    }
    const run = ROUTES[route]?.[req.method];
    if (!run) return fail(req, "Unknown office job.", 404);
    return withCors(req, await run(req));
  } catch (e) {
    return fail(req, e instanceof Error ? e.message : "The job could not be done.", 500);
  }
});
