"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function DepartmentsPage() {

  const [departments, setDepartments] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [msg,setMsg] = useState("");

  async function loadData() {

    const { data: dept } = await supabase
      .from("departments")
      .select("*")
      .order("name");

    const { data: users } = await supabase
      .from("profiles")
      .select("id,email,role");

    setDepartments(dept || []);
    setUsers(users || []);
  }

  useEffect(()=>{
    loadData();
  },[])

  async function saveDept(dept:any){

    const { error } = await supabase
      .from("departments")
      .update({
        hod_user_id: dept.hod_user_id,
        director_user_id: dept.director_user_id
      })
      .eq("id",dept.id)

    if(error){
      setMsg(error.message)
      return
    }

    setMsg("Department routing updated")
  }

  return (

    <main className="max-w-5xl mx-auto py-10">

      <h1 className="text-2xl font-bold mb-6">
        Department Routing
      </h1>

      {msg && (
        <div className="mb-4 text-red-600">{msg}</div>
      )}

      {departments.map((dept)=>{

        return(

          <div
          key={dept.id}
          className="border rounded-xl p-5 mb-5 bg-white">

            <h2 className="font-bold mb-3">
              {dept.name}
            </h2>

            <div className="grid grid-cols-2 gap-4">

              {/* HOD */}

              <div>

                <label className="text-sm">HOD</label>

                <select
                value={dept.hod_user_id || ""}
                onChange={(e)=>{

                  setDepartments(prev =>
                    prev.map(d =>
                      d.id === dept.id
                      ? {...d, hod_user_id:e.target.value}
                      : d
                    )
                  )

                }}
                className="w-full border p-2 rounded">

                  <option value="">None</option>

                  {users.map((u)=>(
                    <option key={u.id} value={u.id}>
                      {u.email} ({u.role})
                    </option>
                  ))}

                </select>

              </div>


              {/* DIRECTOR */}

              <div>

                <label className="text-sm">Director</label>

                <select
                value={dept.director_user_id || ""}
                onChange={(e)=>{

                  setDepartments(prev =>
                    prev.map(d =>
                      d.id === dept.id
                      ? {...d, director_user_id:e.target.value}
                      : d
                    )
                  )

                }}
                className="w-full border p-2 rounded">

                  <option value="">None</option>

                  {users.map((u)=>(
                    <option key={u.id} value={u.id}>
                      {u.email} ({u.role})
                    </option>
                  ))}

                </select>

              </div>

            </div>

            <button
            onClick={()=>saveDept(dept)}
            className="mt-4 bg-blue-600 text-white px-4 py-2 rounded">

              Save

            </button>

          </div>

        )

      })}

    </main>
  );
}