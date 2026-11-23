import { db, store } from "./core";

export type Person = { id: string; full_name: string | null; position_names: string | null; dept: string; dept_id: string };

/** Every active staff member, from all departments (names and positions only). Saved on the phone for a day. */
export async function everyone(): Promise<Person[]> {
  const saved = await store.get<{ at: number; list: Person[] } | null>("rg:c:people", null);
  if (saved && Date.now() - saved.at < 24 * 3600 * 1000 && saved.list.length) { void refresh(); return saved.list; }
  return refresh();
}
async function refresh(): Promise<Person[]> {
  const s = await db();
  const { data: depts, error } = await s.from("departments").select("id,name").order("name");
  if (error) throw new Error(error.message);
  const all = await Promise.all(((depts || []) as Array<{ id: string; name: string }>).map(async (d) => {
    const { data, error: e } = await s.rpc("reqgen_direct_people", { p_dept_id: d.id });
    if (e) throw new Error(/could not find|schema cache/i.test(e.message) ? "Direct requests are not switched on yet. Ask the Super Admin to run the database step." : e.message);
    return ((data || []) as Array<{ id: string; full_name: string | null; position_names: string | null }>).map((p) => ({ ...p, dept: d.name, dept_id: d.id }));
  }));
  const map = new Map<string, Person>();
  for (const p of all.flat()) if (!map.has(p.id)) map.set(p.id, p);
  const list = [...map.values()].sort((a, b) => String(a.full_name).localeCompare(String(b.full_name)));
  await store.set("rg:c:people", { at: Date.now(), list });
  return list;
}
export async function accountOfficers(): Promise<Array<{ id: string; full_name: string | null }>> {
  const { data } = await (await db()).rpc("reqgen_direct_account_officers");
  return (data || []) as Array<{ id: string; full_name: string | null }>;
}
