"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

export default function ProfilePage() {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [hasSig, setHasSig] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setMsg(null);

      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (!user) {
        router.push("/login");
        return;
      }

      const { data: prof } = await supabase
        .from("profiles")
        .select("signature_url")
        .eq("id", user.id)
        .single();

      if (prof?.signature_url) setHasSig(true);

      setLoading(false);
    }
    load();
  }, [router]);

  async function saveSignature() {
    setMsg(null);

    if (!file) return setMsg("Please choose a signature image.");
    if (!file.type.includes("png") && !file.type.includes("jpeg") && !file.type.includes("jpg"))
      return setMsg("Signature must be PNG or JPG.");

    const { data } = await supabase.auth.getUser();
    const user = data.user;
    if (!user) {
      router.push("/login");
      return;
    }

    try {
      setMsg("Uploading signature...");

      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const path = `${user.id}/signature.${ext}`;

      const { error: upErr } = await supabase.storage
        .from("signatures")
        .upload(path, file, { upsert: true, contentType: file.type });

      if (upErr) throw new Error(upErr.message);

      const { error: profErr } = await supabase
        .from("profiles")
        .update({ signature_url: path })
        .eq("id", user.id);

      if (profErr) throw new Error(profErr.message);

      setMsg("✅ Signature saved successfully.");
      setHasSig(true);
      setTimeout(() => router.push("/dashboard"), 700);
    } catch (e: any) {
      setMsg("❌ " + (e?.message || "Unknown error"));
    }
  }

  if (loading) return <p className="text-slate-600 p-6">Loading...</p>;

  return (
    <div className="mx-auto max-w-md p-6">
      <h1 className="text-2xl font-bold">My Profile</h1>
      <p className="mt-2 text-sm text-slate-600">
        Upload your signature to submit and approve requests.
      </p>

      {hasSig && (
        <div className="mt-4 rounded-xl border bg-white p-3 text-sm">
          ✅ Signature already uploaded. You can re-upload to replace it.
        </div>
      )}

      <div className="mt-5 rounded-2xl border bg-white p-5 shadow-sm">
        <label className="text-sm font-semibold">Signature (PNG/JPG)</label>
        <input
          type="file"
          accept="image/png,image/jpeg"
          onChange={(e) => {
            const f = e.target.files?.[0] || null;
            setFile(f);
            setPreview(f ? URL.createObjectURL(f) : null);
          }}
          className="mt-2 w-full rounded-xl border px-3 py-2"
        />

        {preview && (
          <img
            src={preview}
            alt="Signature preview"
            className="mt-4 h-20 w-auto rounded-xl border bg-white p-2"
          />
        )}

        <button
          onClick={saveSignature}
          className="mt-4 w-full rounded-xl bg-black px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800"
        >
          Save Signature
        </button>

        {msg && <div className="mt-4 rounded-xl bg-slate-100 px-3 py-2 text-sm">{msg}</div>}
      </div>
    </div>
  );
}