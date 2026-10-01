import { supabase } from "@/lib/supabaseClient";

/**
 * ReqGen Routing Engine — client data layer (v3.0.5).
 * The database (database/v3_0_5_routing_engine.sql) is the source of truth;
 * this module only reads configuration and calls its guarded functions.
 */
export type RouteKind = "official" | "personal_fund" | "personal_other";
export type EngineStage = "PO" | "DOD" | "DIN Admin" | "Registrar" | "HOD" | "HR" | "DG" | "Account" | "HR Filing";
export type IfVacant = "skip" | "block";

export const ROUTE_KIND_LABEL: Record<RouteKind, string> = {
  official: "Official",
  personal_fund: "Personal Fund",
  personal_other: "Personal Other",
};
export const ROUTE_KINDS: RouteKind[] = ["official", "personal_fund", "personal_other"];

export const ENGINE_STAGES: EngineStage[] = ["PO", "DOD", "DIN Admin", "Registrar", "HOD", "HR", "DG", "Account", "HR Filing"];
/** Stages whose officer is set per department (others are institution-wide). */
export const DEPARTMENT_STAGES: EngineStage[] = ["PO", "DOD", "HOD"];
export const GLOBAL_STAGE_SETTING: Partial<Record<EngineStage, string>> = {
  "DIN Admin": "DIN_ADMIN_USER_ID",
  Registrar: "REGISTRAR_USER_ID",
  HR: "HR_USER_ID",
  DG: "DG_USER_ID",
};
export const STAGE_LABEL = (s: string) => (s === "Account" ? "Account Officer" : s);

export type RouteTemplate = { id: string; code: string; name: string; description: string | null; is_active: boolean };
export type RouteStep = { id: string; template_id: string; route_kind: RouteKind; step_order: number; stage: EngineStage; if_vacant: IfVacant };
export type DepartmentRoute = { dept_id: string; template_id: string };
export type StageBackup = { id: string; dept_id: string | null; stage: EngineStage; user_id: string; priority: number; label: string | null; is_active: boolean };
export type Availability = { user_id: string; is_away: boolean; away_from: string | null; away_until: string | null; note: string | null };

export type EngineConfig = {
  installed: boolean;
  templates: RouteTemplate[];
  steps: RouteStep[];
  deptRoutes: DepartmentRoute[];
  backups: StageBackup[];
  availability: Availability[];
};

function missingTable(message: string | undefined) {
  return /does not exist|could not find the table|PGRST205|42P01|schema cache/i.test(String(message || ""));
}

export async function loadEngineConfig(): Promise<EngineConfig> {
  const [t, s, d, b, a] = await Promise.all([
    supabase.from("reqgen_route_templates").select("id,code,name,description,is_active").order("name"),
    supabase.from("reqgen_route_steps").select("id,template_id,route_kind,step_order,stage,if_vacant").order("step_order"),
    supabase.from("reqgen_department_routes").select("dept_id,template_id"),
    supabase.from("reqgen_stage_backups").select("id,dept_id,stage,user_id,priority,label,is_active").order("priority"),
    supabase.from("reqgen_officer_availability").select("user_id,is_away,away_from,away_until,note"),
  ]);
  if (t.error && missingTable(t.error.message)) {
    return { installed: false, templates: [], steps: [], deptRoutes: [], backups: [], availability: [] };
  }
  const firstError = [t, s, d, b, a].find((r) => r.error)?.error;
  if (firstError) throw new Error(firstError.message);
  return {
    installed: true,
    templates: (t.data || []) as RouteTemplate[],
    steps: (s.data || []) as RouteStep[],
    deptRoutes: (d.data || []) as DepartmentRoute[],
    backups: (b.data || []) as StageBackup[],
    availability: (a.data || []) as Availability[],
  };
}

/** True if the officer is away today (mirrors reqgen_is_available in the database). */
export function isAwayToday(av: Availability | undefined, today = new Date().toISOString().slice(0, 10)) {
  if (!av?.is_away) return false;
  if (av.away_from && av.away_from > today) return false;
  if (av.away_until && av.away_until < today) return false;
  return true;
}

export async function saveRouteLane(templateId: string, kind: RouteKind, stages: EngineStage[], ifVacant: IfVacant[]) {
  const { error } = await supabase.rpc("reqgen_save_route", { p_template_id: templateId, p_route_kind: kind, p_stages: stages, p_if_vacant: ifVacant });
  if (error) throw new Error(error.message);
}

export async function setOfficerAvailability(userId: string, isAway: boolean, from: string | null, until: string | null, note: string | null) {
  const { data, error } = await supabase.rpc("reqgen_set_officer_availability", {
    p_user_id: userId, p_is_away: isAway, p_from: from || null, p_until: until || null, p_note: note || null,
  });
  if (error) throw new Error(error.message);
  return Number(data || 0);
}

/** Route preview for the New Request page. Null when the engine is not installed yet. */
export async function fetchRoutePreview(deptId: string, requestType: string, category: string | null) {
  const { data, error } = await supabase.rpc("reqgen_route_preview", {
    p_dept_id: deptId, p_request_type: requestType, p_personal_category: category,
  });
  if (error) return null;
  return (data || []) as Array<{ step_order: number; stage: string; is_vacant: boolean; if_vacant: IfVacant; route_group: string }>;
}
