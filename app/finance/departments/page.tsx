"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  CheckCircle2,
  PauseCircle,
  Network,
  Search,
  Filter,
  Download,
  RefreshCw,
  Eye,
  Pencil,
  MoreVertical,
  Plus,
  X,
  Save,
  Power,
  Trash2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  FolderTree,
  FileDown,
} from "lucide-react";

import { supabase } from "@/lib/supabaseClient";
import { exportTableToExcel } from "@/lib/reportExport";
import styles from "./finance-departments.module.css";

type Dept = {
  id: string;
  name: string;
  created_at: string | null;
  is_active: boolean | null;
  hod_user_id?: string | null;
  director_user_id?: string | null;
  request_count?: number;
  subhead_count?: number;
  profile_count?: number;
};

type ProfileMini = {
  role: string | null;
};

type DeptIdRow = {
  dept_id: string | null;
};

type StatusFilter = "all" | "active" | "inactive";

function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Unknown error";
}

function roleKey(role: string | null | undefined) {
  return (role || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/_/g, "");
}

function shortDate(value: string | null | undefined) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function linkedTotal(department: Dept) {
  return (
    Number(department.request_count || 0) +
    Number(department.subhead_count || 0) +
    Number(department.profile_count || 0)
  );
}

function canHardDeleteDepartment(department: Dept) {
  return linkedTotal(department) === 0;
}

function departmentCode(name: string, index: number) {
  const cleaned = name
    .replace(/[^A-Za-z0-9 ]/g, " ")
    .trim();

  const words = cleaned
    .split(/\s+/)
    .filter(Boolean);

  const base =
    words.length > 1
      ? words.map((word) => word[0]).join("")
      : cleaned.slice(0, 3);

  return (
    base.toUpperCase().slice(0, 4) ||
    `D${index + 1}`
  );
}

export default function DepartmentsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [myRole, setMyRole] = useState("Staff");

  const canManage = ["admin", "auditor"].includes(
    roleKey(myRole)
  );

  const [rows, setRows] = useState<Dept[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [hasSubheads, setHasSubheads] = useState("all");
  const [page, setPage] = useState(1);

  const pageSize = 10;

  const [formOpen, setFormOpen] = useState(false);
  const [selected, setSelected] = useState<Dept | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [active, setActive] = useState(true);

  const load = useCallback(
    async (silent = false) => {
      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setMessage(null);

      try {
        const { data: auth } =
          await supabase.auth.getUser();

        if (!auth.user) {
          router.push("/login");
          return;
        }

        const {
          data: prof,
          error: profErr,
        } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", auth.user.id)
          .maybeSingle();

        if (profErr) {
          throw new Error(profErr.message);
        }

        setMyRole(
          (prof as ProfileMini | null)?.role ||
          "Staff"
        );

        const {
          data: deptRows,
          error: deptErr,
        } = await supabase
          .from("departments")
          .select(
            "id,name,created_at,is_active,hod_user_id,director_user_id"
          )
          .order("name", {
            ascending: true,
          });

        if (deptErr) {
          throw new Error(deptErr.message);
        }

        const base =
          (deptRows || []) as Dept[];

        const requestCount: Record<string, number> = {};
        const subheadCount: Record<string, number> = {};
        const profileCount: Record<string, number> = {};

        if (base.length) {
          const [
            requestRes,
            subheadRes,
            profileRes,
          ] = await Promise.all([
            supabase
              .from("requests")
              .select("dept_id")
              .not("dept_id", "is", null),

            supabase
              .from("subheads")
              .select("dept_id")
              .not("dept_id", "is", null),

            supabase
              .from("profiles")
              .select("dept_id")
              .not("dept_id", "is", null),
          ]);

          ((requestRes.data || []) as DeptIdRow[]).forEach(
            (row) => {
              if (row.dept_id) {
                requestCount[row.dept_id] =
                  (requestCount[row.dept_id] || 0) + 1;
              }
            }
          );

          ((subheadRes.data || []) as DeptIdRow[]).forEach(
            (row) => {
              if (row.dept_id) {
                subheadCount[row.dept_id] =
                  (subheadCount[row.dept_id] || 0) + 1;
              }
            }
          );

          ((profileRes.data || []) as DeptIdRow[]).forEach(
            (row) => {
              if (row.dept_id) {
                profileCount[row.dept_id] =
                  (profileCount[row.dept_id] || 0) + 1;
              }
            }
          );
        }

        setRows(
          base.map((department) => ({
            ...department,
            is_active:
              department.is_active !== false,
            request_count:
              requestCount[department.id] || 0,
            subhead_count:
              subheadCount[department.id] || 0,
            profile_count:
              profileCount[department.id] || 0,
          }))
        );
      } catch (error: unknown) {
        setMessage(
          `Unable to load finance departments: ${errorMessage(
            error
          )}`
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [router]
  );

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  const stats = useMemo(() => {
    const total = rows.length;

    const activeCount = rows.filter(
      (department) =>
        department.is_active !== false
    ).length;

    const inactiveCount =
      total - activeCount;

    const withSubheads = rows.filter(
      (department) =>
        Number(department.subhead_count || 0) > 0
    ).length;

    return {
      total,
      activeCount,
      inactiveCount,
      withSubheads,
    };
  }, [rows]);

  const filtered = useMemo(() => {
    const term = search
      .trim()
      .toLowerCase();

    return rows.filter((department) => {
      const matchesTerm =
        !term ||
        [
          department.name,
          department.is_active === false
            ? "inactive"
            : "active",
          String(department.request_count || 0),
          String(department.subhead_count || 0),
          String(department.profile_count || 0),
        ]
          .join(" ")
          .toLowerCase()
          .includes(term);

      const matchesStatus =
        status === "all" ||
        (status === "active"
          ? department.is_active !== false
          : department.is_active === false);

      const matchesSubheads =
        hasSubheads === "all" ||
        (hasSubheads === "yes"
          ? Number(department.subhead_count || 0) > 0
          : Number(department.subhead_count || 0) === 0);

      return (
        matchesTerm &&
        matchesStatus &&
        matchesSubheads
      );
    });
  }, [
    rows,
    search,
    status,
    hasSubheads,
  ]);

  useEffect(() => {
    queueMicrotask(() => {
      setPage(1);
    });
  }, [
    search,
    status,
    hasSubheads,
  ]);

  const pageCount = Math.max(
    1,
    Math.ceil(filtered.length / pageSize)
  );

  const safePage = Math.min(
    page,
    pageCount
  );

  const pagedRows = filtered.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize
  );

  const overview = useMemo(
    () => ({
      active: rows.filter(
        (department) =>
          department.is_active !== false
      ).length,

      inactive: rows.filter(
        (department) =>
          department.is_active === false
      ).length,

      withSubheads: rows.filter(
        (department) =>
          Number(department.subhead_count || 0) > 0
      ).length,

      withStaff: rows.filter(
        (department) =>
          Number(department.profile_count || 0) > 0
      ).length,
    }),
    [rows]
  );

  const donut = useMemo(() => {
    const total = Math.max(
      1,
      rows.length
    );

    const activePct =
      (overview.active / total) * 100;

    return `conic-gradient(#1267e8 0 ${activePct}%, #98a2b3 ${activePct}% 100%)`;
  }, [
    overview,
    rows.length,
  ]);

  function openCreate() {
    setEditId(null);
    setName("");
    setActive(true);
    setFormOpen(true);
  }

  function openEdit(department: Dept) {
    setEditId(department.id);
    setName(department.name);
    setActive(
      department.is_active !== false
    );
    setFormOpen(true);
  }

  async function save() {
    if (!canManage) {
      setMessage(
        "You do not have permission to manage departments."
      );
      return;
    }

    if (name.trim().length < 2) {
      setMessage(
        "Department name must contain at least two characters."
      );
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      if (editId) {
        const { error } = await supabase
          .from("departments")
          .update({
            name: name.trim(),
            is_active: active,
          })
          .eq("id", editId);

        if (error) {
          throw new Error(error.message);
        }

        setMessage(
          "Department updated successfully."
        );
      } else {
        const { error } = await supabase
          .from("departments")
          .insert({
            name: name.trim(),
            is_active: active,
          });

        if (error) {
          throw new Error(error.message);
        }

        setMessage(
          "Department created successfully."
        );
      }

      setFormOpen(false);

      await load(true);

      router.refresh();
    } catch (error: unknown) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to save department."
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(
    department: Dept
  ) {
    if (!canManage) {
      setMessage(
        "You do not have permission to manage departments."
      );
      return;
    }

    setSaving(true);

    try {
      const nextActive =
        department.is_active === false;

      const { error } = await supabase
        .from("departments")
        .update({
          is_active: nextActive,
        })
        .eq("id", department.id);

      if (error) {
        throw new Error(error.message);
      }

      setMessage(
        nextActive
          ? "Department activated."
          : "Department deactivated."
      );

      await load(true);
    } catch (error: unknown) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to update department status."
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteOrDeactivate(
    department: Dept
  ) {
    if (!canManage) {
      setMessage(
        "You do not have permission to manage departments."
      );
      return;
    }

    if (
      !canHardDeleteDepartment(
        department
      )
    ) {
      const confirmed = window.confirm(
        "This department has linked records. Deactivate it instead?"
      );

      if (!confirmed) {
        return;
      }

      if (
        department.is_active !== false
      ) {
        await toggleActive(
          department
        );
      }

      return;
    }

    const confirmed = window.confirm(
      "Delete this unused department permanently?"
    );

    if (!confirmed) {
      return;
    }

    setSaving(true);

    try {
      const { error } = await supabase
        .from("departments")
        .delete()
        .eq("id", department.id);

      if (error) {
        throw new Error(error.message);
      }

      setMessage(
        "Unused department deleted successfully."
      );

      await load(true);
    } catch (error: unknown) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to delete department."
      );
    } finally {
      setSaving(false);
    }
  }

  function exportDepartments() {
    setExporting(true);

    try {
      exportTableToExcel({
        fileName:
          "finance_departments",

        sheetName:
          "Departments",

        title:
          "Finance Departments Register",

        subtitle:
          "ReqGen 1.1.0 — Islamic Education Trust",

        rows:
          filtered,

        columns: [
          {
            header:
              "Code",
            value:
              (department, index) =>
                departmentCode(
                  department.name,
                  index
                ),
          },
          {
            header:
              "Department Name",
            value:
              (department) =>
                department.name,
          },
          {
            header:
              "Status",
            value:
              (department) =>
                department.is_active === false
                  ? "Inactive"
                  : "Active",
          },
          {
            header:
              "No. of Subheads",
            value:
              (department) =>
                Number(
                  department.subhead_count || 0
                ),
          },
          {
            header:
              "Staff",
            value:
              (department) =>
                Number(
                  department.profile_count || 0
                ),
          },
          {
            header:
              "Requests",
            value:
              (department) =>
                Number(
                  department.request_count || 0
                ),
          },
          {
            header:
              "Created",
            value:
              (department) =>
                shortDate(
                  department.created_at
                ),
          },
        ],
      });
    } finally {
      setExporting(false);
    }
  }

  if (loading) {
    return (
      <div className={styles.loading}>
        Loading Finance Departments…
      </div>
    );
  }

  return (
    <main className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <div className={styles.breadcrumb}>
            Finance <span>›</span>{" "}
            <b>Finance Departments</b>
          </div>

          <h1>
            Finance Departments
          </h1>

          <p>
            Manage organizational departments for budgeting and financial operations.
          </p>
        </div>

        <button
          className={styles.primaryButton}
          onClick={openCreate}
          disabled={
            !canManage ||
            saving
          }
        >
          <Plus size={16} />
          Create New Department
        </button>
      </header>

      {message ? (
        <div className={styles.messageBar}>
          <span>
            {message}
          </span>

          <button
            onClick={() =>
              setMessage(null)
            }
            aria-label="Dismiss"
          >
            <X size={16} />
          </button>
        </div>
      ) : null}

      <section className={styles.kpiGrid}>
        <Kpi
          icon={<Building2 size={23} />}
          tone="blue"
          title="Total Departments"
          value={stats.total}
          detail="All Departments"
        />

        <Kpi
          icon={<CheckCircle2 size={23} />}
          tone="green"
          title="Active Departments"
          value={stats.activeCount}
          detail={`${stats.total
              ? (
                (stats.activeCount /
                  stats.total) *
                100
              ).toFixed(1)
              : "0.0"
            }% of total departments`}
        />

        <Kpi
          icon={<PauseCircle size={23} />}
          tone="orange"
          title="Inactive Departments"
          value={stats.inactiveCount}
          detail={`${stats.total
              ? (
                (stats.inactiveCount /
                  stats.total) *
                100
              ).toFixed(1)
              : "0.0"
            }% of total departments`}
        />

        <Kpi
          icon={<Network size={23} />}
          tone="purple"
          title="With Subheads"
          value={stats.withSubheads}
          detail={`${stats.total
              ? (
                (stats.withSubheads /
                  stats.total) *
                100
              ).toFixed(1)
              : "0.0"
            }% of departments`}
        />
      </section>

      <section className={styles.filterCard}>
        <label className={styles.filterField}>
          <span>
            Search Department
          </span>

          <div className={styles.searchBox}>
            <Search size={15} />

            <input
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value
                )
              }
              placeholder="Search by name or status…"
            />
          </div>
        </label>

        <label className={styles.filterField}>
          <span>
            Status
          </span>

          <select
            value={status}
            onChange={(event) =>
              setStatus(
                event.target.value as StatusFilter
              )
            }
          >
            <option value="all">
              All Statuses
            </option>

            <option value="active">
              Active
            </option>

            <option value="inactive">
              Inactive
            </option>
          </select>
        </label>

        <label className={styles.filterField}>
          <span>
            Subheads
          </span>

          <select
            value={hasSubheads}
            onChange={(event) =>
              setHasSubheads(
                event.target.value
              )
            }
          >
            <option value="all">
              All Departments
            </option>

            <option value="yes">
              With Subheads
            </option>

            <option value="no">
              Without Subheads
            </option>
          </select>
        </label>

        <label className={styles.filterField}>
          <span>
            Date Range
          </span>

          <input
            value="All Records"
            readOnly
          />
        </label>

        <button
          className={styles.moreFilters}
          onClick={() => {
            setSearch("");
            setStatus("all");
            setHasSubheads("all");
          }}
        >
          <Filter size={15} />
          Reset Filters
        </button>
      </section>

      <section className={styles.contentGrid}>
        <div className={styles.tableCard}>
          <div className={styles.cardHeader}>
            <h2>
              Departments ({filtered.length})
            </h2>

            <div className={styles.cardActions}>
              <button
                onClick={exportDepartments}
                disabled={exporting}
              >
                <Download size={14} />
                {exporting
                  ? "Exporting…"
                  : "Export XLS"}
              </button>

              <button
                className={styles.iconButton}
                onClick={() =>
                  void load(true)
                }
                disabled={refreshing}
                aria-label="Refresh"
              >
                <RefreshCw
                  size={14}
                  className={
                    refreshing
                      ? styles.spin
                      : ""
                  }
                />
              </button>
            </div>
          </div>

          <div className={styles.tableWrap}>
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Code</th>
                  <th>Department Name</th>
                  <th>Staff</th>
                  <th>Requests</th>
                  <th>Status</th>
                  <th>No. of Subheads</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {pagedRows.map(
                  (department, index) => (
                    <tr key={department.id}>
                      <td>
                        {(safePage - 1) *
                          pageSize +
                          index +
                          1}
                      </td>

                      <td className={styles.codeCell}>
                        {departmentCode(
                          department.name,
                          (safePage - 1) *
                          pageSize +
                          index
                        )}
                      </td>

                      <td>
                        <div className={styles.nameCell}>
                          <strong>
                            {department.name}
                          </strong>

                          <small>
                            {Number(
                              department.profile_count || 0
                            )}{" "}
                            staff ·{" "}
                            {Number(
                              department.request_count || 0
                            )}{" "}
                            requests
                          </small>
                        </div>
                      </td>

                      <td className={styles.centerCell}>
                        {Number(
                          department.profile_count || 0
                        )}
                      </td>

                      <td className={styles.centerCell}>
                        {Number(
                          department.request_count || 0
                        )}
                      </td>

                      <td>
                        <StatusPill
                          active={
                            department.is_active !== false
                          }
                        />
                      </td>

                      <td className={styles.centerCell}>
                        {Number(
                          department.subhead_count || 0
                        )}
                      </td>

                      <td>
                        <div className={styles.rowActions}>
                          <button
                            onClick={() =>
                              setSelected(
                                department
                              )
                            }
                            aria-label={`View ${department.name}`}
                          >
                            <Eye size={14} />
                          </button>

                          <button
                            onClick={() =>
                              openEdit(
                                department
                              )
                            }
                            disabled={
                              !canManage ||
                              saving
                            }
                            aria-label={`Edit ${department.name}`}
                          >
                            <Pencil size={14} />
                          </button>

                          <div className={styles.moreMenu}>
                            <button aria-label="More actions">
                              <MoreVertical size={14} />
                            </button>

                            <div className={styles.moreMenuPanel}>
                              <button
                                onClick={() =>
                                  void toggleActive(
                                    department
                                  )
                                }
                                disabled={
                                  !canManage ||
                                  saving
                                }
                              >
                                <Power size={13} />
                                {department.is_active === false
                                  ? "Activate"
                                  : "Deactivate"}
                              </button>

                              <button
                                onClick={() =>
                                  void deleteOrDeactivate(
                                    department
                                  )
                                }
                                disabled={
                                  !canManage ||
                                  saving
                                }
                              >
                                <Trash2 size={13} />
                                {canHardDeleteDepartment(
                                  department
                                )
                                  ? "Delete"
                                  : "Deactivate"}
                              </button>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )
                )}

                {pagedRows.length === 0 ? (
                  <tr>
                    <td colSpan={8}>
                      <div className={styles.empty}>
                        No departments match the selected filters.
                      </div>
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className={styles.pagination}>
            <span>
              Showing{" "}
              {filtered.length
                ? (safePage - 1) * pageSize + 1
                : 0}{" "}
              to{" "}
              {Math.min(
                safePage * pageSize,
                filtered.length
              )}{" "}
              of {filtered.length} departments
            </span>

            <div>
              <button
                onClick={() =>
                  setPage(1)
                }
                disabled={
                  safePage === 1
                }
              >
                <ChevronsLeft size={14} />
              </button>

              <button
                onClick={() =>
                  setPage((current) =>
                    Math.max(
                      1,
                      current - 1
                    )
                  )
                }
                disabled={
                  safePage === 1
                }
              >
                <ChevronLeft size={14} />
              </button>

              {Array.from(
                {
                  length: Math.min(
                    5,
                    pageCount
                  ),
                },
                (_, index) => {
                  const start = Math.max(
                    1,
                    Math.min(
                      safePage - 2,
                      pageCount - 4
                    )
                  );

                  const value =
                    start + index;

                  return value <= pageCount ? (
                    <button
                      key={value}
                      className={
                        value === safePage
                          ? styles.currentPage
                          : ""
                      }
                      onClick={() =>
                        setPage(value)
                      }
                    >
                      {value}
                    </button>
                  ) : null;
                }
              )}

              <button
                onClick={() =>
                  setPage((current) =>
                    Math.min(
                      pageCount,
                      current + 1
                    )
                  )
                }
                disabled={
                  safePage === pageCount
                }
              >
                <ChevronRight size={14} />
              </button>

              <button
                onClick={() =>
                  setPage(pageCount)
                }
                disabled={
                  safePage === pageCount
                }
              >
                <ChevronsRight size={14} />
              </button>
            </div>
          </div>
        </div>

        <aside className={styles.sideColumn}>
          <div className={styles.sideCard}>
            <h3>
              Department Overview
            </h3>

            <div className={styles.donutRow}>
              <div
                className={styles.donut}
                style={{
                  background: donut,
                }}
              >
                <div>
                  <strong>
                    {rows.length}
                  </strong>

                  <span>
                    Total
                  </span>
                </div>
              </div>

              <div className={styles.legend}>
                <Legend
                  color="#1267e8"
                  label="Active Departments"
                  value={overview.active}
                  total={rows.length}
                />

                <Legend
                  color="#98a2b3"
                  label="Inactive Departments"
                  value={overview.inactive}
                  total={rows.length}
                />

                <Legend
                  color="#17a66b"
                  label="With Subheads"
                  value={overview.withSubheads}
                  total={rows.length}
                />

                <Legend
                  color="#7c3aed"
                  label="With Staff"
                  value={overview.withStaff}
                  total={rows.length}
                />
              </div>
            </div>
          </div>

          <div className={styles.sideCard}>
            <h3>
              Quick Actions
            </h3>

            <QuickAction
              icon={<Plus size={15} />}
              tone="blue"
              title="Create New Department"
              detail="Add a new department"
              onClick={openCreate}
            />

            <QuickAction
              icon={<FolderTree size={15} />}
              tone="purple"
              title="View Department Structure"
              detail="Review departments and linked subheads"
              onClick={() =>
                setHasSubheads("yes")
              }
            />

            <QuickAction
              icon={<Network size={15} />}
              tone="purple"
              title="View Finance Subheads"
              detail="Open the subheads register"
              onClick={() =>
                router.push(
                  "/finance/subheads"
                )
              }
            />

            <QuickAction
              icon={<FileDown size={15} />}
              tone="green"
              title="Export Departments List"
              detail="Download departments report"
              onClick={exportDepartments}
            />
          </div>

          <div className={styles.noteCard}>
            <div className={styles.noteTitle}>
              <AlertCircle size={17} />
              Important Note
            </div>

            <p>
              Departments are used for organizational structure, budgeting, reporting and access control.
            </p>

            <p>
              Departments with linked users, requests or subheads are deactivated instead of being hard-deleted.
            </p>
          </div>
        </aside>
      </section>

      {selected ? (
        <div
          className={styles.modalBackdrop}
          onMouseDown={() =>
            setSelected(null)
          }
        >
          <div
            className={styles.detailsModal}
            onMouseDown={(event) =>
              event.stopPropagation()
            }
          >
            <div className={styles.modalHeader}>
              <div>
                <small>
                  DEPARTMENT RECORD
                </small>

                <h2>
                  {selected.name}
                </h2>
              </div>

              <button
                onClick={() =>
                  setSelected(null)
                }
              >
                <X size={17} />
              </button>
            </div>

            <div className={styles.detailGrid}>
              <Detail
                label="Status"
                value={
                  selected.is_active === false
                    ? "Inactive"
                    : "Active"
                }
              />

              <Detail
                label="Staff"
                value={String(
                  Number(
                    selected.profile_count || 0
                  )
                )}
              />

              <Detail
                label="Requests"
                value={String(
                  Number(
                    selected.request_count || 0
                  )
                )}
              />

              <Detail
                label="Subheads"
                value={String(
                  Number(
                    selected.subhead_count || 0
                  )
                )}
              />

              <Detail
                label="Created"
                value={shortDate(
                  selected.created_at
                )}
              />
            </div>

            <div className={styles.modalFooter}>
              <button
                onClick={() =>
                  setSelected(null)
                }
              >
                Close
              </button>

              {canManage ? (
                <button
                  className={styles.primaryButton}
                  onClick={() => {
                    const department =
                      selected;

                    setSelected(null);

                    openEdit(
                      department
                    );
                  }}
                >
                  <Pencil size={14} />
                  Edit Department
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {formOpen ? (
        <div
          className={styles.modalBackdrop}
          onMouseDown={() => {
            if (!saving) {
              setFormOpen(false);
            }
          }}
        >
          <div
            className={styles.formModal}
            onMouseDown={(event) =>
              event.stopPropagation()
            }
          >
            <div className={styles.modalHeader}>
              <div>
                <small>
                  FINANCE DEPARTMENT
                </small>

                <h2>
                  {editId
                    ? "Edit Department"
                    : "Create New Department"}
                </h2>
              </div>

              <button
                onClick={() =>
                  setFormOpen(false)
                }
                disabled={saving}
              >
                <X size={17} />
              </button>
            </div>

            <div className={styles.formGrid}>
              <label className={styles.fullField}>
                <span>
                  Department Name
                </span>

                <input
                  value={name}
                  onChange={(event) =>
                    setName(
                      event.target.value
                    )
                  }
                  placeholder="e.g. Finance Department"
                  disabled={
                    saving ||
                    !canManage
                  }
                />
              </label>

              <label>
                <span>
                  Status
                </span>

                <select
                  value={
                    active
                      ? "active"
                      : "inactive"
                  }
                  onChange={(event) =>
                    setActive(
                      event.target.value ===
                      "active"
                    )
                  }
                  disabled={
                    saving ||
                    !canManage
                  }
                >
                  <option value="active">
                    Active
                  </option>

                  <option value="inactive">
                    Inactive
                  </option>
                </select>
              </label>

              <label>
                <span>
                  Role
                </span>

                <input
                  value={myRole}
                  readOnly
                />
              </label>

              <div className={styles.formNote}>
                ReqGen uses the stored department name, active status and routing identifiers. No synthetic department classification is added by this interface.
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button
                onClick={() =>
                  setFormOpen(false)
                }
                disabled={saving}
              >
                Cancel
              </button>

              <button
                className={styles.primaryButton}
                onClick={() =>
                  void save()
                }
                disabled={
                  saving ||
                  !canManage
                }
              >
                <Save size={14} />

                {saving
                  ? "Saving…"
                  : editId
                    ? "Update Department"
                    : "Create Department"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function Kpi({
  icon,
  tone,
  title,
  value,
  detail,
}: {
  icon: React.ReactNode;
  tone:
  | "blue"
  | "green"
  | "orange"
  | "purple";
  title: string;
  value: number;
  detail: string;
}) {
  return (
    <article className={styles.kpi}>
      <div
        className={`${styles.kpiIcon} ${styles[tone]}`}
      >
        {icon}
      </div>

      <div>
        <span>
          {title}
        </span>

        <strong
          className={
            styles[
            `${tone}Text`
            ]
          }
        >
          {value}
        </strong>

        <small>
          {detail}
        </small>
      </div>
    </article>
  );
}

function StatusPill({
  active,
}: {
  active: boolean;
}) {
  return (
    <span
      className={`${styles.statusPill} ${active
          ? styles.active
          : styles.inactive
        }`}
    >
      {active
        ? "Active"
        : "Inactive"}
    </span>
  );
}

function Legend({
  color,
  label,
  value,
  total,
}: {
  color: string;
  label: string;
  value: number;
  total: number;
}) {
  const pct = total
    ? (
      (value / total) *
      100
    ).toFixed(1)
    : "0.0";

  return (
    <div>
      <span
        style={{
          background: color,
        }}
      />

      <b>
        {label}
      </b>

      <small>
        {value} ({pct}%)
      </small>
    </div>
  );
}

function QuickAction({
  icon,
  tone,
  title,
  detail,
  onClick,
}: {
  icon: React.ReactNode;
  tone:
  | "blue"
  | "purple"
  | "green";
  title: string;
  detail: string;
  onClick: () => void;
}) {
  return (
    <button
      className={styles.quickAction}
      onClick={onClick}
    >
      <span
        className={`${styles.quickIcon} ${styles[tone]}`}
      >
        {icon}
      </span>

      <span>
        <b>
          {title}
        </b>

        <small>
          {detail}
        </small>
      </span>

      <span
        className={styles.chevron}
      >
        ›
      </span>
    </button>
  );
}

function Detail({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className={styles.detail}>
      <span>
        {label}
      </span>

      <strong>
        {value}
      </strong>
    </div>
  );
}