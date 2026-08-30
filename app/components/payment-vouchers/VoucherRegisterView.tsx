"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Eye,
  Printer,
  RefreshCw,
  Search,
} from "lucide-react";

import { supabase } from "@/lib/supabaseClient";
import {
  EnterpriseHero,
  EnterpriseShell,
  SectionCard,
  StatCard,
  StatusBadge,
} from "@/app/components/enterprise/EnterpriseUI";

type VoucherRow = Record<string, unknown>;
type Mode = "pending" | "approved" | "history" | "print";

const cfg: Record<
  Mode,
  {
    eyebrow: string;
    title: string;
    description: string;
  }
> = {
  pending: {
    eyebrow: "Payment Vouchers",
    title: "Pending Approval",
    description:
      "Review payment vouchers that are still moving through checking, authorization or payment approval.",
  },
  approved: {
    eyebrow: "Payment Vouchers",
    title: "Approved Vouchers",
    description:
      "Review approved payment vouchers that are ready for payment, printing or finance follow-up.",
  },
  history: {
    eyebrow: "Payment Vouchers",
    title: "Payment History",
    description:
      "Review the historical register of paid, completed and closed payment vouchers.",
  },
  print: {
    eyebrow: "Payment Vouchers",
    title: "Print / PDF Centre",
    description:
      "Locate approved vouchers and open the existing voucher print workspace for official output.",
  },
};

function txt(value: unknown) {
  return String(value ?? "").trim();
}

function money(value: unknown) {
  const numericValue = Number(value ?? 0);

  return (
    "₦" +
    Math.round(
      Number.isFinite(numericValue)
        ? numericValue
        : 0
    ).toLocaleString("en-NG")
  );
}

function date(value: unknown) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "—";
  }

  let dateValue: Date;

  if (value instanceof Date) {
    dateValue = value;
  } else if (
    typeof value === "string" ||
    typeof value === "number"
  ) {
    dateValue = new Date(value);
  } else {
    return "—";
  }

  if (Number.isNaN(dateValue.getTime())) {
    return "—";
  }

  return dateValue.toLocaleDateString(
    "en-GB",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }
  );
}

function statusTone(value: string) {
  const status = value.toLowerCase();

  if (/paid|complete/.test(status)) {
    return "emerald" as const;
  }

  if (/approve|authoriz/.test(status)) {
    return "violet" as const;
  }

  if (/reject|cancel/.test(status)) {
    return "rose" as const;
  }

  return "amber" as const;
}

export default function VoucherRegisterView({
  mode,
}: {
  mode: Mode;
}) {
  const meta = cfg[mode];

  const [rows, setRows] =
    useState<VoucherRow[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [query, setQuery] =
    useState("");

  const [status, setStatus] =
    useState("ALL");

  const load = useCallback(async () => {
    setLoading(true);

    try {
      const result = await supabase
        .from("payment_vouchers")
        .select("*")
        .order(
          "created_at",
          { ascending: false }
        )
        .limit(500);

      setRows(
        Array.isArray(result.data)
          ? (result.data as VoucherRow[])
          : []
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  const scoped = useMemo(
    () =>
      rows.filter((row) => {
        const rowStatus =
          txt(row.status).toLowerCase();

        if (
          mode === "pending" &&
          /paid|complete|cancel|reject/.test(
            rowStatus
          )
        ) {
          return false;
        }

        if (
          mode === "approved" &&
          !/approve|authoriz|checked|ready/.test(
            rowStatus
          )
        ) {
          return false;
        }

        if (
          mode === "history" &&
          !/paid|complete|closed|cancel|reject/.test(
            rowStatus
          )
        ) {
          return false;
        }

        if (
          mode === "print" &&
          !/approve|authoriz|paid|complete|ready/.test(
            rowStatus
          )
        ) {
          return false;
        }

        return true;
      }),
    [rows, mode]
  );

  const filtered = useMemo(
    () =>
      scoped.filter((row) => {
        const normalizedQuery =
          query
            .trim()
            .toLowerCase();

        const rowStatus =
          txt(row.status);

        const matchesSearch =
          !normalizedQuery ||
          [
            row.voucher_no,
            row.payee_name,
            row.narration,
            row.dept_name,
            row.request_no,
          ].some((value) =>
            txt(value)
              .toLowerCase()
              .includes(normalizedQuery)
          );

        const matchesStatus =
          status === "ALL" ||
          rowStatus === status;

        return (
          matchesSearch &&
          matchesStatus
        );
      }),
    [
      scoped,
      query,
      status,
    ]
  );

  const statuses = useMemo(
    () =>
      [
        ...new Set(
          scoped
            .map((row) =>
              txt(row.status)
            )
            .filter(Boolean)
        ),
      ],
    [scoped]
  );

  const totalValue =
    scoped.reduce(
      (sum, row) => {
        const value =
          Number(
            row.total_amount ??
            row.amount ??
            0
          );

        return (
          sum +
          (
            Number.isFinite(value)
              ? value
              : 0
          )
        );
      },
      0
    );

  const today =
    new Date().toDateString();

  const todayCount =
    scoped.filter((row) => {
      const createdAt =
        row.created_at;

      if (
        typeof createdAt !== "string" &&
        typeof createdAt !== "number" &&
        !(createdAt instanceof Date)
      ) {
        return false;
      }

      const createdDate =
        new Date(createdAt);

      return (
        !Number.isNaN(
          createdDate.getTime()
        ) &&
        createdDate.toDateString() ===
        today
      );
    }).length;

  return (
    <EnterpriseShell>
      <div className="mx-auto max-w-[1500px] space-y-4">
        <EnterpriseHero
          eyebrow={meta.eyebrow}
          title={meta.title}
          description={meta.description}
          actions={
            <>
              <button
                className="rg-action-button"
                onClick={() =>
                  void load()
                }
                style={{
                  [
                    "--rg-action-accent" as string
                  ]: "#0891b2",
                }}
              >
                <RefreshCw
                  size={15}
                />

                {loading
                  ? "Refreshing..."
                  : "Refresh"}
              </button>

              <Link
                href="/payment-vouchers/new"
                className="rg-action-button"
                style={{
                  [
                    "--rg-action-accent" as string
                  ]: "#0b5cf0",
                }}
              >
                Create New Voucher
              </Link>
            </>
          }
        />

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Vouchers"
            value={
              loading
                ? "—"
                : scoped.length
            }
            note="Current workspace"
            tone="blue"
          />

          <StatCard
            label="Value"
            value={
              loading
                ? "—"
                : money(
                  totalValue
                )
            }
            note="Voucher amount"
            tone="violet"
          />

          <StatCard
            label="Today"
            value={
              loading
                ? "—"
                : todayCount
            }
            note="Created today"
            tone="cyan"
          />

          <StatCard
            label="Statuses"
            value={
              loading
                ? "—"
                : statuses.length
            }
            note="Distinct states"
            tone="emerald"
          />
        </section>

        <SectionCard
          title="Voucher Register"
          eyebrow={meta.title}
        >
          <div className="mb-4 grid gap-3 md:grid-cols-[1fr_220px_auto]">
            <label className="relative">
              <Search
                size={15}
                className="absolute left-3 top-3 text-slate-400"
              />

              <input
                className="pl-9"
                value={query}
                onChange={(event) =>
                  setQuery(
                    event.target
                      .value
                  )
                }
                placeholder="Search voucher no., beneficiary, department..."
              />
            </label>

            <select
              value={status}
              onChange={(event) =>
                setStatus(
                  event.target
                    .value
                )
              }
            >
              <option value="ALL">
                All statuses
              </option>

              {statuses.map(
                (statusValue) => (
                  <option
                    key={
                      statusValue
                    }
                    value={
                      statusValue
                    }
                  >
                    {
                      statusValue
                    }
                  </option>
                )
              )}
            </select>

            <button
              className="rg-action-button"
              onClick={() => {
                setQuery("");
                setStatus("ALL");
              }}
              style={{
                [
                  "--rg-action-accent" as string
                ]: "#334155",
              }}
            >
              Clear
            </button>
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table>
              <thead>
                <tr>
                  <th>
                    Voucher No.
                  </th>
                  <th>Date</th>
                  <th>
                    Department
                  </th>
                  <th>
                    Beneficiary
                  </th>
                  <th>
                    Description
                  </th>
                  <th>
                    Amount
                  </th>
                  <th>
                    Status
                  </th>
                  <th>
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody>
                {filtered.map(
                  (row) => {
                    const id =
                      txt(
                        row.id
                      );

                    return (
                      <tr
                        key={
                          id
                        }
                      >
                        <td className="font-black text-slate-900">
                          {txt(
                            row.voucher_no
                          ) ||
                            "—"}
                        </td>

                        <td>
                          {date(
                            row.created_at
                          )}
                        </td>

                        <td>
                          {txt(
                            row.dept_name
                          ) ||
                            "—"}
                        </td>

                        <td>
                          {txt(
                            row.payee_name
                          ) ||
                            "—"}
                        </td>

                        <td>
                          {txt(
                            row.narration
                          ) ||
                            "—"}
                        </td>

                        <td className="font-black">
                          {money(
                            row.total_amount ??
                            row.amount
                          )}
                        </td>

                        <td>
                          <StatusBadge
                            tone={statusTone(
                              txt(
                                row.status
                              )
                            )}
                          >
                            {txt(
                              row.status
                            ) ||
                              "Pending"}
                          </StatusBadge>
                        </td>

                        <td>
                          <div className="flex gap-1">
                            <Link
                              aria-label="View"
                              title="View"
                              className="grid h-8 w-8 place-items-center rounded-md border border-slate-200 bg-white text-blue-700"
                              href={`/payment-vouchers/${id}`}
                            >
                              <Eye
                                size={
                                  14
                                }
                              />
                            </Link>

                            <Link
                              aria-label="Print"
                              title="Print"
                              className="grid h-8 w-8 place-items-center rounded-md border border-slate-200 bg-white text-slate-700"
                              href={`/payment-vouchers/${id}/print`}
                            >
                              <Printer
                                size={
                                  14
                                }
                              />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  }
                )}

                {!filtered.length ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="py-10 text-center font-semibold text-slate-500"
                    >
                      {loading
                        ? "Loading vouchers..."
                        : "No voucher matches this workspace."}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </SectionCard>
      </div>
    </EnterpriseShell>
  );
}