type Stage =
  | "Submitted"
  | "Director"
  | "DIN Admin"
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
  | "personal-fund"
  | "personal-nonfund"
  | "auto";

function normalizeStage(stage: string | null | undefined): Stage {
  const s = (stage || "").toLowerCase().trim().replace(/\s+/g, "");

  if (!s || s.includes("submit")) return "Submitted";
  if (s.includes("director") && !s.includes("general")) return "Director";
  if (s.includes("dinadmin")) return "DIN Admin";
  if (s.includes("hod")) return "HOD";
  if (s === "hr" || s.includes("humanresources")) return "HR";
  if (s === "dg" || s.includes("directorgeneral")) return "DG";
  if (s.includes("account")) return "Account";
  if (s.includes("hrfiling") || s.includes("filing")) return "HR Filing";
  if (s.includes("complete") || s.includes("paid")) return "Completed";
  if (s.includes("reject")) return "Rejected";

  return "Submitted";
}

function normalizeRequestType(requestType: string | null | undefined) {
  return (requestType || "").trim().toLowerCase();
}

function normalizeCategory(category: string | null | undefined) {
  return (category || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
}

function buildWorkflow({
  workflow,
  requestType,
  personalCategory,
  isDinDepartment,
  stage,
}: {
  workflow?: WorkflowKind;
  requestType?: string | null;
  personalCategory?: string | null;
  isDinDepartment?: boolean;
  stage: Stage;
}) {
  if (workflow === "official-din") {
    return {
      title: "Official DIN Workflow",
      description: "Submitted → Director → DIN Admin → HOD → DG → Account → Completed",
      order: ["Submitted", "Director", "DIN Admin", "HOD", "DG", "Account", "Completed"] as Stage[],
    };
  }

  if (workflow === "official-general") {
    return {
      title: "Official Workflow",
      description: "Submitted → Director/HOD → DG → Account → Completed",
      order: ["Submitted", "Director", "HOD", "DG", "Account", "Completed"] as Stage[],
    };
  }

  if (workflow === "personal-fund") {
    return {
      title: "Personal Fund Workflow",
      description: "Submitted → HR → DG → Account → HR Filing → Completed",
      order: ["Submitted", "HR", "DG", "Account", "HR Filing", "Completed"] as Stage[],
    };
  }

  if (workflow === "personal-nonfund") {
    return {
      title: "Personal Workflow",
      description: "Submitted → HR → DG → HR Filing → Completed",
      order: ["Submitted", "HR", "DG", "HR Filing", "Completed"] as Stage[],
    };
  }

  const rt = normalizeRequestType(requestType);
  const cat = normalizeCategory(personalCategory);

  if (rt === "personal") {
    if (cat === "fund") {
      return {
        title: "Personal Fund Workflow",
        description: "Submitted → HR → DG → Account → HR Filing → Completed",
        order: ["Submitted", "HR", "DG", "Account", "HR Filing", "Completed"] as Stage[],
      };
    }

    return {
      title: "Personal Workflow",
      description: "Submitted → HR → DG → HR Filing → Completed",
      order: ["Submitted", "HR", "DG", "HR Filing", "Completed"] as Stage[],
    };
  }

  if (rt === "official" && isDinDepartment) {
    return {
      title: "Official DIN Workflow",
      description: "Submitted → Director → DIN Admin → HOD → DG → Account → Completed",
      order: ["Submitted", "Director", "DIN Admin", "HOD", "DG", "Account", "Completed"] as Stage[],
    };
  }

  if (rt === "official") {
    return {
      title: "Official Workflow",
      description: "Submitted → Director/HOD → DG → Account → Completed",
      order: ["Submitted", "Director", "HOD", "DG", "Account", "Completed"] as Stage[],
    };
  }

  if (stage === "DIN Admin") {
    return {
      title: "Official DIN Workflow",
      description: "Submitted → Director → DIN Admin → HOD → DG → Account → Completed",
      order: ["Submitted", "Director", "DIN Admin", "HOD", "DG", "Account", "Completed"] as Stage[],
    };
  }

  if (stage === "HR Filing") {
    return {
      title: "Personal Workflow",
      description: "Submitted → HR → DG → HR Filing → Completed",
      order: ["Submitted", "HR", "DG", "HR Filing", "Completed"] as Stage[],
    };
  }

  if (stage === "HR") {
    return {
      title: "Personal Workflow",
      description: "Submitted → HR → DG → HR Filing/Account → Completed",
      order: ["Submitted", "HR", "DG", "Account", "HR Filing", "Completed"] as Stage[],
    };
  }

  return {
    title: "Request Workflow",
    description: "Submitted → Review → DG → Completion",
    order: ["Submitted", "Director", "HOD", "DG", "Account", "Completed"] as Stage[],
  };
}

// Supports old and new prop styles.
export function RequestProgress({
  stage,
  currentStage,
  status,
  requestType,
  personalCategory,
  isDinDepartment,
  workflow = "auto",
}: {
  stage?: string | null | undefined;
  currentStage?: string | null | undefined;
  status?: string | null | undefined;
  requestType?: string | null | undefined;
  personalCategory?: string | null | undefined;
  isDinDepartment?: boolean;
  workflow?: WorkflowKind;
}) {
  const effectiveStage = normalizeStage(currentStage ?? stage);
  const st = (status || "").toLowerCase();

  const isRejected = st.includes("reject") || effectiveStage === "Rejected";
  const isCompleted =
    st.includes("complete") ||
    st.includes("paid") ||
    effectiveStage === "Completed";

  const workflowInfo = buildWorkflow({
    workflow,
    requestType,
    personalCategory,
    isDinDepartment,
    stage: effectiveStage,
  });

  const order = workflowInfo.order;

  const stageIndex = order.indexOf(effectiveStage);
  const activeIndex = isRejected
    ? 0
    : isCompleted
    ? order.length - 1
    : stageIndex >= 0
    ? stageIndex
    : 0;

  const percent = isRejected
    ? 0
    : Math.round(((activeIndex + 1) / order.length) * 100);

  const badgeClass = isRejected
    ? "bg-red-50 text-red-700 border-red-200"
    : isCompleted
    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
    : "bg-blue-50 text-blue-700 border-blue-200";

  const badgeText = isRejected
    ? "Rejected"
    : isCompleted
    ? "Completed"
    : `In Progress • ${percent}%`;

  return (
    <div className="rounded-2xl border bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-bold text-slate-900">
            {workflowInfo.title}
          </div>
          <div className="mt-1 text-xs text-slate-600">
            Workflow: {workflowInfo.description}
          </div>
        </div>

        <span className={`inline-flex rounded-xl border px-3 py-1 text-xs font-semibold ${badgeClass}`}>
          {badgeText}
        </span>
      </div>

      <div className="mt-4">
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
          <div
            className={`h-2 rounded-full ${
              isRejected
                ? "bg-red-600"
                : isCompleted
                ? "bg-emerald-600"
                : "bg-blue-600"
            }`}
            style={{ width: `${percent}%` }}
          />
        </div>

        <div className="mt-2 flex justify-between text-xs text-slate-600">
          <span>Start</span>
          <span>Finish</span>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {order.map((s, idx) => {
          const done = !isRejected && idx < activeIndex;
          const active = !isRejected && !isCompleted && idx === activeIndex;
          const final = isCompleted && idx === order.length - 1;

          const cls = done
            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
            : active
            ? "bg-blue-600 text-white border-blue-600"
            : final
            ? "bg-emerald-600 text-white border-emerald-600"
            : "bg-white text-slate-700 border-slate-200";

          return (
            <span
              key={s}
              className={`inline-flex items-center rounded-xl border px-3 py-1 text-xs font-semibold ${cls}`}
            >
              {s}
            </span>
          );
        })}
      </div>

      <div className="mt-4 text-sm text-slate-700">
        <b>Current Stage:</b>{" "}
        <span className="font-semibold text-slate-900">{effectiveStage}</span>
      </div>

      {isRejected && (
        <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          This request has been rejected.
        </div>
      )}
    </div>
  );
}