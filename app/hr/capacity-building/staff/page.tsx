"use client";

import HRProgrammeCentre from "@/app/components/hr/HRProgrammeCentre";

export default function StaffCapacityBuildingPage() {
  return (
    <HRProgrammeCentre
      config={{
        sectionKey: "staff_capacity_building",
        table: "hr_staff_training_programmes",
        eyebrow: "Staff Learning & Development",
        title: "Staff Capacity Building Centre",
        description: "Plan, approve, monitor and evaluate individual staff training, certification, professional development and post-training impact from one secured workspace.",
        singular: "Staff Programme",
        tone: "violet",
        departmentRequired: false,
        categories: ["Internal Training", "External Training", "Workshop", "Seminar", "Conference", "Certification", "Induction", "Leadership Development", "Digital Skills", "Compliance Training"],
      }}
    />
  );
}
