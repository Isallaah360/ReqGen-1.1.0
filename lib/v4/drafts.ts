import { supabase } from "@/lib/supabaseClient";

/**
 * ReqGen v4.1.2 — request drafts (mock-up 29).
 *
 * A draft is a request that is saved but not submitted. It lives in
 * public.reqgen_request_drafts (only its owner can see it) and its files in
 * the private "request-drafts" storage bucket under the owner's own folder.
 * Drafts are kept for 60 days. Submitting a draft deletes it.
 */

export type DraftFields = {
  request_type: string;
  personal_category: string | null;
  dept_id: string | null;
  subhead_id: string | null;
  title: string;
  details: string;
  amount: number | null;
};

export type DraftFile = { path: string; name: string; size: number; type: string | null };

export type DraftRow = DraftFields & {
  id: string;
  owner_id: string;
  attachments: DraftFile[] | null;
  created_at: string;
  updated_at: string;
  expires_at: string;
};

const BUCKET = "request-drafts";
const TABLE = "reqgen_request_drafts";

function safeName(name: string) {
  const parts = name.split(".");
  const ext = parts.length > 1 ? (parts.pop() || "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 12) : "";
  const base = parts.join(".").toLowerCase().replace(/[^a-z0-9-_]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 70) || "file";
  return ext ? `${base}.${ext}` : base;
}

async function myId() {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Please sign in again.");
  return data.user.id;
}

export async function listDrafts(): Promise<DraftRow[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select("id,owner_id,request_type,personal_category,dept_id,subhead_id,title,details,amount,attachments,created_at,updated_at,expires_at")
    .gt("expires_at", new Date().toISOString())
    .order("updated_at", { ascending: false });
  if (error) {
    if (/relation .* does not exist|schema cache|could not find/i.test(error.message)) return [];
    throw new Error(error.message);
  }
  return ((data || []) as DraftRow[]).map((r) => ({ ...r, attachments: Array.isArray(r.attachments) ? r.attachments : [] }));
}

/** Saves (creates or updates) a draft and its files. Returns the draft id. */
export async function saveDraft(id: string | null, fields: DraftFields, files: File[]): Promise<string> {
  const uid = await myId();
  let draftId = id;
  let previous: DraftFile[] = [];
  if (draftId) {
    const cur = await supabase.from(TABLE).select("attachments").eq("id", draftId).maybeSingle();
    if (cur.error) throw new Error(cur.error.message);
    if (!cur.data) draftId = null;
    else {
      const stored = (cur.data as { attachments: unknown }).attachments;
      previous = Array.isArray(stored) ? (stored as DraftFile[]) : [];
    }
  }
  if (!draftId) {
    const ins = await supabase.from(TABLE).insert({ ...fields, owner_id: uid }).select("id").single();
    if (ins.error) {
      if (/relation .* does not exist|schema cache/i.test(ins.error.message)) throw new Error("Drafts are switched on by the v4.1.2 database step. Ask the Super Admin to run it.");
      throw new Error(ins.error.message);
    }
    draftId = (ins.data as { id: string }).id;
  }

  // Files: keep those already stored, upload new ones, remove the ones taken out.
  const keep: DraftFile[] = [];
  for (const f of files) {
    const same = previous.find((p) => p.name === f.name && p.size === f.size);
    if (same) { keep.push(same); continue; }
    const path = `${uid}/${draftId}/${Date.now()}-${keep.length + 1}-${safeName(f.name)}`;
    const up = await supabase.storage.from(BUCKET).upload(path, f, { upsert: false, contentType: f.type || "application/octet-stream" });
    if (up.error) throw new Error(`“${f.name}” could not be saved with the draft: ${up.error.message}`);
    keep.push({ path, name: f.name, size: f.size, type: f.type || null });
  }
  const removed = previous.filter((p) => !keep.some((k) => k.path === p.path)).map((p) => p.path);
  if (removed.length) await supabase.storage.from(BUCKET).remove(removed);

  const upd = await supabase
    .from(TABLE)
    .update({ ...fields, attachments: keep, updated_at: new Date().toISOString(), expires_at: new Date(Date.now() + 60 * 86400000).toISOString() })
    .eq("id", draftId);
  if (upd.error) throw new Error(upd.error.message);
  return draftId;
}

/** Opens a draft with its files ready to submit. */
export async function loadDraft(id: string): Promise<(DraftRow & { files: File[] }) | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .select("id,owner_id,request_type,personal_category,dept_id,subhead_id,title,details,amount,attachments,created_at,updated_at,expires_at")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const row = data as DraftRow;
  const files: File[] = [];
  for (const a of Array.isArray(row.attachments) ? row.attachments : []) {
    const dl = await supabase.storage.from(BUCKET).download(a.path);
    if (dl.error || !dl.data) continue;
    files.push(new File([dl.data], a.name, { type: a.type || dl.data.type || "application/octet-stream" }));
  }
  return { ...row, files };
}

export async function deleteDraft(id: string) {
  const cur = await supabase.from(TABLE).select("attachments").eq("id", id).maybeSingle();
  const stored = (cur.data as { attachments: unknown } | null)?.attachments;
  const paths = (Array.isArray(stored) ? (stored as DraftFile[]) : []).map((a) => a.path).filter(Boolean);
  if (paths.length) await supabase.storage.from(BUCKET).remove(paths);
  const del = await supabase.from(TABLE).delete().eq("id", id);
  if (del.error) throw new Error(del.error.message);
}
