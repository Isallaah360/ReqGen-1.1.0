type Stage =
  | "Director"
  | "HOD"
  | "HR"
  | "Registry"
  | "DG"
  | "Account"
  | "Completed"
  | "Rejected";

const ORDER: Stage[] = ["Director", "HOD", "HR", "Registry", "DG", "Account", "Completed"];

function normalizeStage(stage: string | null | undefined): Stage {
  const s = (stage || "").toLowerCase().trim();

  if (!s) return "HOD";
  if (s.includes("director")) return "Director";
  if (s.includes("hod")) return "HOD";
  if (s === "hr" || s.includes("human")) return "HR";
  if (s.includes("registry")) return "Registry";
  if (s === "dg" || s.includes("director general")) return "DG";
  if (s.includes("account")) return "Account";
  if (s.includes("complete")) return "Completed";
  if (s.includes("reject")) return "Rejected";

  return "HOD";
}

// ✅ Supports BOTH prop styles to avoid future build errors
export function RequestProgress({
  stage,
  currentStage,
  status,
}: {
  stage?: string | null | undefined;
  currentStage?: string | null | undefined;
  status?: string | null | undefined;
}) {
  const effectiveStage = normalizeStage(currentStage ?? stage);
  const st = (status || "").toLowerCase();

  const isRejected = st.includes("reject") || effectiveStage === "Rejected";
  const isCompleted = st.includes("complete") || effectiveStage === "Completed";

  const activeIndex = isRejected
    ? ORDER.indexOf("HOD")
    : isCompleted
    ? ORDER.length - 1
    : Math.max(0, ORDER.indexOf(effectiveStage));

  const percent = isRejected ? 0 : Math.round(((activeIndex + 1) / ORDER.length) * 100);

  const badgeClass = isRejected
    ? "bg-red-50 text-red-700 border-red-200"
    : isCompleted
    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
    : "bg-blue-50 text-blue-700 border-blue-200";

  const badgeText = isRejected ? "Rejected" : isCompleted ? "Completed" : `In Progress • ${percent}%`;

  return (
    <div className="rounded-2xl border bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-bold text-slate-900">Request Progress</div>
          <div className="mt-1 text-xs text-slate-600">
            Workflow: Director → HOD → HR → Registry → DG → Account → Completed
          </div>
        </div>

        <span className={`inline-flex rounded-xl border px-3 py-1 text-xs font-semibold ${badgeClass}`}>
          {badgeText}
        </span>
      </div>

      {/* Progress bar */}
      <div className="mt-4">
        <div className="h-2 w-full rounded-full bg-slate-200 overflow-hidden">
          <div
            className={`h-2 rounded-full ${isRejected ? "bg-red-600" : isCompleted ? "bg-emerald-600" : "bg-blue-600"}`}
            style={{ width: `${percent}%` }}
          />
        </div>
        <div className="mt-2 flex justify-between text-xs text-slate-600">
          <span>Start</span>
          <span>Finish</span>
        </div>
      </div>

      {/* Stage pills */}
      <div className="mt-4 flex flex-wrap gap-2">
        {ORDER.map((s, idx) => {
          const done = !isRejected && idx < activeIndex;
          const active = !isRejected && !isCompleted && idx === activeIndex;
          const final = isCompleted && idx === ORDER.length - 1;

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

      {/* Current stage note */}
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