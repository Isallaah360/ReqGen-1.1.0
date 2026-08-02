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

export function useStaffWorkspace() {
  const [loading, setLoading] = useState(true);
  const [warning, setWarning] = useState<string | null>(null);
  const [data, setData] = useState<StaffWorkspaceData>(emptyData);

  const load = useCallback(async () => {
    setLoading(true);
    setWarning(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;
      if (!user) {
        setWarning("Your authenticated session could not be confirmed.");
        setData(emptyData);
        return;
      }

      const profileResult = await supabase
        .from("profiles")
        .select("id,full_name,role,phone,dept_id,signature_url,departments(name)")
        .eq("id", user.id)
        .maybeSingle();

      const [requestsResult, notificationsResult, leaveResult, attendanceResult, trainingResult, staffFilesResult] = await Promise.all([
        supabase.from("requests").select("*").eq("requester_id", user.id).order("created_at", { ascending: false }).limit(50),
        supabase.from("notifications").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50),
        supabase.from("hr_leave_requests").select("*").eq("staff_id", user.id).order("created_at", { ascending: false }).limit(50),
        supabase.from("hr_seminar_attendance").select("*").eq("staff_id", user.id).order("recorded_at", { ascending: false }).limit(50),
        supabase.from("hr_training_participants").select("*").eq("staff_id", user.id).order("created_at", { ascending: false }).limit(50),
        supabase.from("hr_staff_files").select("*").eq("staff_id", user.id).limit(5),
      ]);

      const profileRow = profileResult.data as GenericRow | null;
      const departments = profileRow?.departments;
      const departmentName = Array.isArray(departments)
        ? text((departments[0] as GenericRow | undefined)?.name)
        : departments && typeof departments === "object"
          ? text((departments as GenericRow).name)
          : "";

      const unavailable = [
        requestsResult.error,
        notificationsResult.error,
        leaveResult.error,
        attendanceResult.error,
        trainingResult.error,
        staffFilesResult.error,
      ].filter(Boolean);

      if (unavailable.length > 0) {
        setWarning("Some personal records are not yet available. The accessible parts of your workspace are displayed.");
      }

      setData({
        profile: {
          id: user.id,
          fullName: text(profileRow?.full_name, user.email || "Staff Member"),
          email: user.email || "",
          role: text(profileRow?.role, "Staff"),
          phone: text(profileRow?.phone),
          department: departmentName || "Department not assigned",
          departmentId: text(profileRow?.dept_id),
          designation: text(profileRow?.role, "IET Staff Member"),
          signatureUrl: text(profileRow?.signature_url),
        },
        requests: normalizeRows(requestsResult.data),
        notifications: normalizeRows(notificationsResult.data),
        leave: normalizeRows(leaveResult.data),
        attendance: normalizeRows(attendanceResult.data),
        training: normalizeRows(trainingResult.data),
        staffFiles: normalizeRows(staffFilesResult.data),
      });
    } catch (error) {
      console.error("Unable to load Staff Workspace:", error);
      setWarning("The Staff Workspace could not load all records at this time.");
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
