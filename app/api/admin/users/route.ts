import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function fail(error: string, status = 400, details?: unknown) {
  return NextResponse.json({ ok: false, error, details }, { status });
}

function roleKey(value: unknown) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export async function POST(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anon || !service) return fail("Server environment variables are incomplete.", 500);

  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return fail("Unauthorized.", 401);

  const userClient = createClient(url, anon, { auth: { persistSession: false } });
  const admin = createClient(url, service, { auth: { persistSession: false } });

  const { data: authData, error: authError } = await userClient.auth.getUser(token);
  if (authError || !authData.user) return fail("Invalid session.", 401);

  const actorId = authData.user.id;
  const [{ data: actorProfile, error: actorProfileError }, { data: actorRoles, error: actorRolesError }] = await Promise.all([
    admin.from("profiles").select("role").eq("id", actorId).maybeSingle(),
    admin.from("profile_roles").select("role_key,is_active").eq("profile_id", actorId).eq("is_active", true),
  ]);
  if (actorProfileError || actorRolesError) return fail("Could not verify administrator privileges.", 500);
  const isAdmin = roleKey(actorProfile?.role) === "admin" || (actorRoles || []).some((row) => roleKey(row.role_key) === "admin");
  if (!isAdmin) return fail("Admin privilege is required.", 403);

  const body = await req.json().catch(() => null) as null | {
    fullName?: string;
    email?: string;
    password?: string;
    roleKey?: string;
    departmentId?: string | null;
  };

  const fullName = String(body?.fullName || "").trim();
  const email = String(body?.email || "").trim().toLowerCase();
  const password = String(body?.password || "");
  const requestedRole = String(body?.roleKey || "staff").trim();
  const departmentId = body?.departmentId ? String(body.departmentId) : null;

  if (!fullName) return fail("Full name is required.");
  if (!/^\S+@\S+\.\S+$/.test(email)) return fail("A valid email address is required.");
  if (password.length < 8) return fail("Temporary password must contain at least 8 characters.");

  const { data: roleRow, error: roleError } = await admin
    .from("reqgen_roles")
    .select("role_key,role_name,is_active")
    .eq("role_key", requestedRole)
    .eq("is_active", true)
    .maybeSingle();
  if (roleError) return fail("Could not validate the selected role: " + roleError.message, 500);
  if (!roleRow) return fail("The selected role is unavailable or inactive.", 409);

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (createError || !created.user) return fail(createError?.message || "User creation failed.", 409);

  const newUserId = created.user.id;
  try {
    const { error: profileError } = await admin.from("profiles").upsert({
      id: newUserId,
      email,
      full_name: fullName,
      role: roleRow.role_name,
      dept_id: departmentId,
    });
    if (profileError) throw new Error("Profile creation failed: " + profileError.message);

    const { error: assignmentError } = await admin.rpc("reqgen_assign_profile_role", {
      p_profile_id: newUserId,
      p_role_key: roleRow.role_key,
      p_is_primary: true,
    });
    if (assignmentError) throw new Error("Role assignment failed: " + assignmentError.message);

    return NextResponse.json({ ok: true, user: { id: newUserId, email, fullName, role: roleRow.role_name } });
  } catch (error) {
    await admin.auth.admin.deleteUser(newUserId);
    return fail(error instanceof Error ? error.message : "User provisioning failed.", 500);
  }
}
