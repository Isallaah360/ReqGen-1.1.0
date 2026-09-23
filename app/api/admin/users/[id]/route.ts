import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

type DependencyCheck = { table: string; column: string; label: string };

const HISTORICAL_DEPENDENCIES: DependencyCheck[] = [
  { table: "requests", column: "created_by", label: "requests" },
  { table: "finance_transactions", column: "created_by", label: "finance transactions" },
  { table: "payment_vouchers", column: "created_by", label: "payment vouchers" },
  { table: "user_role_switch_history", column: "user_id", label: "role-switch audit history" },
];

function fail(error: string, status = 400, details?: unknown) {
  return NextResponse.json({ ok: false, error, details }, { status });
}

function roleKey(value: unknown) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !anon || !service) {
    return fail("Server environment variables are incomplete.", 500);
  }

  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return fail("Unauthorized.", 401);

  const userClient = createClient(url, anon, { auth: { persistSession: false } });
  const admin = createClient(url, service, { auth: { persistSession: false } });

  const { data: authData, error: authError } = await userClient.auth.getUser(token);
  const actor = authData.user;
  if (authError || !actor) return fail("Invalid session.", 401);

  const { id: targetId } = await context.params;
  if (!targetId) return fail("Target user is required.");
  if (targetId === actor.id) return fail("Self-deletion is blocked.", 409);

  const [{ data: actorProfile, error: actorProfileError }, { data: actorRoles, error: actorRolesError }] = await Promise.all([
    admin.from("profiles").select("role").eq("id", actor.id).maybeSingle(),
    admin.from("profile_roles").select("role_key,is_active").eq("profile_id", actor.id).eq("is_active", true),
  ]);

  if (actorProfileError || actorRolesError) {
    return fail("Could not verify administrator privileges.", 500);
  }

  const isAdmin = roleKey(actorProfile?.role) === "admin" || (actorRoles || []).some((row) => roleKey(row.role_key) === "admin");
  if (!isAdmin) return fail("Admin privilege is required.", 403);

  const { data: targetProfile, error: targetError } = await admin
    .from("profiles")
    .select("id,full_name,email,role")
    .eq("id", targetId)
    .maybeSingle();

  if (targetError) return fail("Could not load target user: " + targetError.message, 500);
  if (!targetProfile) return fail("User profile was not found.", 404);

  const dependencyCounts: Record<string, number> = {};
  for (const dep of HISTORICAL_DEPENDENCIES) {
    const { count, error } = await admin.from(dep.table).select("*", { count: "exact", head: true }).eq(dep.column, targetId);
    if (error) {
      return fail(`Deletion safety check failed for ${dep.label}. No destructive action was taken.`, 409, error.message);
    }
    dependencyCounts[dep.label] = Number(count || 0);
  }

  const historicalTotal = Object.values(dependencyCounts).reduce((sum, count) => sum + count, 0);
  if (historicalTotal > 0) {
    return fail(
      "This user has immutable historical evidence. Deletion is blocked to preserve audit intelligibility; deactivate roles/access instead.",
      409,
      dependencyCounts
    );
  }

  // Remove non-historical routing/assignment links before deleting the Auth identity.
  const cleanup = [
    admin.from("departments").update({ hod_user_id: null }).eq("hod_user_id", targetId),
    admin.from("departments").update({ director_user_id: null }).eq("director_user_id", targetId),
    admin.from("profile_roles").delete().eq("profile_id", targetId),
    admin.from("user_active_roles").delete().eq("user_id", targetId),
    admin.from("iet_account_officer_assignments").delete().eq("officer_user_id", targetId),
    admin.from("department_account_routing").delete().eq("officer_user_id", targetId),
  ];

  const cleanupResults = await Promise.all(cleanup);
  const cleanupError = cleanupResults.find((result) => result.error)?.error;
  if (cleanupError) {
    return fail("Safe relationship cleanup failed. Auth identity was not deleted: " + cleanupError.message, 409);
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(targetId);
  if (deleteError) return fail("Auth identity deletion failed: " + deleteError.message, 500);

  // Delete profile only if it survived the Auth deletion (schema may use ON DELETE CASCADE).
  await admin.from("profiles").delete().eq("id", targetId);

  return NextResponse.json({
    ok: true,
    deletedUser: { id: targetId, name: targetProfile.full_name, email: targetProfile.email },
  });
}
