"use client";

import HRProgrammeCentre from "@/app/components/hr/HRProgrammeCentre";

export default function DepartmentCapacityBuildingPage() {
  return (
    <HRProgrammeCentre
      config={{
        sectionKey: "department_capacity_building",
        table: "hr_department_capacity_programmes",
        eyebrow: "Institutional Capacity Development",
        title: "Department Capacity Building Centre",
        description: "Assess departmental gaps, coordinate improvement programmes and measure operational, leadership, technology and service-delivery capacity across IET departments.",
        singular: "Department Programme",
        tone: "cyan",
        departmentRequired: true,
        categories: ["Skills Gap", "Process Improvement", "Leadership", "Technology", "Team Building", "Knowledge Transfer", "Succession Planning", "Service Delivery", "Compliance", "Operational Improvement"],
      }}
    />
  );
}
