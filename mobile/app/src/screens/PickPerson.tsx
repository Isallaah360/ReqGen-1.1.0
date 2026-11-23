import { useEffect, useMemo, useState } from "react";
import { Check, Search } from "lucide-react";
import { everyone, type Person } from "../lib/people";
import { initials } from "../lib/text";
import { Note, Skeleton } from "../ui";

/** Search any staff name, from any department. One choice (radio) or many (boxes). */
export function PeopleList({ chosen, onToggle, exclude = [], many }: { chosen: string[]; onToggle: (p: Person) => void; exclude?: string[]; many: boolean }) {
  const [list, setList] = useState<Person[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [dept, setDept] = useState("");
  useEffect(() => { everyone().then(setList).catch((e) => setErr(e instanceof Error ? e.message : "Staff could not be loaded.")); }, []);
  const depts = useMemo(() => [...new Map((list || []).map((p) => [p.dept_id, p.dept])).entries()].sort((a, b) => a[1].localeCompare(b[1])), [list]);
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (list || []).filter((p) => !exclude.includes(p.id) && (!dept || p.dept_id === dept) && (!t || `${p.full_name} ${p.position_names} ${p.dept}`.toLowerCase().includes(t))).slice(0, 200);
  }, [list, q, dept, exclude]);
  if (err) return <Note tone="er">{err}</Note>;
  return (
    <>
      <label className="pill"><Search size={18} aria-hidden="true" /><input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search any staff name" aria-label="Search any staff name" /></label>
      <div className="filters" role="group" aria-label="Department">
        <button type="button" aria-pressed={!dept} onClick={() => setDept("")}>All departments</button>
        {depts.map(([id, name]) => <button key={id} type="button" aria-pressed={dept === id} onClick={() => setDept(id)}>{name}</button>)}
      </div>
      {!list ? <Skeleton rows={5} /> : shown.length ? (
        <div className="grp" role={many ? "group" : "radiogroup"} aria-label="Staff">
          {shown.map((p) => {
            const on = chosen.includes(p.id);
            return (
              <button key={p.id} type="button" className="cell" role={many ? "checkbox" : "radio"} aria-checked={on} onClick={() => onToggle(p)}>
                <span className="av" aria-hidden="true">{initials(p.full_name)}</span>
                <span className="t"><b>{p.full_name || "Staff"}</b><small>{[p.position_names || "Staff", p.dept].filter(Boolean).join(", ")}</small></span>
                <span className={`box${on ? " on" : ""}`} style={many ? undefined : { borderRadius: 13 }} aria-hidden="true">{on ? <Check size={15} strokeWidth={3} /> : null}</span>
              </button>
            );
          })}
        </div>
      ) : <p className="mu" style={{ textAlign: "center", padding: 20 }}>Nobody matches.</p>}
    </>
  );
}
