"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

type Dept = { id: string; name: string };

export default function NewRequestPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  const [deptId, setDeptId] = useState<string>("");
  const [deptName, setDeptName] = useState<string>("");

  const [requestType, setRequestType] = useState<"Personal" | "Official">(
    "Personal"
  );
  const [personalCategory, setPersonalCategory] = useState<"Fund" | "NonFund">(
    "NonFund"
  );

  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [amount, setAmount] = useState<string>("0");

  // Signature enforcement + preview
  const [signaturePath, setSignaturePath] = useState<string | null>(null);
  const [signaturePreviewUrl, setSignaturePreviewUrl] = useState<string | null>(
    null
  );

  // Helper: pick the first stage + owner based on department routing
  async function getFirstStageAndOwner(deptId: string): Promise<{
    firstStage: "Director" | "HOD";
    firstOwner: string;
  }> {
    const { data: deptRoute, error } = await supabase
      .from("departments")
      .select("director_user_id, hod_user_id")
      .eq("id", deptId)
      .single();

    if (error) throw new Error("Failed to load department routing: " + error.message);

    // If director assigned, start with Director; else HOD
    const firstStage: "Director" | "HOD" = deptRoute?.director_user_id
      ? "Director"
      : "HOD";

    const firstOwner =
      firstStage === "Director"
        ? deptRoute?.director_user_id
        : deptRoute?.hod_user_id;

    if (!firstOwner) {
      throw new Error(
        `Routing not configured: Please assign ${firstStage} for this department in /admin.`
      );
    }

    return { firstStage, firstOwner };
  }

  // Load current user profile (dept + signature)
  useEffect(() => {
    async function load() {
      setLoading(true);
      setMsg(null);

      const { data: authData } = await supabase.auth.getUser();
      const user = authData.user;

      if (!user) {
        router.push("/login");
        return;
      }

      const { data: prof, error: profErr } = await supabase
        .from("profiles")
        .select("id, dept_id, signature_url")
        .eq("id", user.id)
        .single();

      if (profErr) {
        setMsg("Failed to load profile: " + profErr.message);
        setLoading(false);
        return;
      }

      if (!prof?.dept_id) {
        setMsg("Profile department not set. Please contact Admin.");
        setLoading(false);
        return;
      }

      // Enforce signature must exist before submitting any request
      if (!prof?.signature_url) {
        setMsg("❌ You must upload your signature before submitting any request.");
        setLoading(false);
        return;
      }

      setDeptId(prof.dept_id);
      setSignaturePath(prof.signature_url);

      // Load department name
      const { data: dept, error: deptErr } = await supabase
        .from("departments")
        .select("id,name")
        .eq("id", prof.dept_id)
        .single();

      if (!deptErr && dept) setDeptName((dept as Dept).name);

      // Create a temporary signed URL for preview (bucket is private)
      const { data: signed, error: signedErr } = await supabase.storage
        .from("signatures")
        .createSignedUrl(prof.signature_url, 60 * 10); // 10 minutes

      if (!signedErr && signed?.signedUrl) {
        setSignaturePreviewUrl(signed.signedUrl);
      }

      setLoading(false);
    }

    load();
  }, [router]);

  function validate(): string | null {
    if (!signaturePath)
      return "Signature is required. Please upload your signature.";
    if (title.trim().length < 3) return "Please enter a title.";
    if (details.trim().length < 5) return "Please enter details.";
    if (requestType === "Personal") {
      if (!personalCategory) return "Select personal category.";
    }
    const amt = Number(amount);
    if (Number.isNaN(amt) || amt < 0) return "Amount must be a valid number.";
    return null;
  }

  function makeRequestNo(): string {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const rnd = Math.floor(Math.random() * 900000) + 100000;
    return `RG-${yyyy}${mm}${dd}-${rnd}`;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);

    const err = validate();
    if (err) {
      setMsg("❌ " + err);
      return;
    }

    try {
      setMsg("Submitting request...");

      const { data: authData } = await supabase.auth.getUser();
      const user = authData.user;

      if (!user) {
        router.push("/login");
        return;
      }

      const requestNo = makeRequestNo();
      const amt = Number(amount);

      // ✅ Determine first stage + owner (Director or HOD)
      const { firstStage, firstOwner } = await getFirstStageAndOwner(deptId);

      const insertPayload: any = {
        request_no: requestNo,
        created_by: user.id,
        dept_id: deptId,
        request_type: requestType,
        personal_category: requestType === "Personal" ? personalCategory : null,
        amount: amt,
        title: title.trim(),
        details: details.trim(),
        status: "Submitted",
        current_stage: firstStage,
        current_owner: firstOwner,
      };

      // Insert request and return inserted id
      const { data: inserted, error: insErr } = await supabase
        .from("requests")
        .insert(insertPayload)
        .select("id")
        .single();

      if (insErr) throw new Error(insErr.message);

      // Insert signed audit history entry (Submit)
      const { error: histErr } = await supabase.from("request_history").insert({
        request_id: inserted.id,
        action_by: user.id,
        from_stage: null,
        to_stage: firstStage,
        action_type: "Submit",
        comment: "Submitted",
        signature_url: signaturePath, // REQUIRED
      });

      if (histErr) throw new Error("History insert failed: " + histErr.message);

      setMsg(`✅ Request submitted successfully (Signed) — sent to ${firstStage}!`);
      setTimeout(() => router.push("/dashboard"), 900);
    } catch (e: any) {
      setMsg("❌ Submit failed: " + (e?.message || "Unknown error"));
    }
  }

  return (
    <div style={{ maxWidth: 720, margin: "40px auto", padding: 16 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700 }}>New Request</h1>

      {loading && <p style={{ marginTop: 12 }}>Loading...</p>}

      {!loading && (
        <div style={{ marginTop: 8, color: "#555" }}>
          Department: <b>{deptName || "—"}</b>
        </div>
      )}

      {/* Signature preview (required) */}
      {!loading && signaturePreviewUrl && (
        <div
          style={{
            marginTop: 14,
            padding: 12,
            border: "1px solid #ddd",
            borderRadius: 12,
            background: "white",
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 8 }}>
            Your Signature (Required)
          </div>
          <img
            src={signaturePreviewUrl}
            alt="Signature preview"
            style={{
              maxWidth: 260,
              padding: 8,
              borderRadius: 10,
              background: "#fff",
              border: "1px solid #eee",
            }}
          />
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ marginTop: 16 }}>
        <label>Request Type</label>
        <select
          value={requestType}
          onChange={(e) => setRequestType(e.target.value as any)}
          style={{ width: "100%", padding: 10, margin: "6px 0 12px" }}
        >
          <option value="Personal">Personal</option>
          <option value="Official">Official</option>
        </select>

        {requestType === "Personal" && (
          <>
            <label>Personal Category</label>
            <select
              value={personalCategory}
              onChange={(e) => setPersonalCategory(e.target.value as any)}
              style={{ width: "100%", padding: 10, margin: "6px 0 12px" }}
            >
              <option value="NonFund">Non-Fund</option>
              <option value="Fund">Fund</option>
            </select>
          </>
        )}

        <label>Title</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={{ width: "100%", padding: 10, margin: "6px 0 12px" }}
          placeholder="e.g., Leave Request / Purchase Request"
        />

        <label>Details</label>
        <textarea
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          style={{
            width: "100%",
            padding: 10,
            margin: "6px 0 12px",
            minHeight: 120,
          }}
          placeholder="Write full details..."
        />

        <label>Amount (₦)</label>
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          style={{ width: "100%", padding: 10, margin: "6px 0 12px" }}
          placeholder="0"
        />

        <button
          type="submit"
          style={{
            width: "100%",
            padding: 12,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Submit Request
        </button>

        {msg && (
          <div style={{ marginTop: 12, padding: 10, background: "#f5f5f5" }}>
            {msg}
          </div>
        )}
      </form>
    </div>
  );
}