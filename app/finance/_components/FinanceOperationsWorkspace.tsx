"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";

import {
  ArrowRight,
  Banknote,
  BookOpen,
  CalendarDays,
  Download,
  Eye,
  FileBarChart2,
  FileSpreadsheet,
  FileText,
  Plus,
  RefreshCw,
  Search,
  Send,
  WalletCards,
  X,
} from "lucide-react";

import { supabase } from "@/lib/supabaseClient";
import styles from "./FinanceOperationsWorkspace.module.css";

type Mode =
  | "account-ledger"
  | "subhead-ledger"
  | "account-transfers"
  | "transactions"
  | "vouchers"
  | "reports"
  | "monthly";

type Row = Record<string, unknown>;

type QueryResult = {
  data: Row[] | null;
  error: { message: string } | null;
};

type TransferResult = {
  transfer_no?: string | null;
};

type MonthSummary = {
  key: string;
  month: string;
  income: number;
  expense: number;
  count: number;
  status: string;
  latest: string;
};

type Column = {
  key: string;
  label: string;
  format?: "money" | "date" | "status";
};

type Config = {
  title: string;
  description: string;
  table: string | null;
  dateField?: string;
  searchFields: string[];
  columns: Column[];
  primary?: {
    label: string;
    href?: string;
    modal?: boolean;
  };
};

const CONFIG: Record<Mode, Config> = {
  "account-ledger": {
    title: "Account Ledger",
    description:
      "View all transactions and balances for a specific account.",
    table: "iet_account_transactions",
    dateField: "created_at",
    searchFields: [
      "transaction_type",
      "reference_type",
      "reference_no",
      "narration",
      "actor_name",
    ],
    columns: [
      { key: "created_at", label: "Date", format: "date" },
      { key: "reference_no", label: "Reference" },
      { key: "narration", label: "Description" },
      { key: "transaction_type", label: "Type", format: "status" },
      { key: "debit", label: "Debit (₦)", format: "money" },
      { key: "credit", label: "Credit (₦)", format: "money" },
      { key: "balance_after", label: "Balance (₦)", format: "money" },
    ],
  },

  "subhead-ledger": {
    title: "Subhead Ledger",
    description:
      "View transactions and balances for a specific subhead.",
    table: "finance_transactions",
    dateField: "transaction_date",
    searchFields: [
      "transaction_no",
      "transaction_type",
      "narration",
      "external_reference",
    ],
    columns: [
      { key: "transaction_date", label: "Date", format: "date" },
      { key: "transaction_no", label: "Reference" },
      { key: "narration", label: "Description" },
      { key: "transaction_type", label: "Type", format: "status" },
      { key: "debit", label: "Debit (₦)", format: "money" },
      { key: "credit", label: "Credit (₦)", format: "money" },
      { key: "balance", label: "Balance (₦)", format: "money" },
    ],
  },

  "account-transfers": {
    title: "Account Transfers",
    description: "Create and manage transfers between accounts.",
    table: "account_transfers",
    dateField: "created_at",
    searchFields: [
      "transfer_no",
      "narration",
      "external_reference",
      "initiated_by_name",
      "posted_by_name",
      "status",
    ],
    columns: [
      { key: "created_at", label: "Date", format: "date" },
      { key: "transfer_no", label: "Reference" },
      { key: "source_account_name", label: "From Account" },
      { key: "destination_account_name", label: "To Account" },
      { key: "amount", label: "Amount (₦)", format: "money" },
      { key: "status", label: "Status", format: "status" },
    ],
    primary: {
      label: "New Transfer",
      modal: true,
    },
  },

  transactions: {
    title: "Transactions Register",
    description:
      "View all finance transactions across the system.",
    table: "finance_transactions",
    dateField: "transaction_date",
    searchFields: [
      "transaction_no",
      "transaction_type",
      "narration",
      "external_reference",
    ],
    columns: [
      { key: "transaction_date", label: "Date", format: "date" },
      { key: "transaction_no", label: "Reference" },
      { key: "narration", label: "Description" },
      { key: "transaction_type", label: "Type", format: "status" },
      { key: "debit", label: "Debit (₦)", format: "money" },
      { key: "credit", label: "Credit (₦)", format: "money" },
      { key: "status", label: "Status", format: "status" },
    ],
  },

  vouchers: {
    title: "Finance Vouchers",
    description:
      "View all system vouchers and their status.",
    table: "payment_vouchers",
    dateField: "created_at",
    searchFields: [
      "voucher_no",
      "request_no",
      "payee_name",
      "narration",
      "status",
    ],
    columns: [
      { key: "created_at", label: "Date", format: "date" },
      { key: "voucher_no", label: "Voucher No." },
      { key: "voucher_type", label: "Type" },
      { key: "narration", label: "Description" },
      { key: "amount", label: "Amount (₦)", format: "money" },
      { key: "status", label: "Status", format: "status" },
    ],
    primary: {
      label: "Create Voucher",
      href: "/finance/manual-voucher",
    },
  },

  reports: {
    title: "Finance Reports",
    description: "Generate and manage financial reports.",
    table: "finance_transactions",
    dateField: "transaction_date",
    searchFields: [
      "transaction_no",
      "transaction_type",
      "narration",
    ],
    columns: [],
    primary: {
      label: "Reports Centre",
      href: "/reports",
    },
  },

  monthly: {
    title: "Monthly Reports",
    description:
      "View and compare monthly financial reports.",
    table: "finance_transactions",
    dateField: "transaction_date",
    searchFields: [
      "transaction_no",
      "transaction_type",
      "narration",
    ],
    columns: [],
    primary: {
      label: "Generate This Month",
      href: "/reports",
    },
  },
};

function money(value: unknown) {
  const numeric = Number(value ?? 0);

  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(numeric) ? numeric : 0);
}

function date(value: unknown) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "—";
  }

  let parsed: Date;

  if (value instanceof Date) {
    parsed = value;
  } else if (
    typeof value === "string" ||
    typeof value === "number"
  ) {
    parsed = new Date(value);
  } else {
    return "—";
  }

  if (Number.isNaN(parsed.getTime())) {
    return "—";
  }

  return parsed.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function text(value: unknown) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "—";
  }

  return String(value);
}

function rawText(value: unknown) {
  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }

  return String(value).trim();
}

function rowKey(row: Row, fallback: number) {
  const id = row.id;

  if (
    typeof id === "string" ||
    typeof id === "number"
  ) {
    return String(id);
  }

  return `finance-row-${fallback}`;
}

function csv(value: unknown) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function isCredit(row: Row) {
  return /credit|deposit|receipt|inflow|transfer in|posted|paid|approved/i.test(
    text(
      row.transaction_type ??
      row.type ??
      row.status
    )
  );
}

function rowAmount(row: Row) {
  const value = Number(
    row.amount ??
    row.total_amount ??
    0
  );

  return Number.isFinite(value)
    ? value
    : 0;
}

function parseDateValue(value: unknown) {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime())
      ? null
      : value;
  }

  if (
    typeof value === "string" ||
    typeof value === "number"
  ) {
    const parsed = new Date(value);

    return Number.isNaN(parsed.getTime())
      ? null
      : parsed;
  }

  return null;
}

function Dot({
  color,
}: {
  color: string;
}) {
  return (
    <i
      className={styles.dot}
      style={{
        background: color,
      }}
    />
  );
}

export default function FinanceOperationsWorkspace({
  mode,
}: {
  mode: Mode;
}) {
  const config = CONFIG[mode];

  const [rows, setRows] =
    useState<Row[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  const [search, setSearch] =
    useState("");

  const [status, setStatus] =
    useState("All");

  const [period, setPeriod] =
    useState("All");

  const [selected, setSelected] =
    useState<Row | null>(null);

  const [accounts, setAccounts] =
    useState<Row[]>([]);

  const [transferOpen, setTransferOpen] =
    useState(false);

  const [posting, setPosting] =
    useState(false);

  const [sourceId, setSourceId] =
    useState("");

  const [destinationId, setDestinationId] =
    useState("");

  const [amount, setAmount] =
    useState("");

  const [narration, setNarration] =
    useState("");

  const [reference, setReference] =
    useState("");

  const load = useCallback(
    async (manual = false) => {
      if (manual) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      try {
        const requests: Array<
          Promise<unknown>
        > = [];

        if (config.table) {
          requests.push(
            Promise.resolve(
              supabase
                .from(config.table)
                .select("*")
                .order(
                  config.dateField ||
                  "created_at",
                  {
                    ascending: false,
                  }
                )
                .limit(1000)
            )
          );
        }

        if (
          [
            "account-transfers",
            "account-ledger",
          ].includes(mode)
        ) {
          requests.push(
            Promise.resolve(
              supabase
                .from("iet_accounts")
                .select("*")
                .order("name", {
                  ascending: true,
                  nullsFirst: false,
                })
            )
          );
        }

        const results =
          (await Promise.all(
            requests
          )) as QueryResult[];

        const main = results[0];

        if (main?.error) {
          throw new Error(
            main.error.message
          );
        }

        let data =
          (main?.data || []) as Row[];

        if (
          mode ===
          "account-transfers"
        ) {
          const accountRows =
            (results[1]?.data ||
              []) as Row[];

          setAccounts(accountRows);

          const accountMap =
            new Map(
              accountRows.map(
                (account) => [
                  rawText(
                    account.id
                  ),
                  rawText(
                    account.name ??
                    account.account_name ??
                    account.bank_name
                  ) ||
                  "IET Account",
                ]
              )
            );

          data = data.map(
            (row) => ({
              ...row,
              source_account_name:
                accountMap.get(
                  rawText(
                    row.source_account_id
                  )
                ) ||
                "IET Account",
              destination_account_name:
                accountMap.get(
                  rawText(
                    row.destination_account_id
                  )
                ) ||
                "IET Account",
            })
          );
        }

        if (
          mode ===
          "account-ledger"
        ) {
          setAccounts(
            (results[1]?.data ||
              []) as Row[]
          );
        }

        setRows(data);
      } catch (caught: unknown) {
        setError(
          caught instanceof Error
            ? caught.message
            : "Unable to load this finance workspace."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [
      mode,
      config.table,
      config.dateField,
    ]
  );

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  const ledgerRows =
    useMemo<Row[]>(
      () =>
        rows.map(
          (row): Row => ({
            ...row,
            debit: isCredit(row)
              ? 0
              : rowAmount(row),
            credit: isCredit(row)
              ? rowAmount(row)
              : 0,
            balance:
              row.balance_after ??
              row.running_balance ??
              row.balance ??
              0,
          })
        ),
      [rows]
    );

  const filtered = useMemo(
    () =>
      ledgerRows.filter(
        (row) => {
          const needle =
            search
              .trim()
              .toLowerCase();

          const matchesSearch =
            !needle ||
            config.searchFields.some(
              (key) =>
                text(
                  row[key]
                )
                  .toLowerCase()
                  .includes(
                    needle
                  )
            ) ||
            Object.values(
              row
            ).some(
              (value) =>
                typeof value ===
                "string" &&
                value
                  .toLowerCase()
                  .includes(
                    needle
                  )
            );

          const statusValue =
            text(
              row.status ??
              row.transaction_type
            ).toLowerCase();

          const matchesStatus =
            status === "All" ||
            statusValue.includes(
              status.toLowerCase()
            );

          let matchesPeriod = true;

          if (
            period !== "All" &&
            config.dateField
          ) {
            const parsed =
              parseDateValue(
                row[
                config.dateField
                ]
              );

            if (!parsed) {
              matchesPeriod = false;
            } else {
              const now =
                new Date();

              if (
                period ===
                "Today"
              ) {
                matchesPeriod =
                  parsed.toDateString() ===
                  now.toDateString();
              }

              if (
                period ===
                "Month"
              ) {
                matchesPeriod =
                  parsed.getMonth() ===
                  now.getMonth() &&
                  parsed.getFullYear() ===
                  now.getFullYear();
              }

              if (
                period ===
                "Year"
              ) {
                matchesPeriod =
                  parsed.getFullYear() ===
                  now.getFullYear();
              }
            }
          }

          return (
            matchesSearch &&
            matchesStatus &&
            matchesPeriod
          );
        }
      ),
    [
      ledgerRows,
      search,
      status,
      period,
      config.searchFields,
      config.dateField,
    ]
  );

  const totalValue = useMemo(
    () =>
      rows.reduce(
        (sum, row) =>
          sum +
          rowAmount(row),
        0
      ),
    [rows]
  );

  const totalDebit = useMemo(
    () =>
      ledgerRows.reduce(
        (sum, row) =>
          sum +
          Number(
            row.debit ?? 0
          ),
        0
      ),
    [ledgerRows]
  );

  const totalCredit = useMemo(
    () =>
      ledgerRows.reduce(
        (sum, row) =>
          sum +
          Number(
            row.credit ?? 0
          ),
        0
      ),
    [ledgerRows]
  );

  const opening =
    Math.max(
      totalCredit - totalDebit,
      0
    );

  const closing =
    opening +
    totalCredit -
    totalDebit;

  const posted =
    rows.filter((row) =>
      /posted|paid|complete|success/i.test(
        text(row.status)
      )
    ).length;

  const pending =
    rows.filter((row) =>
      /pending|draft|await/i.test(
        text(row.status)
      )
    ).length;

  const cancelled =
    rows.filter((row) =>
      /cancel|reverse|reject/i.test(
        text(row.status)
      )
    ).length;

  const months =
    useMemo<MonthSummary[]>(
      () => {
        const map =
          new Map<
            string,
            MonthSummary
          >();

        const now =
          new Date();

        rows.forEach(
          (row) => {
            const parsed =
              parseDateValue(
                row.transaction_date ??
                row.created_at
              );

            if (!parsed) {
              return;
            }

            const key = `${parsed.getFullYear()}-${String(
              parsed.getMonth() +
              1
            ).padStart(
              2,
              "0"
            )}`;

            const isCurrent =
              parsed.getMonth() ===
              now.getMonth() &&
              parsed.getFullYear() ===
              now.getFullYear();

            const existing =
              map.get(key);

            const month:
              MonthSummary =
              existing || {
                key,
                month:
                  parsed.toLocaleDateString(
                    "en-GB",
                    {
                      month:
                        "long",
                      year:
                        "numeric",
                    }
                  ),
                income: 0,
                expense: 0,
                count: 0,
                status:
                  isCurrent
                    ? "Current"
                    : "Completed",
                latest:
                  parsed.toISOString(),
              };

            month.count += 1;

            if (
              parsed.toISOString() >
              month.latest
            ) {
              month.latest =
                parsed.toISOString();
            }

            if (
              isCredit(row)
            ) {
              month.income +=
                rowAmount(
                  row
                );
            } else {
              month.expense +=
                rowAmount(
                  row
                );
            }

            map.set(
              key,
              month
            );
          }
        );

        return Array.from(
          map.values()
        ).sort(
          (a, b) =>
            b.key.localeCompare(
              a.key
            )
        );
      },
      [rows]
    );

  const exportRows = () => {
    const columns: Column[] =
      config.columns.length
        ? config.columns
        : [
          {
            key: "month",
            label: "Month",
          },
          {
            key: "count",
            label:
              "Transactions",
          },
          {
            key: "income",
            label: "Income",
          },
          {
            key: "expense",
            label: "Expense",
          },
        ];

    const source:
      Array<
        Row | MonthSummary
      > =
      mode === "monthly"
        ? months
        : filtered;

    const content = [
      columns
        .map((column) =>
          csv(column.label)
        )
        .join(","),

      ...source.map(
        (row) =>
          columns
            .map(
              (column) =>
                csv(
                  (
                    row as Record<
                      string,
                      unknown
                    >
                  )[
                  column.key
                  ]
                )
            )
            .join(",")
      ),
    ].join("\n");

    const blob =
      new Blob(
        [content],
        {
          type: "text/csv;charset=utf-8",
        }
      );

    const url =
      URL.createObjectURL(
        blob
      );

    const anchor =
      document.createElement(
        "a"
      );

    anchor.href =
      url;

    anchor.download = `${mode}-${new Date()
      .toISOString()
      .slice(
        0,
        10
      )}.csv`;

    anchor.click();

    URL.revokeObjectURL(
      url
    );
  };

  const postTransfer =
    async (
      event: FormEvent
    ) => {
      event.preventDefault();

      setError("");
      setSuccess("");

      const value =
        Number(amount);

      if (
        !sourceId ||
        !destinationId ||
        sourceId ===
        destinationId ||
        !Number.isFinite(
          value
        ) ||
        value <= 0 ||
        narration
          .trim()
          .length < 5
      ) {
        setError(
          "Complete the transfer form correctly. Source and destination must be different and narration must be clear."
        );

        return;
      }

      setPosting(true);

      try {
        const {
          data,
          error: rpcError,
        } =
          await supabase.rpc(
            "post_account_transfer",
            {
              p_source_account_id:
                sourceId,
              p_destination_account_id:
                destinationId,
              p_amount:
                value,
              p_narration:
                narration.trim(),
              p_external_reference:
                reference.trim() ||
                null,
            }
          );

        if (rpcError) {
          throw new Error(
            rpcError.message
          );
        }

        const transfer =
          (
            Array.isArray(
              data
            )
              ? data[0]
              : data
          ) as
          | TransferResult
          | null;

        setSuccess(
          `Transfer ${transfer?.transfer_no ||
          ""
          } posted successfully.`
        );

        setTransferOpen(
          false
        );

        setSourceId("");
        setDestinationId("");
        setAmount("");
        setNarration("");
        setReference("");

        await load(true);
      } catch (caught: unknown) {
        setError(
          caught instanceof Error
            ? caught.message
            : "Unable to post transfer."
        );
      } finally {
        setPosting(false);
      }
    };

  if (loading) {
    return (
      <main
        className={
          styles.loading
        }
      >
        Loading finance
        workspace…
      </main>
    );
  }

  if (mode === "reports") {
    return (
      <ReportsPage
        rows={rows}
      />
    );
  }

  if (mode === "monthly") {
    return (
      <MonthlyPage
        months={months}
        totalValue={
          totalValue
        }
        exportRows={
          exportRows
        }
        refreshing={
          refreshing
        }
        load={load}
      />
    );
  }

  const kpis =
    mode === "vouchers"
      ? [
        {
          l: "Total Vouchers",
          v: rows.length,
          m: "This year",
        },
        {
          l: "Posted Vouchers",
          v: posted,
          m: rows.length
            ? `${Math.round(
              (posted /
                rows.length) *
              100
            )}%`
            : "0%",
        },
        {
          l: "Pending Vouchers",
          v: pending,
          m: "Awaiting action",
        },
        {
          l: "Cancelled Vouchers",
          v: cancelled,
          m: "Recorded",
        },
      ]
      : mode ===
        "account-transfers"
        ? [
          {
            l: "Total Transfers",
            v: rows.length,
            m: "This year",
          },
          {
            l: "Completed",
            v: posted,
            m: "Posted transfers",
          },
          {
            l: "Pending",
            v: pending,
            m: "Awaiting action",
          },
          {
            l: "Transfer Value",
            v: money(
              totalValue
            ),
            m: "Total value",
          },
        ]
        : mode ===
          "transactions"
          ? [
            {
              l: "Total Transactions",
              v: rows.length,
              m: "Recorded entries",
            },
            {
              l: "Total Debit",
              v: money(
                totalDebit
              ),
              m: "Outflow",
            },
            {
              l: "Total Credit",
              v: money(
                totalCredit
              ),
              m: "Inflow",
            },
            {
              l: "Net Balance",
              v: money(
                totalCredit -
                totalDebit
              ),
              m: "Credit less debit",
            },
          ]
          : [
            {
              l: "Opening Balance",
              v: money(
                opening
              ),
              m: "Period opening",
            },
            {
              l: "Total Debit",
              v: money(
                totalDebit
              ),
              m: "Outflow",
            },
            {
              l: "Total Credit",
              v: money(
                totalCredit
              ),
              m: "Inflow",
            },
            {
              l: "Closing Balance",
              v: money(
                closing
              ),
              m: "Running balance",
            },
          ];

  const titleRight =
    mode ===
      "account-transfers" ? (
      <button
        className={
          styles.primary
        }
        onClick={() =>
          setTransferOpen(
            true
          )
        }
      >
        <Plus size={15} />
        New Transfer
      </button>
    ) : mode ===
      "vouchers" ? (
      <Link
        className={
          styles.primary
        }
        href="/finance/manual-voucher"
      >
        <Plus size={15} />
        New Voucher
      </Link>
    ) : null;

  return (
    <main
      className={styles.page}
    >
      <header
        className={
          styles.header
        }
      >
        <div>
          <div
            className={
              styles.crumb
            }
          >
            Finance{" "}
            <span>›</span>{" "}
            <b>
              {
                config.title
              }
            </b>
          </div>

          <h1>
            {config.title}
          </h1>

          <p>
            {
              config.description
            }
          </p>
        </div>

        <div
          className={
            styles.actions
          }
        >
          {titleRight}
        </div>
      </header>

      {error ? (
        <div
          className={`${styles.alert} ${styles.error}`}
        >
          {error}
        </div>
      ) : null}

      {success ? (
        <div
          className={`${styles.alert} ${styles.success}`}
        >
          {success}
        </div>
      ) : null}

      <section
        className={
          styles.kpis
        }
      >
        {kpis.map(
          (kpi, index) => (
            <article
              className={
                styles.kpi
              }
              key={
                kpi.l
              }
            >
              <div
                className={
                  styles.kpiIcon
                }
              >
                {index ===
                  0 ? (
                  <WalletCards
                    size={19}
                  />
                ) : index ===
                  1 ? (
                  <Banknote
                    size={19}
                  />
                ) : index ===
                  2 ? (
                  <FileText
                    size={19}
                  />
                ) : (
                  <BookOpen
                    size={19}
                  />
                )}
              </div>

              <div>
                <span>
                  {kpi.l}
                </span>

                <strong>
                  {kpi.v}
                </strong>

                <small>
                  {kpi.m}
                </small>
              </div>
            </article>
          )
        )}
      </section>

      <section
        className={
          styles.filters
        }
      >
        <label
          className={
            styles.field
          }
        >
          <span>
            Search
          </span>

          <div
            className={
              styles.inputWrap
            }
          >
            <Search
              size={13}
            />

            <input
              value={search}
              onChange={(
                event
              ) =>
                setSearch(
                  event
                    .target
                    .value
                )
              }
              placeholder="Search reference / description…"
            />
          </div>
        </label>

        <label
          className={
            styles.field
          }
        >
          <span>
            Date Range
          </span>

          <select
            value={period}
            onChange={(
              event
            ) =>
              setPeriod(
                event
                  .target
                  .value
              )
            }
          >
            <option value="All">
              All dates
            </option>
            <option value="Today">
              Today
            </option>
            <option value="Month">
              This month
            </option>
            <option value="Year">
              This year
            </option>
          </select>
        </label>

        <label
          className={
            styles.field
          }
        >
          <span>
            Status / Type
          </span>

          <select
            value={status}
            onChange={(
              event
            ) =>
              setStatus(
                event
                  .target
                  .value
              )
            }
          >
            <option>
              All
            </option>
            <option>
              Posted
            </option>
            <option>
              Pending
            </option>
            <option>
              Paid
            </option>
            <option>
              Credit
            </option>
            <option>
              Debit
            </option>
          </select>
        </label>

        <button
          className={
            styles.filterBtn
          }
          onClick={() => {
            setSearch("");
            setStatus("All");
            setPeriod("All");
          }}
        >
          More Filters
        </button>
      </section>

      <section
        className={
          styles.grid
        }
      >
        <article
          className={
            styles.panel
          }
        >
          <div
            className={
              styles.panelHead
            }
          >
            <div>
              <h2>
                {mode ===
                  "account-transfers"
                  ? `Transfers (${filtered.length})`
                  : mode ===
                    "vouchers"
                    ? `Vouchers (${filtered.length})`
                    : `Ledger Entries (${filtered.length})`}
              </h2>

              <small>
                Live finance
                records from
                ReqGen
              </small>
            </div>

            <div
              className={
                styles.panelTools
              }
            >
              <button
                onClick={() =>
                  void load(
                    true
                  )
                }
                disabled={
                  refreshing
                }
              >
                <RefreshCw
                  size={12}
                />

                {refreshing
                  ? "Refreshing"
                  : "Refresh"}
              </button>

              <button
                onClick={
                  exportRows
                }
              >
                <Download
                  size={12}
                />
                Export
              </button>
            </div>
          </div>

          <div
            className={
              styles.tableWrap
            }
          >
            <table
              className={
                styles.table
              }
            >
              <thead>
                <tr>
                  {config.columns.map(
                    (
                      column
                    ) => (
                      <th
                        key={
                          column.key
                        }
                      >
                        {
                          column.label
                        }
                      </th>
                    )
                  )}

                  <th>
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody>
                {filtered
                  .slice(
                    0,
                    8
                  )
                  .map(
                    (
                      row,
                      index
                    ) => (
                      <tr
                        key={rowKey(
                          row,
                          index
                        )}
                      >
                        {config.columns.map(
                          (
                            column
                          ) => (
                            <td
                              key={
                                column.key
                              }
                            >
                              {column.format ===
                                "money" ? (
                                <span
                                  className={
                                    column.key ===
                                      "credit"
                                      ? styles.credit
                                      : column.key ===
                                        "debit"
                                        ? styles.debit
                                        : styles.money
                                  }
                                >
                                  {money(
                                    row[
                                    column
                                      .key
                                    ]
                                  )}
                                </span>
                              ) : column.format ===
                                "date" ? (
                                date(
                                  row[
                                  column
                                    .key
                                  ]
                                )
                              ) : column.format ===
                                "status" ? (
                                <span
                                  className={`${styles.pill} ${/pending|draft/i.test(
                                    text(
                                      row[
                                      column
                                        .key
                                      ]
                                    )
                                  )
                                      ? styles.pillAmber
                                      : /cancel|reject|fail/i.test(
                                        text(
                                          row[
                                          column
                                            .key
                                          ]
                                        )
                                      )
                                        ? styles.pillRed
                                        : ""
                                    }`}
                                >
                                  {text(
                                    row[
                                    column
                                      .key
                                    ]
                                  )}
                                </span>
                              ) : (
                                <span
                                  className={
                                    [
                                      "reference_no",
                                      "transaction_no",
                                      "transfer_no",
                                      "voucher_no",
                                    ].includes(
                                      column.key
                                    )
                                      ? styles.reference
                                      : ""
                                  }
                                >
                                  {text(
                                    row[
                                    column
                                      .key
                                    ]
                                  )}
                                </span>
                              )}
                            </td>
                          )
                        )}

                        <td>
                          <div
                            className={
                              styles.rowActions
                            }
                          >
                            <button
                              className={
                                styles.iconBtn
                              }
                              title="View"
                              onClick={() =>
                                setSelected(
                                  row
                                )
                              }
                            >
                              <Eye
                                size={
                                  13
                                }
                              />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  )}

                {!filtered.length ? (
                  <tr>
                    <td
                      className={
                        styles.empty
                      }
                      colSpan={
                        config
                          .columns
                          .length +
                        1
                      }
                    >
                      No records match
                      the selected
                      filters.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div
            className={
              styles.pagination
            }
          >
            <span>
              Showing 1 to{" "}
              {Math.min(
                8,
                filtered.length
              )}{" "}
              of{" "}
              {
                filtered.length
              }{" "}
              entries
            </span>

            <div
              className={
                styles.pages
              }
            >
              <button>
                ‹
              </button>

              <button
                className={
                  styles.activePage
                }
              >
                1
              </button>

              <button>
                2
              </button>

              <button>
                3
              </button>

              <span>…</span>

              <button>
                ›
              </button>
            </div>
          </div>
        </article>

        <aside
          className={
            styles.side
          }
        >
          <section
            className={
              styles.sideCard
            }
          >
            <h3>
              {mode ===
                "transactions"
                ? "Transfer Summary"
                : mode ===
                  "vouchers"
                  ? "Voucher Summary"
                  : "Ledger Summary"}
            </h3>

            <div
              className={
                styles.donutBox
              }
            >
              <div
                className={
                  styles.donut
                }
              >
                <div>
                  <strong>
                    {
                      rows.length
                    }
                  </strong>
                  <span>
                    Total
                  </span>
                </div>
              </div>

              <div
                className={
                  styles.legend
                }
              >
                <div>
                  <Dot color="#1267e8" />
                  <span>
                    Posted /
                    Credit
                  </span>
                  <b>
                    {posted}
                  </b>
                </div>

                <div>
                  <Dot color="#13a16d" />
                  <span>
                    Pending /
                    Debit
                  </span>
                  <b>
                    {pending}
                  </b>
                </div>

                <div>
                  <Dot color="#ff9d24" />
                  <span>
                    Other
                  </span>
                  <b>
                    {Math.max(
                      rows.length -
                      posted -
                      pending,
                      0
                    )}
                  </b>
                </div>
              </div>
            </div>
          </section>

          <section
            className={
              styles.sideCard
            }
          >
            <h3>
              Quick Actions
            </h3>

            <div
              className={
                styles.quick
              }
            >
              <Link href="/finance/manual-voucher">
                <span
                  className={
                    styles.quickIcon
                  }
                >
                  <Plus
                    size={13}
                  />
                </span>

                <span>
                  <b>
                    Create Voucher
                  </b>
                  <small>
                    Open Manual
                    Voucher Centre
                  </small>
                </span>

                <ArrowRight
                  size={12}
                />
              </Link>

              <button
                onClick={
                  exportRows
                }
              >
                <span
                  className={
                    styles.quickIcon
                  }
                >
                  <Download
                    size={13}
                  />
                </span>

                <span>
                  <b>
                    Export Register
                  </b>
                  <small>
                    Download
                    current view
                  </small>
                </span>

                <ArrowRight
                  size={12}
                />
              </button>

              <Link href="/finance/reports">
                <span
                  className={
                    styles.quickIcon
                  }
                >
                  <FileBarChart2
                    size={13}
                  />
                </span>

                <span>
                  <b>
                    Finance Reports
                  </b>
                  <small>
                    Open reporting
                    centre
                  </small>
                </span>

                <ArrowRight
                  size={12}
                />
              </Link>
            </div>
          </section>
        </aside>
      </section>

      {selected ? (
        <div
          className={
            styles.modalBack
          }
          onClick={() =>
            setSelected(
              null
            )
          }
        >
          <div
            className={
              styles.modal
            }
            onClick={(
              event
            ) =>
              event.stopPropagation()
            }
          >
            <div
              className={
                styles.modalHead
              }
            >
              <div>
                <h2>
                  {
                    config.title
                  }{" "}
                  Details
                </h2>

                <div
                  className={
                    styles.muted
                  }
                >
                  Recorded finance
                  information
                </div>
              </div>

              <button
                className={
                  styles.close
                }
                onClick={() =>
                  setSelected(
                    null
                  )
                }
              >
                <X
                  size={15}
                />
              </button>
            </div>

            <div
              className={
                styles.detailGrid
              }
            >
              {config.columns.map(
                (
                  column
                ) => (
                  <div
                    className={
                      styles.detail
                    }
                    key={
                      column.key
                    }
                  >
                    <span>
                      {
                        column.label
                      }
                    </span>

                    <strong>
                      {column.format ===
                        "money"
                        ? money(
                          selected[
                          column
                            .key
                          ]
                        )
                        : column.format ===
                          "date"
                          ? date(
                            selected[
                            column
                              .key
                            ]
                          )
                          : text(
                            selected[
                            column
                              .key
                            ]
                          )}
                    </strong>
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      ) : null}

      {transferOpen ? (
        <div
          className={
            styles.modalBack
          }
          onClick={() =>
            setTransferOpen(
              false
            )
          }
        >
          <form
            className={
              styles.modal
            }
            onSubmit={
              postTransfer
            }
            onClick={(
              event
            ) =>
              event.stopPropagation()
            }
          >
            <div
              className={
                styles.modalHead
              }
            >
              <div>
                <h2>
                  New Account
                  Transfer
                </h2>

                <div
                  className={
                    styles.muted
                  }
                >
                  Controlled
                  transfer between
                  authorised IET
                  bank accounts
                </div>
              </div>

              <button
                type="button"
                className={
                  styles.close
                }
                onClick={() =>
                  setTransferOpen(
                    false
                  )
                }
              >
                <X
                  size={15}
                />
              </button>
            </div>

            <div
              className={
                styles.formGrid
              }
            >
              <label>
                <span>
                  Source Account
                </span>

                <select
                  value={
                    sourceId
                  }
                  onChange={(
                    event
                  ) =>
                    setSourceId(
                      event
                        .target
                        .value
                    )
                  }
                  required
                >
                  <option value="">
                    Select source
                  </option>

                  {accounts.map(
                    (
                      account,
                      index
                    ) => {
                      const id =
                        rawText(
                          account.id
                        );

                      const name =
                        rawText(
                          account.name ??
                          account.account_name ??
                          account.bank_name
                        ) ||
                        "IET Account";

                      return (
                        <option
                          key={
                            id ||
                            `source-${index}`
                          }
                          value={
                            id
                          }
                        >
                          {name}
                        </option>
                      );
                    }
                  )}
                </select>
              </label>

              <label>
                <span>
                  Destination
                  Account
                </span>

                <select
                  value={
                    destinationId
                  }
                  onChange={(
                    event
                  ) =>
                    setDestinationId(
                      event
                        .target
                        .value
                    )
                  }
                  required
                >
                  <option value="">
                    Select
                    destination
                  </option>

                  {accounts.map(
                    (
                      account,
                      index
                    ) => {
                      const id =
                        rawText(
                          account.id
                        );

                      const name =
                        rawText(
                          account.name ??
                          account.account_name ??
                          account.bank_name
                        ) ||
                        "IET Account";

                      return (
                        <option
                          key={
                            id ||
                            `destination-${index}`
                          }
                          value={
                            id
                          }
                        >
                          {name}
                        </option>
                      );
                    }
                  )}
                </select>
              </label>

              <label>
                <span>
                  Amount (₦)
                </span>

                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={amount}
                  onChange={(
                    event
                  ) =>
                    setAmount(
                      event
                        .target
                        .value
                    )
                  }
                  required
                />
              </label>

              <label>
                <span>
                  External
                  Reference
                </span>

                <input
                  value={
                    reference
                  }
                  onChange={(
                    event
                  ) =>
                    setReference(
                      event
                        .target
                        .value
                    )
                  }
                  placeholder="Optional"
                />
              </label>

              <label
                className={
                  styles.full
                }
              >
                <span>
                  Narration
                </span>

                <textarea
                  value={
                    narration
                  }
                  onChange={(
                    event
                  ) =>
                    setNarration(
                      event
                        .target
                        .value
                    )
                  }
                  required
                  placeholder="Reason for transfer"
                />
              </label>
            </div>

            <div
              className={
                styles.modalFoot
              }
            >
              <button
                type="button"
                className={
                  styles.secondary
                }
                onClick={() =>
                  setTransferOpen(
                    false
                  )
                }
              >
                Cancel
              </button>

              <button
                className={
                  styles.primary
                }
                type="submit"
                disabled={
                  posting
                }
              >
                <Send
                  size={13}
                />

                {posting
                  ? "Posting…"
                  : "Post Transfer"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </main>
  );
}

function ReportsPage({
  rows,
}: {
  rows: Row[];
}) {
  const reportCards = [
    [
      "Trial Balance",
      "Account ledger balances",
      "/finance/account-ledger",
      FileText,
    ],
    [
      "Monthly Finance",
      "Monthly transaction summary",
      "/finance/reports/monthly",
      FileBarChart2,
    ],
    [
      "Annual Finance",
      "Annual finance summary",
      "/finance/reports/annual",
      FileSpreadsheet,
    ],
    [
      "Transactions",
      "Posted transaction register",
      "/finance/transactions",
      Banknote,
    ],
    [
      "Account Ledger",
      "Detailed account ledger",
      "/finance/account-ledger",
      BookOpen,
    ],
    [
      "Subhead Ledger",
      "Detailed subhead ledger",
      "/finance/subhead-ledger",
      FileBarChart2,
    ],
    [
      "Voucher Register",
      "Finance voucher register",
      "/finance/vouchers",
      CalendarDays,
    ],
    [
      "Account Transfers",
      "Transfer register",
      "/finance/account-transfers",
      WalletCards,
    ],
  ] as const;

  const postedRows =
    rows.filter((row) =>
      /posted|paid|complete|success|approved/i.test(
        text(
          row.status ??
          row.transaction_type
        )
      )
    );

  const now =
    new Date();

  const currentMonth =
    now.getMonth();

  const currentYear =
    now.getFullYear();

  const monthRows =
    rows.filter((row) => {
      const parsed =
        parseDateValue(
          row.transaction_date ??
          row.created_at
        );

      return (
        !!parsed &&
        parsed.getMonth() ===
        currentMonth &&
        parsed.getFullYear() ===
        currentYear
      );
    });

  return (
    <main
      className={styles.page}
    >
      <header
        className={
          styles.header
        }
      >
        <div>
          <div
            className={
              styles.crumb
            }
          >
            Finance{" "}
            <span>›</span>{" "}
            <b>
              Finance Reports
            </b>
          </div>

          <h1>
            Finance Reports
          </h1>

          <p>
            Generate supported
            financial outputs
            from recorded ReqGen
            finance data.
          </p>
        </div>
      </header>

      <section
        className={
          styles.kpis
        }
      >
        {[
          [
            "Report Templates",
            reportCards.length,
            "Available outputs",
          ],
          [
            "Posted Transactions",
            postedRows.length,
            "Eligible for official reports",
          ],
          [
            "This Month",
            monthRows.length,
            "Recorded transactions",
          ],
          [
            "Export Centres",
            2,
            "PDF / spreadsheet routes",
          ],
        ].map(
          (
            [
              label,
              value,
              note,
            ],
            index
          ) => (
            <article
              className={
                styles.kpi
              }
              key={String(
                label
              )}
            >
              <div
                className={
                  styles.kpiIcon
                }
              >
                {index ===
                  0 ? (
                  <FileText
                    size={19}
                  />
                ) : index ===
                  1 ? (
                  <FileBarChart2
                    size={19}
                  />
                ) : index ===
                  2 ? (
                  <CalendarDays
                    size={19}
                  />
                ) : (
                  <BookOpen
                    size={19}
                  />
                )}
              </div>

              <div>
                <span>
                  {label}
                </span>

                <strong>
                  {value}
                </strong>

                <small>
                  {note}
                </small>
              </div>
            </article>
          )
        )}
      </section>

      <section
        className={
          styles.reportPanel
        }
      >
        <div
          className={
            styles.panelHead
          }
        >
          <div>
            <h2>
              Popular Reports
            </h2>

            <small>
              Outputs supported
              by existing ReqGen
              finance routes
            </small>
          </div>
        </div>

        <div
          className={
            styles.reportCards
          }
        >
          {reportCards.map(
            ([
              title,
              sub,
              href,
              Icon,
            ]) => (
              <Link
                href={href}
                className={
                  styles.reportCard
                }
                key={
                  title
                }
              >
                <span
                  className={
                    styles.reportIcon
                  }
                >
                  <Icon
                    size={17}
                  />
                </span>

                <span>
                  <b>
                    {title}
                  </b>

                  <small>
                    {sub}
                  </small>
                </span>

                <span
                  className={
                    styles.generate
                  }
                >
                  Open
                </span>
              </Link>
            )
          )}
        </div>
      </section>

      <section
        className={
          styles.grid
        }
      >
        <article
          className={
            styles.panel
          }
        >
          <div
            className={
              styles.panelHead
            }
          >
            <div>
              <h2>
                Report Data
                Readiness
              </h2>

              <small>
                Live recorded
                sources used by
                the reporting
                pages
              </small>
            </div>
          </div>

          <div
            className={
              styles.tableWrap
            }
          >
            <table
              className={
                styles.table
              }
            >
              <thead>
                <tr>
                  <th>
                    Source
                  </th>
                  <th>
                    Records
                  </th>
                  <th>
                    Use
                  </th>
                  <th>
                    Status
                  </th>
                </tr>
              </thead>

              <tbody>
                <tr>
                  <td
                    className={
                      styles.reference
                    }
                  >
                    Finance
                    Transactions
                  </td>
                  <td>
                    {
                      rows.length
                    }
                  </td>
                  <td>
                    Monthly,
                    annual and
                    transaction
                    outputs
                  </td>
                  <td>
                    <span
                      className={
                        styles.pill
                      }
                    >
                      Available
                    </span>
                  </td>
                </tr>

                <tr>
                  <td
                    className={
                      styles.reference
                    }
                  >
                    Posted
                    Transactions
                  </td>
                  <td>
                    {
                      postedRows.length
                    }
                  </td>
                  <td>
                    Official
                    finance
                    reporting base
                  </td>
                  <td>
                    <span
                      className={
                        styles.pill
                      }
                    >
                      Available
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </article>

        <aside
          className={
            styles.side
          }
        >
          <section
            className={`${styles.sideCard} ${styles.note}`}
          >
            <h3>
              Important Note
            </h3>

            <p>
              Reports use
              recorded ReqGen
              data only. No
              synthetic report
              history, totals or
              generated-by values
              are created by this
              page.
            </p>
          </section>
        </aside>
      </section>
    </main>
  );
}

function MonthlyPage({
  months,
  totalValue,
  exportRows,
  refreshing,
  load,
}: {
  months: MonthSummary[];
  totalValue: number;
  exportRows: () => void;
  refreshing: boolean;
  load: (
    manual?: boolean
  ) => Promise<void>;
}) {
  const completed =
    months.filter(
      (month) =>
        month.status ===
        "Completed"
    ).length;

  const pending =
    Math.max(
      months.length -
      completed,
      0
    );

  const max =
    Math.max(
      ...months
        .slice(
          0,
          12
        )
        .map((month) =>
          Math.max(
            month.income,
            month.expense
          )
        ),
      1
    );

  const currentYear =
    new Date().getFullYear();

  return (
    <main
      className={styles.page}
    >
      <header
        className={
          styles.header
        }
      >
        <div>
          <div
            className={
              styles.crumb
            }
          >
            Finance{" "}
            <span>›</span>{" "}
            <b>
              Monthly Reports
            </b>
          </div>

          <h1>
            Monthly Reports
          </h1>

          <p>
            View and compare
            monthly financial
            reports.
          </p>
        </div>

        <div
          className={
            styles.actions
          }
        >
          <select
            className={
              styles.yearSelect
            }
            defaultValue={
              String(
                currentYear
              )
            }
          >
            <option
              value={String(
                currentYear
              )}
            >
              {currentYear}
            </option>
          </select>
        </div>
      </header>

      <section
        className={
          styles.kpis
        }
      >
        {[
          [
            "Total Months",
            months.length,
          ],
          [
            "Completed Months",
            completed,
          ],
          [
            "Pending Months",
            pending,
          ],
          [
            "Total Reports",
            months.reduce(
              (
                sum,
                month
              ) =>
                sum +
                month.count,
              0
            ),
          ],
        ].map(
          (
            [
              label,
              value,
            ],
            index
          ) => (
            <article
              className={
                styles.kpi
              }
              key={String(
                label
              )}
            >
              <div
                className={
                  styles.kpiIcon
                }
              >
                {index ===
                  0 ? (
                  <CalendarDays
                    size={19}
                  />
                ) : index ===
                  1 ? (
                  <FileText
                    size={19}
                  />
                ) : index ===
                  2 ? (
                  <RefreshCw
                    size={19}
                  />
                ) : (
                  <FileBarChart2
                    size={19}
                  />
                )}
              </div>

              <div>
                <span>
                  {label}
                </span>

                <strong>
                  {value}
                </strong>

                <small>
                  {index ===
                    3
                    ? money(
                      totalValue
                    )
                    : String(
                      currentYear
                    )}
                </small>
              </div>
            </article>
          )
        )}
      </section>

      <section
        className={
          styles.grid
        }
      >
        <article
          className={
            styles.panel
          }
        >
          <div
            className={
              styles.panelHead
            }
          >
            <div>
              <h2>
                Monthly Reports
                - {currentYear}
              </h2>

              <small>
                Generated
                financial
                activity by month
              </small>
            </div>

            <div
              className={
                styles.panelTools
              }
            >
              <button
                onClick={() =>
                  void load(
                    true
                  )
                }
                disabled={
                  refreshing
                }
              >
                <RefreshCw
                  size={12}
                />
                Refresh
              </button>

              <button
                onClick={
                  exportRows
                }
              >
                <Download
                  size={12}
                />
                Export
              </button>
            </div>
          </div>

          <div
            className={
              styles.tableWrap
            }
          >
            <table
              className={
                styles.table
              }
            >
              <thead>
                <tr>
                  <th>
                    Month
                  </th>
                  <th>
                    Status
                  </th>
                  <th>
                    Reports
                    Generated
                  </th>
                  <th>
                    Generated On
                  </th>
                  <th>
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody>
                {months
                  .slice(
                    0,
                    12
                  )
                  .map(
                    (
                      month
                    ) => (
                      <tr
                        key={
                          month.key
                        }
                      >
                        <td
                          className={
                            styles.reference
                          }
                        >
                          {
                            month.month
                          }
                        </td>

                        <td>
                          <span
                            className={
                              styles.pill
                            }
                          >
                            {
                              month.status
                            }
                          </span>
                        </td>

                        <td>
                          {
                            month.count
                          }
                        </td>

                        <td>
                          {date(
                            month.latest
                          )}
                        </td>

                        <td>
                          <div
                            className={
                              styles.rowActions
                            }
                          >
                            <button
                              className={
                                styles.iconBtn
                              }
                              type="button"
                            >
                              <Eye
                                size={
                                  13
                                }
                              />
                            </button>

                            <button
                              className={
                                styles.iconBtn
                              }
                              onClick={
                                exportRows
                              }
                              type="button"
                            >
                              <Download
                                size={
                                  13
                                }
                              />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  )}

                {!months.length ? (
                  <tr>
                    <td
                      colSpan={5}
                      className={
                        styles.empty
                      }
                    >
                      No monthly
                      finance
                      activity is
                      available
                      yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </article>

        <aside
          className={
            styles.side
          }
        >
          <section
            className={
              styles.sideCard
            }
          >
            <h3>
              Monthly Summary
            </h3>

            <div
              className={
                styles.barChart
              }
            >
              {months
                .slice(
                  0,
                  12
                )
                .reverse()
                .map(
                  (
                    month
                  ) => (
                    <div
                      className={
                        styles.barGroup
                      }
                      key={
                        month.key
                      }
                      title={
                        month.month
                      }
                    >
                      <i
                        style={{
                          height: `${Math.max(
                            5,
                            (month.income /
                              max) *
                            100
                          )}%`,
                        }}
                      />

                      <b
                        style={{
                          height: `${Math.max(
                            5,
                            (month.expense /
                              max) *
                            100
                          )}%`,
                        }}
                      />

                      <span>
                        {month.month.slice(
                          0,
                          1
                        )}
                      </span>
                    </div>
                  )
                )}
            </div>

            <div
              className={
                styles.chartLegend
              }
            >
              <span>
                <Dot color="#1267e8" />
                Income
              </span>

              <span>
                <Dot color="#13a16d" />
                Expense
              </span>
            </div>
          </section>

          <section
            className={
              styles.sideCard
            }
          >
            <h3>
              Quick Actions
            </h3>

            <div
              className={
                styles.quick
              }
            >
              <Link href="/reports">
                <span
                  className={
                    styles.quickIcon
                  }
                >
                  <Plus
                    size={13}
                  />
                </span>

                <span>
                  <b>
                    Generate This
                    Month
                  </b>

                  <small>
                    Create report
                    output
                  </small>
                </span>

                <ArrowRight
                  size={12}
                />
              </Link>

              <button
                onClick={
                  exportRows
                }
              >
                <span
                  className={
                    styles.quickIcon
                  }
                >
                  <Download
                    size={13}
                  />
                </span>

                <span>
                  <b>
                    Export Monthly
                    Data
                  </b>

                  <small>
                    Download CSV
                  </small>
                </span>

                <ArrowRight
                  size={12}
                />
              </button>
            </div>
          </section>
        </aside>
      </section>

      <section
        className={`${styles.sideCard} ${styles.note}`}
      >
        <h3>
          Important Note
        </h3>

        <p>
          Only posted
          transactions are
          included in monthly
          reports.
        </p>
      </section>
    </main>
  );
}
