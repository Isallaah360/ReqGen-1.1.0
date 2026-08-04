"use client";

import { useMemo, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";

export interface ERPTableColumn<Row> {
  key: string;
  header: string;
  width?: string;
  align?: "left" | "center" | "right";
  sortable?: boolean;
  value?: (row: Row) => string | number | null | undefined;
  render?: (row: Row) => ReactNode;
}

export interface ERPTableProps<Row> {
  rows: Row[];
  columns: ERPTableColumn<Row>[];
  rowKey: (row: Row, index: number) => string;
  title?: string;
  description?: string;
  toolbar?: ReactNode;
  searchable?: boolean;
  searchPlaceholder?: string;
  pageSize?: number;
  emptyTitle?: string;
  emptyDescription?: string;
  loading?: boolean;
  onRowClick?: (row: Row) => void;
}

function normalize(value: unknown) {
  return String(value ?? "").toLocaleLowerCase();
}

/** Generic searchable, sortable and paginated enterprise table. */
export default function ERPTable<Row>({
  rows,
  columns,
  rowKey,
  title,
  description,
  toolbar,
  searchable = true,
  searchPlaceholder = "Search records...",
  pageSize = 10,
  emptyTitle = "No records found",
  emptyDescription = "There are no records matching the current view.",
  loading = false,
  onRowClick,
}: ERPTableProps<Row>) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<{ key: string; direction: "asc" | "desc" } | null>(null);

  const filtered = useMemo(() => {
    const term = normalize(query).trim();
    const source = term
      ? rows.filter((row) =>
          columns.some((column) => {
            const value = column.value ? column.value(row) : (row as Record<string, unknown>)[column.key];
            return normalize(value).includes(term);
          }),
        )
      : [...rows];

    if (!sort) return source;
    const column = columns.find((item) => item.key === sort.key);
    if (!column) return source;

    return source.sort((a, b) => {
      const aValue = column.value ? column.value(a) : (a as Record<string, unknown>)[column.key];
      const bValue = column.value ? column.value(b) : (b as Record<string, unknown>)[column.key];
      const result = String(aValue ?? "").localeCompare(String(bValue ?? ""), undefined, { numeric: true });
      return sort.direction === "asc" ? result : -result;
    });
  }, [columns, query, rows, sort]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const visibleRows = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  function toggleSort(column: ERPTableColumn<Row>) {
    if (!column.sortable) return;
    setPage(1);
    setSort((current) =>
      current?.key === column.key
        ? { key: column.key, direction: current.direction === "asc" ? "desc" : "asc" }
        : { key: column.key, direction: "asc" },
    );
  }

  return (
    <section className="erp2-table-card">
      {(title || description || toolbar || searchable) ? (
        <header className="erp2-table-toolbar">
          <div className="erp2-table-heading">
            {title ? <h2>{title}</h2> : null}
            {description ? <p>{description}</p> : null}
          </div>
          <div className="erp2-table-actions">
            {searchable ? (
              <label className="erp2-table-search">
                <Search size={16} aria-hidden="true" />
                <span className="erp2-visually-hidden">Search table</span>
                <input
                  value={query}
                  onChange={(event) => { setQuery(event.target.value); setPage(1); }}
                  placeholder={searchPlaceholder}
                />
              </label>
            ) : null}
            {toolbar}
          </div>
        </header>
      ) : null}

      <div className="erp2-table-scroll">
        <table className="erp2-table">
          <thead>
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  style={{ width: column.width }}
                  className={`erp2-table__${column.align ?? "left"}`}
                  aria-sort={sort?.key === column.key ? (sort.direction === "asc" ? "ascending" : "descending") : undefined}
                >
                  <button
                    type="button"
                    className={column.sortable ? "erp2-table__sort" : "erp2-table__label"}
                    onClick={() => toggleSort(column)}
                    disabled={!column.sortable}
                  >
                    {column.header}
                    {sort?.key === column.key ? <span aria-hidden="true">{sort.direction === "asc" ? "↑" : "↓"}</span> : null}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: Math.min(pageSize, 6) }).map((_, rowIndex) => (
                <tr key={`loading-${rowIndex}`} className="erp2-table__loading-row">
                  {columns.map((column) => <td key={column.key}><span /></td>)}
                </tr>
              ))
            ) : visibleRows.length ? (
              visibleRows.map((row, index) => (
                <tr
                  key={rowKey(row, index)}
                  className={onRowClick ? "erp2-table__clickable" : undefined}
                  onClick={() => onRowClick?.(row)}
                >
                  {columns.map((column) => (
                    <td key={column.key} className={`erp2-table__${column.align ?? "left"}`}>
                      {column.render
                        ? column.render(row)
                        : String(column.value ? column.value(row) ?? "—" : (row as Record<string, unknown>)[column.key] ?? "—")}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr><td colSpan={columns.length}><div className="erp2-table-empty"><strong>{emptyTitle}</strong><span>{emptyDescription}</span></div></td></tr>
            )}
          </tbody>
        </table>
      </div>

      {!loading && filtered.length > pageSize ? (
        <footer className="erp2-table-pagination">
          <span>Showing {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, filtered.length)} of {filtered.length}</span>
          <div>
            <button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={safePage === 1} aria-label="Previous page"><ChevronLeft size={16} /></button>
            <span>Page {safePage} of {pageCount}</span>
            <button type="button" onClick={() => setPage((value) => Math.min(pageCount, value + 1))} disabled={safePage === pageCount} aria-label="Next page"><ChevronRight size={16} /></button>
          </div>
        </footer>
      ) : null}
    </section>
  );
}
