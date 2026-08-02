"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { normalizeRows, text, type GenericRow } from "@/app/components/enterprise/data";

export type StaffProfile = {
  id: string;
  fullName: string;
  email: string;
  role: string;
  phone: string;
  department: string;
  departmentId: string;
  designation: string;
  signatureUrl: string;
};

export type StaffWorkspaceData = {
  profile: StaffProfile | null;
  requests: GenericRow[];
  notifications: GenericRow[];
  leave: GenericRow[];
  attendance: GenericRow[];
  training: GenericRow[];
  staffFiles: GenericRow[];
};

const emptyData: StaffWorkspaceData = {
  profile: null,
  requests: [],
  notifications: [],
  leave: [],
  attendance: [],
  training: [],
  staffFiles: [],
};

function metadataName(metadata: Record<string, unknown> | undefined) {
  return text(metadata?.full_name) || text(metadata?.name) || text(metadata?.display_name);
}

export function useStaffWorkspace() {
  const [loading, setLoading] = useState(true);
  const [warning, setWarning] = useState<string | null>(null);
  const [data, setData] = useState<StaffWorkspaceData>(emptyData);

  const load = useCallback(async () => {
    setLoading(true);
    setWarning(null);

    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      const user = sessionData.session?.user;

      if (sessionError || !user) {
        setWarning("Your authenticated session could not be confirmed.");
        setData(emptyData);
        return;
      }

      const profileResult = await supabase
        .from("profiles")
        .select("id,full_name,email,role,phone,dept_id,signature_url")
        .eq("id", user.id)
        .maybeSingle();

      const profileRow = (profileResult.data || {}) as GenericRow;
      const departmentId = text(profileRow.dept_id);

      const departmentResult = departmentId
        ? await supabase.from("departments").select("name").eq("id", departmentId).maybeSingle()
        : { data: null, error: null };

      const [requestsResult, notificationsResult, leaveResult, attendanceResult, trainingResult, staffFilesResult] = await Promise.all([
        supabase.from("requests").select("*").eq("created_by", user.id).order("created_at", { ascending: false }).limit(50),
        supabase.from("notifications").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50),
        supabase.from("hr_leave_requests").select("*").eq("staff_id", user.id).order("created_at", { ascending: false }).limit(50),
        supabase.from("hr_seminar_attendance").select("*").eq("staff_id", user.id).order("recorded_at", { ascending: false }).limit(50),
        supabase.from("hr_training_participants").select("*").eq("staff_id", user.id).order("created_at", { ascending: false }).limit(50),
        supabase.from("hr_staff_files").select("*").eq("staff_id", user.id).limit(5),
      ]);

      const fullName =
        text(profileRow.full_name) ||
        metadataName(user.user_metadata as Record<string, unknown> | undefined) ||
        "Staff Member";

      const email = text(profileRow.email) || user.email || "";
      const role = text(profileRow.role, "Staff");
      const departmentName = text((departmentResult.data as GenericRow | null)?.name, "Department not assigned");

      // Only core personal sources trigger a workspace warning. Optional HR modules may
      // legitimately be unavailable until the staff member has matching records.
      const coreErrors = [profileResult.error, requestsResult.error, notificationsResult.error].filter(Boolean);
      if (coreErrors.length > 0) {
        setWarning("Some core personal information could not be loaded. Refresh the page or contact the Administrator if this continues.");
      }

      setData({
        profile: {
          id: user.id,
          fullName,
          email,
          role,
          phone: text(profileRow.phone),
          department: departmentName,
          departmentId,
          designation: role || "IET Staff Member",
          signatureUrl: text(profileRow.signature_url),
        },
        requests: normalizeRows(requestsResult.data),
        notifications: normalizeRows(notificationsResult.data),
        leave: leaveResult.error ? [] : normalizeRows(leaveResult.data),
        attendance: attendanceResult.error ? [] : normalizeRows(attendanceResult.data),
        training: trainingResult.error ? [] : normalizeRows(trainingResult.data),
        staffFiles: staffFilesResult.error ? [] : normalizeRows(staffFilesResult.data),
      });
    } catch (error) {
      console.error("Unable to load personal workspace data:", error);
      setWarning("Your personal information could not be loaded at this time.");
      setData(emptyData);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();

    const channel = supabase
      .channel("staff-workspace-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "requests" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, () => void load())
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [load]);

  return { ...data, loading, warning, refresh: load };
}
