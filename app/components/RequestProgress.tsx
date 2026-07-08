type Stage =
  | "Submitted"
  | "PO"
  | "DOD"
  | "Director"
  | "DIN Admin"
  | "Registrar"
  | "HOD"
  | "HR"
  | "DG"
  | "Account"
  | "HR Filing"
  | "Completed"
  | "Rejected";

type WorkflowKind =
  | "official-din"
  | "official-general"
  | "official-asap-alli"
  | "official-welfare-liaison"
  | "personal-fund-din"
  | "personal-fund-general"
  | "personal-fund-asap-alli"
  | "personal-fund-welfare-liaison"
  | "personal-nonfund-din"
  | "personal-nonfund-general"
  | "personal-nonfund-asap-alli"
  | "personal-nonfund-welfare-liaison"
  | "auto";

type WorkflowMeta = {
  title: string;
  description: string;
  steps: Stage[];
};

function normalizeStage(stage: string | null | undefined): Stage {
  const s = (stage || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/_/g, "");

  if (s === "PO" || s === "PROGRAMMEOFFICER" || s === "PROGRAMOFFICER") return "PO";
  if (s === "DOD" || s === "DIRECTOROFDEPARTMENT") return "DOD";
  if (s === "DIRECTOR") return "Director";

  if (s === "DINADMIN" || s === "DINADMIN1" || s === "DINADMIN2" || s === "DINADMIN3") {
    return "DIN Admin";
  }

  if (s === "REGISTRAR") return "Registrar";
  if (s === "HOD") return "HOD";
  if (s === "HR" || s === "HRBOSS" || s === "HROFFICER") return "HR";
  if (s === "DG" || s === "DIRECTORGENERAL") return "DG";
  if (s === "ACCOUNT" || s === "ACCOUNTS" || s === "ACCOUNTOFFICER") return "Account";
  if (s === "HRFILING" || s === "FILING") return "HR Filing";

  if (s === "COMPLETED" || s === "COMPLETE" || s === "PAID" || s === "CLOSED") {
    return "Completed";
  }

  if (s === "REJECTED" || s === "REJECT" || s === "DELETED" || s === "CANCELLED") {
    return "Rejected";
  }

  return "Submitted";
}

function normalizeRequestType(value: string | null | undefined) {
  return (value || "").trim().toUpperCase();
}

function normalizeCategory(value: string | null | undefined) {
  return (value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}

function normalizeDepartmentGroup(value: string | null | undefined) {
  const v = (value || "").trim().toUpperCase().replace(/[\s_-]+/g, "");

  if (v.includes("DIN")) return "DIN";
  if (v.includes("ASAP") || v.includes("ALLI")) return "ASAP_ALLI";
  if (v.includes("WELFARE")) return "WELFARE";
  if (v.includes("LIAISON")) return "LIAISON";

  return "";
}

function stageTone(stage: Stage) {
  if (stage === "Rejected") {
    return {
      done: "border-red-600 bg-red-600 text-white",
      active: "border-red-600 bg-red-50 text-red-700",
      pending: "border-red-200 bg-red-50 text-red-700",
      lineDone: "bg-red-500",
      linePending: "bg-slate-200",
    };
  }

  if (stage === "Completed") {
    return {
      done: "border-emerald-600 bg-emerald-600 text-white",
      active: "border-emerald-600 bg-emerald-50 text-emerald-700",
      pending: "border-slate-200 bg-white text-slate-500",
      lineDone: "bg-emerald-500",
      linePending: "bg-slate-200",
    };
  }

  if (stage === "Account") {
    return {
      done: "border-purple-600 bg-purple-600 text-white",
      active: "border-purple-600 bg-purple-50 text-purple-700",
      pending: "border-slate-200 bg-white text-slate-500",
      lineDone: "bg-purple-500",
      linePending: "bg-slate-200",
    };
  }

  if (stage === "DG") {
    return {
      done: "border-amber-600 bg-amber-600 text-white",
      active: "border-amber-600 bg-amber-50 text-amber-800",
      pending: "border-slate-200 bg-white text-slate-500",
      lineDone: "bg-amber-500",
      linePending: "bg-slate-200",
    };
  }

  if (stage === "HR" || stage === "HR Filing") {
    return {
      done: "border-pink-600 bg-pink-600 text-white",
      active: "border-pink-600 bg-pink-50 text-pink-700",
      pending: "border-slate-200 bg-white text-slate-500",
      lineDone: "bg-pink-500",
      linePending: "bg-slate-200",
    };
  }

  if (stage === "DIN Admin") {
    return {
      done: "border-blue-600 bg-blue-600 text-white",
      active: "border-blue-600 bg-blue-50 text-blue-700",
      pending: "border-slate-200 bg-white text-slate-500",
      lineDone: "bg-blue-500",
      linePending: "bg-slate-200",
    };
  }

  if (["PO", "DOD", "Director", "Registrar", "HOD"].includes(stage)) {
    return {
      done: "border-emerald-600 bg-emerald-600 text-white",
      active: "border-emerald-600 bg-emerald-50 text-emerald-700",
      pending: "border-slate-200 bg-white text-slate-500",
      lineDone: "bg-emerald-500",
      linePending: "bg-slate-200",
    };
  }

  return {
    done: "border-slate-700 bg-slate-700 text-white",
    active: "border-blue-600 bg-blue-50 text-blue-700",
    pending: "border-slate-200 bg-white text-slate-500",
    lineDone: "bg-blue-500",
    linePending: "bg-slate-200",
  };
}

function stageShortName(stage: Stage) {
  if (stage === "DIN Admin") return "DIN";
  if (stage === "HR Filing") return "Filing";
  if (stage === "Submitted") return "Start";
  if (stage === "Completed") return "Done";
  return stage;
}

function buildWorkflow({
  workflow,
  requestType,
  personalCategory,
  departmentGroup,
  isDinDepartment,
  isAsapAlliDepartment,
  isWelfareDepartment,
  isLiaisonDepartment,
  currentStage,
}: {
  workflow: WorkflowKind;
  requestType?: string | null;
  personalCategory?: string | null;
  departmentGroup?: string | null;
  isDinDepartment?: boolean;
  isAsapAlliDepartment?: boolean;
  isWelfareDepartment?: boolean;
  isLiaisonDepartment?: boolean;
  currentStage: Stage;
}): WorkflowMeta {
  const reqType = normalizeRequestType(requestType);
  const cat = normalizeCategory(personalCategory);
  const deptGroup = normalizeDepartmentGroup(departmentGroup);

  const derivedGroup =
    deptGroup ||
    (isDinDepartment
      ? "DIN"
      : isAsapAlliDepartment
        ? "ASAP_ALLI"
        : isWelfareDepartment
          ? "WELFARE"
          : isLiaisonDepartment
            ? "LIAISON"
            : "");

  const isPersonal = reqType === "PERSONAL";
  const isOfficial = reqType === "OFFICIAL";
  const isFund = cat === "FUND";

  let resolvedWorkflow: WorkflowKind = workflow;

  if (workflow === "auto") {
    if (isOfficial && derivedGroup === "DIN") {
      resolvedWorkflow = "official-din";
    } else if (isOfficial && derivedGroup === "ASAP_ALLI") {
      resolvedWorkflow = "official-asap-alli";
    } else if (isOfficial && (derivedGroup === "WELFARE" || derivedGroup === "LIAISON")) {
      resolvedWorkflow = "official-welfare-liaison";
    } else if (isOfficial) {
      resolvedWorkflow = "official-general";
    } else if (isPersonal && isFund && derivedGroup === "DIN") {
      resolvedWorkflow = "personal-fund-din";
    } else if (isPersonal && isFund && derivedGroup === "ASAP_ALLI") {
      resolvedWorkflow = "personal-fund-asap-alli";
    } else if (isPersonal && isFund && (derivedGroup === "WELFARE" || derivedGroup === "LIAISON")) {
      resolvedWorkflow = "personal-fund-welfare-liaison";
    } else if (isPersonal && isFund) {
      resolvedWorkflow = "personal-fund-general";
    } else if (isPersonal && !isFund && derivedGroup === "DIN") {
      resolvedWorkflow = "personal-nonfund-din";
    } else if (isPersonal && !isFund && derivedGroup === "ASAP_ALLI") {
      resolvedWorkflow = "personal-nonfund-asap-alli";
    } else if (isPersonal && !isFund && (derivedGroup === "WELFARE" || derivedGroup === "LIAISON")) {
      resolvedWorkflow = "personal-nonfund-welfare-liaison";
    } else if (isPersonal) {
      resolvedWorkflow = "personal-nonfund-general";
    } else if (currentStage === "DIN Admin" || currentStage === "Registrar") {
      resolvedWorkflow = "official-din";
    } else if (currentStage === "PO") {
      resolvedWorkflow = "official-asap-alli";
    } else if (currentStage === "HR" || currentStage === "HR Filing") {
      resolvedWorkflow = "personal-nonfund-general";
    } else {
      resolvedWorkflow = "official-general";
    }
  }

  if (resolvedWorkflow === "official-din") {
    return {
      title: "DIN Official Workflow",
      description: "Official DIN route: DOD → DIN Admin → Registrar → DG → AccountOfficer.",
      steps: ["Submitted", "DOD", "DIN Admin", "Registrar", "DG", "Account", "Completed"],
    };
  }

  if (resolvedWorkflow === "official-asap-alli") {
    return {
      title: "ASAP-ALLI Official Workflow",
      description: "ASAP-ALLI route: PO → DOD → HOD → DG → AccountOfficer.",
      steps: ["Submitted", "PO", "DOD", "HOD", "DG", "Account", "Completed"],
    };
  }

  if (resolvedWorkflow === "official-welfare-liaison") {
    return {
      title: "Welfare / Liaison Official Workflow",
      description: "Welfare/Liaison route: DOD → DG → AccountOfficer.",
      steps: ["Submitted", "DOD", "DG", "Account", "Completed"],
    };
  }

  if (resolvedWorkflow === "personal-fund-din") {
    return {
      title: "DIN Personal Fund Workflow",
      description: "DIN Personal Fund route: DOD → HR → DG → AccountOfficer → HR Filing.",
      steps: ["Submitted", "DOD", "HR", "DG", "Account", "HR Filing", "Completed"],
    };
  }

  if (resolvedWorkflow === "personal-fund-asap-alli") {
    return {
      title: "ASAP-ALLI Personal Fund Workflow",
      description:
        "ASAP-ALLI Personal Fund route: DOD → HOD → HR → DG → AccountOfficer → HR Filing.",
      steps: ["Submitted", "DOD", "HOD", "HR", "DG", "Account", "HR Filing", "Completed"],
    };
  }

  if (resolvedWorkflow === "personal-fund-welfare-liaison") {
    return {
      title: "Welfare / Liaison Personal Fund Workflow",
      description: "Personal Fund route: DOD → HR → DG → AccountOfficer → HR Filing.",
      steps: ["Submitted", "DOD", "HR", "DG", "Account", "HR Filing", "Completed"],
    };
  }

  if (resolvedWorkflow === "personal-fund-general") {
    return {
      title: "General Personal Fund Workflow",
      description: "Personal Fund route: HOD → HR → DG → AccountOfficer → HR Filing.",
      steps: ["Submitted", "HOD", "HR", "DG", "Account", "HR Filing", "Completed"],
    };
  }

  if (resolvedWorkflow === "personal-nonfund-din") {
    return {
      title: "DIN Personal Other Workflow",
      description: "DIN Personal route: DOD → HR → DG → HR Filing.",
      steps: ["Submitted", "DOD", "HR", "DG", "HR Filing", "Completed"],
    };
  }

  if (resolvedWorkflow === "personal-nonfund-asap-alli") {
    return {
      title: "ASAP-ALLI Personal Other Workflow",
      description: "ASAP-ALLI Personal route: DOD → HOD → HR → DG → HR Filing.",
      steps: ["Submitted", "DOD", "HOD", "HR", "DG", "HR Filing", "Completed"],
    };
  }

  if (resolvedWorkflow === "personal-nonfund-welfare-liaison") {
    return {
      title: "Welfare / Liaison Personal Other Workflow",
      description: "Personal route: DOD → HR → DG → HR Filing.",
      steps: ["Submitted", "DOD", "HR", "DG", "HR Filing", "Completed"],
    };
  }

  if (resolvedWorkflow === "personal-nonfund-general") {
    return {
      title: "General Personal Other Workflow",
      description: "Personal route: HOD → HR → DG → HR Filing.",
      steps: ["Submitted", "HOD", "HR", "DG", "HR Filing", "Completed"],
    };
  }

  return {
    title: "General Official Workflow",
    description: "General Official route: HOD → DG → AccountOfficer.",
    steps: ["Submitted", "HOD", "DG", "Account", "Completed"],
  };
}

export function RequestProgress({
  stage,
  currentStage,
  status,
  requestType,
  personalCategory,
  departmentGroup,
  isDinDepartment,
  isAsapAlliDepartment,
  isWelfareDepartment,
  isLiaisonDepartment,
  workflow = "auto",
}: {
  stage?: string | null | undefined;
  currentStage?: string | null | undefined;
  status?: string | null | undefined;
  requestType?: string | null | undefined;
  personalCategory?: string | null | undefined;
  departmentGroup?: string | null | undefined;
  isDinDepartment?: boolean;
  isAsapAlliDepartment?: boolean;
  isWelfareDepartment?: boolean;
  isLiaisonDepartment?: boolean;
  workflow?: WorkflowKind;
}) {
  const rawStage = currentStage ?? stage;
  const normalizedStage = normalizeStage(rawStage);
  const statusKey = (status || "").trim().toUpperCase().replace(/\s+/g, "");

  const isRejected =
    normalizedStage === "Rejected" ||
    statusKey.includes("REJECT") ||
    statusKey.includes("DELETE") ||
    statusKey.includes("CANCEL");

  const effectiveStage: Stage = isRejected ? "Rejected" : normalizedStage;

  const meta = buildWorkflow({
    workflow,
    requestType,
    personalCategory,
    departmentGroup,
    isDinDepartment,
    isAsapAlliDepartment,
    isWelfareDepartment,
    isLiaisonDepartment,
    currentStage: effectiveStage,
  });

  const steps: Stage[] = isRejected
    ? ([...meta.steps.filter((s) => s !== "Completed"), "Rejected"] as Stage[])
    : meta.steps;

  const foundIndex = steps.findIndex((s) => s === effectiveStage);
  const currentIndex = foundIndex >= 0 ? foundIndex : 0;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-extrabold text-slate-900">{meta.title}</div>
          <div className="mt-1 text-xs font-semibold leading-5 text-slate-500">
            {meta.description}
          </div>
        </div>

        <span
          className={`rounded-full border px-3 py-1 text-xs font-bold ${isRejected
              ? "border-red-200 bg-red-50 text-red-700"
              : effectiveStage === "Completed"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-blue-200 bg-blue-50 text-blue-700"
            }`}
        >
          {isRejected ? "Rejected / Closed" : `Current: ${effectiveStage}`}
        </span>
      </div>

      <div className="mt-5 overflow-x-auto">
        <div className="flex min-w-max items-center gap-0">
          {steps.map((step, index) => {
            const tone = stageTone(step);
            const isDone = index < currentIndex || effectiveStage === "Completed";
            const isActive = index === currentIndex && effectiveStage !== "Completed";
            const isLast = index === steps.length - 1;

            const circleClass = isDone ? tone.done : isActive ? tone.active : tone.pending;
            const lineClass = index < currentIndex ? tone.lineDone : tone.linePending;

            return (
              <div key={`${step}-${index}`} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-full border-2 text-xs font-black ${circleClass}`}
                    title={step}
                  >
                    {isDone && !isActive ? "✓" : index + 1}
                  </div>

                  <div
                    className={`mt-2 max-w-[82px] text-center text-[11px] font-bold leading-tight ${isActive ? "text-slate-900" : isDone ? "text-slate-700" : "text-slate-400"
                      }`}
                  >
                    {stageShortName(step)}
                  </div>
                </div>

                {!isLast && <div className={`mx-2 h-1 w-12 rounded-full ${lineClass}`} />}
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-5 grid gap-2 text-xs font-semibold text-slate-600 md:grid-cols-2">
        <div className="rounded-xl bg-slate-50 px-3 py-2">
          Stage shown: <b className="text-slate-900">{effectiveStage}</b>
        </div>

        <div className="rounded-xl bg-slate-50 px-3 py-2">
          Status: <b className="text-slate-900">{status || "Pending"}</b>
        </div>
      </div>
    </div>
  );
}