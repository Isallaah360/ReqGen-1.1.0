"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Dept = {
  id: string;
  name: string;
  hod_user_id: string | null;
  director_user_id: string | null;
  is_active?: boolean | null;
};

type Subhead = {
  id: string;
  dept_id: string;
  code: string | null;
  name: string;
  balance: number | null;
  expenditure?: number | null;
  reserved_amount?: number | null; // ✅ NEW
  approved_allocation?: number | null; // ✅ NEW
  is_active: boolean | null;
};

type ProfileMini = {
  id: string;
  full_name: string | null;
  email: string | null;
  signature_url: string | null;
};

function naira(n: number) {
  return "₦" + Math.round(n || 0).toLocaleString();
}

function buildRequestNo() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const t = String(now.getTime()).slice(-6);
  return `REQ-${y}${m}-${t}`;
}

export default function NewRequestPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [me, setMe] = useState<ProfileMini | null>(null);

  const [requestType, setRequestType] = useState<"Official" | "Personal">("Official");
  const [personalCategory, setPersonalCategory] = useState<"Fund" | "NonFund">("Fund");

  const [depts, setDepts] = useState<Dept[]>([]);
  const [subs, setSubs] = useState<Subhead[]>([]);

  const [deptId, setDeptId] = useState("");
  const [subheadId, setSubheadId] = useState("");
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [details, setDetails] = useState("");

  useEffect(() => {
    async function loadAll() {
      setLoading(true);
      setMsg(null);

      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        router.push("/login");
        return;
      }

      const { data: prof, error: profErr } = await supabase
        .from("profiles")
        .select("id,full_name,email,signature_url")
        .eq("id", auth.user.id)
        .single();

      if (profErr) {
        setMsg("Failed to load your profile: " + profErr.message);
        setLoading(false);
        return;
      }

      setMe((prof || null) as ProfileMini);

      const { data: deptRows } = await supabase
        .from("departments")
        .select("id,name,hod_user_id,director_user_id,is_active")
        .eq("is_active", true)
        .order("name", { ascending: true });

      setDepts((deptRows || []) as Dept[]);

      const { data: subRows } = await supabase
        .from("subheads")
        .select("id,dept_id,code,name,balance,expenditure,reserved_amount,approved_allocation,is_active")
        .eq("is_active", true)
        .order("name", { ascending: true });

      setSubs((subRows || []) as Subhead[]);

      setLoading(false);
    }

    loadAll();
  }, [router]);

  const filteredSubs = useMemo(() => {
    return subs.filter((s) => s.dept_id === deptId);
  }, [subs, deptId]);

  const selectedSubhead = useMemo(() => {
    return subs.find((s) => s.id === subheadId) || null;
  }, [subs, subheadId]);

  async function notify(userId: string, title: string, body: string, link: string) {
    await supabase.from("notifications").insert({
      user_id: userId,
      title,
      body,
      link,
      is_read: false,
    });
  }

  async function createRequest() {
    setMsg(null);

    if (!me?.signature_url) {
      return setMsg("❌ Upload your signature first.");
    }

    if (!selectedSubhead) {
      return setMsg("❌ Subhead not found.");
    }

    const amt = Number(amount || 0);
    if (!amt || amt <= 0) {
      return setMsg("❌ Invalid amount.");
    }

    const currentReserved = Number(selectedSubhead.reserved_amount || 0);
    const currentExpenditure = Number(selectedSubhead.expenditure || 0);
    const allocation = Number(selectedSubhead.approved_allocation || 0);

    const availableBalance = allocation - currentReserved - currentExpenditure;

    if (amt > availableBalance) {
      return setMsg(`❌ Amount exceeds available balance (${naira(availableBalance)})`);
    }

    const dept = depts.find((d) => d.id === deptId);
    const firstOwner = dept?.director_user_id || dept?.hod_user_id;
    const firstStage = dept?.director_user_id ? "Director" : "HOD";

    setSaving(true);

    try {
      const requestNo = buildRequestNo();

      const { data: created } = await supabase
        .from("requests")
        .insert({
          request_no: requestNo,
          title,
          details,
          amount: amt,
          status: "Submitted",
          current_stage: firstStage,
          current_owner: firstOwner,
          created_by: me.id,
          dept_id: deptId,
          subhead_id: subheadId,
          request_type: requestType,
          personal_category: requestType === "Personal" ? personalCategory : null,
          funds_state: "reserved",
          requester_name: me.full_name,
          requester_signature_snapshot: me.signature_url,
        })
        .select("id")
        .single();

      const requestId = created?.id;

      // 🔥 RESERVE FUNDS
      const newReserved = currentReserved + amt;
      const newBalance = allocation - newReserved - currentExpenditure;

      await supabase
        .from("subheads")
        .update({
          reserved_amount: newReserved,
          balance: newBalance,
        })
        .eq("id", subheadId);

      await notify(
        firstOwner!,
        "New Request Submitted",
        `${requestNo}: ${title}`,
        `/requests/${requestId}`
      );

      setMsg("✅ Request submitted successfully.");
      router.push(`/requests/${requestId}`);
    } catch (e: any) {
      setMsg("❌ " + e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4">
      <div className="mx-auto max-w-5xl py-10">
        <h1 className="text-3xl font-bold">New Request</h1>

        {msg && <div className="mt-4 text-red-600">{msg}</div>}

        <button
          onClick={createRequest}
          disabled={saving}
          className="mt-6 bg-blue-600 text-white px-4 py-2 rounded-xl"
        >
          Submit Request
        </button>
      </div>
    </main>
  );
}