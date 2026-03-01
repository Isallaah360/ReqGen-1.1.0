console.log("URL:", process.env.NEXT_PUBLIC_SUPABASE_URL);
console.log("KEY:", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.slice(0, 15));
import { supabase } from "../../lib/supabaseClient";

export default async function TestSupabasePage() {
  const { data, error } = await supabase
    .from("departments")
    .select("name, is_active")
    .order("name", { ascending: true });

  if (error) {
    return (
      <div style={{ padding: 20, color: "red" }}>
        <h2>Supabase Error</h2>
        <pre>{JSON.stringify(error, null, 2)}</pre>
      </div>
    );
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>Departments (Supabase Test)</h1>
      <ul>
        {data?.map((d) => (
          <li key={d.name}>
            {d.name} — {d.is_active ? "Active" : "Inactive"}
          </li>
        ))}
      </ul>
    </div>
  );
}