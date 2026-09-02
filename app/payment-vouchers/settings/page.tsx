"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Pencil,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  Signature,
  ToggleLeft,
  Trash2,
  UserRoundPlus,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import styles from "./payment-voucher-settings.module.css";

type SignatoryType = "ChequeSigner" | "CounterSigner" | "Both";

type CounterSignatory = {
  id: string;
  full_name: string;
  signatory_type: SignatoryType | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type ProfileCandidate = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string | null;
  signature_url: string | null;
  is_active: boolean | null;
};

type FilterType = "ALL" | SignatoryType;
type FilterStatus = "ALL" | "ACTIVE" | "INACTIVE";
type FilterSignature = "ALL" | "READY" | "MISSING";

function roleKey(role: string | null | undefined) {
  return (role || "").trim().toLowerCase().replace(/[\s_]+/g, "");
}

function personKey(value: string | null | undefined) {
  return (value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function shortDateTime(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function typeLabel(type: string | null | undefined) {
  if (type === "ChequeSigner") return "Cheque Signer";
  if (type === "CounterSigner") return "Counter Signer";
  if (type === "Both") return "Both";
  return "Counter Signer";
}

function typeHelpText(type: string | null | undefined) {
  if (type === "ChequeSigner") return "First cheque-signing authority on cheque-based vouchers.";
  if (type === "CounterSigner") return "Counter-signing authority after the cheque signer.";
  if (type === "Both") return "Available in both cheque-signer and counter-signer selections.";
  return "Counter-signing authority.";
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("") || "PV";
}

function resolveActiveRole(rawRole: unknown, fallbackRole: string | null | undefined) {
  if (typeof rawRole === "string") return roleKey(rawRole);
  if (Array.isArray(rawRole)) {
    const first = rawRole[0] as Record<string, unknown> | undefined;
    return roleKey(String(first?.active_role_key || first?.role_key || first?.get_my_active_role || fallbackRole || "staff"));
  }
  if (rawRole && typeof rawRole === "object") {
    const item = rawRole as Record<string, unknown>;
    return roleKey(String(item.active_role_key || item.role_key || item.get_my_active_role || fallbackRole || "staff"));
  }
  return roleKey(fallbackRole || "staff");
}

export default function PaymentVoucherSettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [activeRole, setActiveRole] = useState("staff");
  const [rows, setRows] = useState<CounterSignatory[]>([]);
  const [profiles, setProfiles] = useState<ProfileCandidate[]>([]);
  const [editId, setEditId] = useState<string | null>(null);
  const [selectedProfileId, setSelectedProfileId] = useState("");
  const [signatoryType, setSignatoryType] = useState<SignatoryType>("CounterSigner");
  const [active, setActive] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<FilterType>("ALL");
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("ALL");
  const [signatureFilter, setSignatureFilter] = useState<FilterSignature>("ALL");

  const canAccess = ["admin", "auditor"].includes(activeRole);

  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true); else setLoading(true);
    setMessage(null);

    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user) {
        router.replace("/login");
        return;
      }

      const [profileRes, activeRoleRes] = await Promise.all([
        supabase.from("profiles").select("role").eq("id", auth.user.id).maybeSingle(),
        supabase.rpc("get_my_active_role"),
      ]);

      const resolvedRole = resolveActiveRole(activeRoleRes.data as unknown, profileRes.data?.role || "staff");
      setActiveRole(resolvedRole);

      if (!["admin", "auditor"].includes(resolvedRole)) {
        setRows([]);
        setProfiles([]);
        return;
      }

      const [signatoryRes, profilesRes] = await Promise.all([
        supabase
          .from("payment_voucher_counter_signatories")
          .select("id,full_name,signatory_type,is_active,created_at,updated_at")
          .order("full_name", { ascending: true }),
        supabase
          .from("profiles")
          .select("id,full_name,email,role,signature_url,is_active")
          .order("full_name", { ascending: true }),
      ]);

      if (signatoryRes.error) throw new Error(signatoryRes.error.message);
      if (profilesRes.error) throw new Error(profilesRes.error.message);

      setRows((signatoryRes.data || []) as CounterSignatory[]);
      setProfiles((profilesRes.data || []) as ProfileCandidate[]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load Payment Voucher settings.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useEffect(() => {
    queueMicrotask(() => void load());

    let timer: ReturnType<typeof setTimeout> | null = null;
    const refreshSoon = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void load(true), 350);
    };

    const channel = supabase
      .channel("pv-settings-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "payment_voucher_counter_signatories" }, refreshSoon)
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, refreshSoon)
      .subscribe();

    const onFocus = () => refreshSoon();
    window.addEventListener("focus", onFocus);

    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener("focus", onFocus);
      void supabase.removeChannel(channel);
    };
  }, [load]);

  const profileByName = useMemo(
    () => new Map(profiles.map((profile) => [personKey(profile.full_name), profile])),
    [profiles]
  );

  const selectableProfiles = useMemo(
    () => profiles.filter((profile) => profile.is_active !== false && profile.full_name?.trim()),
    [profiles]
  );

  const selectedProfile = useMemo(
    () => selectableProfiles.find((profile) => profile.id === selectedProfileId) || null,
    [selectableProfiles, selectedProfileId]
  );

  const stats = useMemo(() => ({
    total: rows.length,
    active: rows.filter((row) => row.is_active).length,
    inactive: rows.filter((row) => !row.is_active).length,
    cheque: rows.filter((row) => row.is_active && (row.signatory_type === "ChequeSigner" || row.signatory_type === "Both")).length,
    counter: rows.filter((row) => row.is_active && (row.signatory_type === "CounterSigner" || row.signatory_type === "Both")).length,
  }), [rows]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter((row) => {
      const profile = profileByName.get(personKey(row.full_name));
      const haystack = [row.full_name, profile?.email, profile?.role, typeLabel(row.signatory_type), row.is_active ? "active" : "inactive"].join(" ").toLowerCase();
      if (query && !haystack.includes(query)) return false;
      if (typeFilter !== "ALL" && row.signatory_type !== typeFilter) return false;
      if (statusFilter === "ACTIVE" && !row.is_active) return false;
      if (statusFilter === "INACTIVE" && row.is_active) return false;
      const signatureReady = Boolean(profile?.signature_url?.trim());
      if (signatureFilter === "READY" && !signatureReady) return false;
      if (signatureFilter === "MISSING" && signatureReady) return false;
      return true;
    });
  }, [profileByName, rows, search, signatureFilter, statusFilter, typeFilter]);

  function resetForm() {
    setEditId(null);
    setSelectedProfileId("");
    setSignatoryType("CounterSigner");
    setActive(true);
  }

  function startEdit(row: CounterSignatory) {
    const profile = profileByName.get(personKey(row.full_name));
    setEditId(row.id);
    setSelectedProfileId(profile?.id || "");
    setSignatoryType(row.signatory_type || "CounterSigner");
    setActive(row.is_active);
    setMessage(profile ? null : "This legacy signatory is not matched to a current profile. Select the correct user before saving changes.");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function save() {
    if (!canAccess) return;
    if (!selectedProfile) {
      setMessage("Select a ReqGen user before saving the signatory.");
      return;
    }
    const fullName = selectedProfile.full_name?.trim() || "";
    if (!fullName) {
      setMessage("The selected profile does not have a full name.");
      return;
    }
    if (!selectedProfile.signature_url?.trim()) {
      setMessage("This user has no saved signature. Ask the user to upload a signature in Profile before granting PV signing authority.");
      return;
    }
    const duplicate = rows.find((row) => row.id !== editId && personKey(row.full_name) === personKey(fullName));
    if (duplicate) {
      setMessage(`${fullName} is already registered. Edit the existing signatory instead.`);
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Your session has expired. Please sign in again.");

      if (editId) {
        const { error } = await supabase
          .from("payment_voucher_counter_signatories")
          .update({ full_name: fullName, signatory_type: signatoryType, is_active: active })
          .eq("id", editId);
        if (error) throw new Error(error.message);
        setMessage("PV signatory updated successfully.");
      } else {
        const { error } = await supabase
          .from("payment_voucher_counter_signatories")
          .insert({
            full_name: fullName,
            signatory_type: signatoryType,
            is_active: active,
            created_by: auth.user.id,
          });
        if (error) throw new Error(error.message);
        setMessage("PV signatory added successfully.");
      }

      resetForm();
      await load(true);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save PV signatory.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(row: CounterSignatory) {
    if (!canAccess) return;
    const nextStatus = !row.is_active;
    const confirmed = window.confirm(
      nextStatus
        ? `Activate ${row.full_name} for Payment Voucher signing?`
        : `Deactivate ${row.full_name}? The user will stop appearing in new PV signing dropdowns.`
    );
    if (!confirmed) return;

    setSaving(true);
    setMessage(null);
    try {
      const { error } = await supabase
        .from("payment_voucher_counter_signatories")
        .update({ is_active: nextStatus })
        .eq("id", row.id);
      if (error) throw new Error(error.message);
      setMessage(nextStatus ? "Signatory activated." : "Signatory deactivated.");
      await load(true);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update signatory status.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(row: CounterSignatory) {
    if (!canAccess) return;

    setSaving(true);
    setMessage(null);
    try {
      const historicalChecks = await Promise.all([
        supabase.from("payment_vouchers").select("id", { count: "exact", head: true }).eq("cheque_signed_by_name", row.full_name),
        supabase.from("payment_vouchers").select("id", { count: "exact", head: true }).eq("counter_signatory_name", row.full_name),
        supabase.from("payment_vouchers").select("id", { count: "exact", head: true }).eq("cheque_counter_signed_by_name", row.full_name),
      ]);

      const checkError = historicalChecks.find((result) => result.error)?.error;
      if (checkError) throw new Error(checkError.message);

      const historicalUse = historicalChecks.reduce((total, result) => total + (result.count || 0), 0);
      if (historicalUse > 0) {
        setMessage(`${row.full_name} already appears on ${historicalUse} historical voucher record${historicalUse === 1 ? "" : "s"}. Deactivate this authority instead of deleting it.`);
        return;
      }

      const confirmed = window.confirm(
        `Delete ${row.full_name} permanently?\n\nThis authority has not been used on a historical Payment Voucher.`
      );
      if (!confirmed) return;

      const { error } = await supabase.from("payment_voucher_counter_signatories").delete().eq("id", row.id);
      if (error) throw new Error(error.message);
      if (editId === row.id) resetForm();
      setMessage("PV signatory deleted.");
      await load(true);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to delete PV signatory.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <main className={styles.page}><div className={styles.loading}>Loading Payment Voucher settings...</div></main>;
  }

  if (!canAccess) {
    return (
      <main className={styles.page}>
        <section className={styles.accessCard}>
          <ShieldCheck size={28} />
          <h1>Restricted Payment Voucher Settings</h1>
          <p>Only Admin and Auditor can manage cheque-signing authority.</p>
          <Link href="/payment-vouchers" className={styles.primaryLink}>Back to Payment Vouchers</Link>
        </section>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <nav className={styles.breadcrumb} aria-label="Breadcrumb">
          <Link href="/dashboard">Home</Link><ChevronRight size={13} />
          <Link href="/payment-vouchers">Payment Vouchers</Link><ChevronRight size={13} />
          <span>Settings</span>
        </nav>

        <header className={styles.hero}>
          <div className={styles.heroIdentity}>
            <div className={styles.titleIcon}><Settings2 size={24} /></div>
            <div>
              <span className={styles.eyebrow}>Payment Vouchers</span>
              <h1>Payment Voucher Settings</h1>
              <p>Control official cheque-signing authority from verified ReqGen user profiles.</p>
            </div>
          </div>
          <div className={styles.heroMeta}>
            <span><CalendarDays size={16} />{new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</span>
            <span><ShieldCheck size={16} />Restricted Authority</span>
            <button onClick={() => void load(true)} disabled={refreshing || saving}><RefreshCw size={15} />{refreshing ? "Refreshing..." : "Refresh"}</button>
          </div>
        </header>

        {message && <div className={styles.message}><CircleAlert size={16} /><span>{message}</span></div>}

        <section className={styles.authorityNotice}>
          <ShieldCheck size={20} />
          <div>
            <strong>Controlled signing authority</strong>
            <p>Only Admin and Auditor manage this register. Account Officers may prepare vouchers but cannot grant cheque-signing authority.</p>
          </div>
        </section>

        <section className={styles.kpiGrid}>
          <article><span>Total Names</span><strong>{stats.total}</strong><small>Registered authorities</small></article>
          <article><span>Active</span><strong>{stats.active}</strong><small>Available for new PVs</small></article>
          <article><span>Inactive</span><strong>{stats.inactive}</strong><small>Preserved for history</small></article>
          <article><span>Cheque Signers</span><strong>{stats.cheque}</strong><small>First signing authority</small></article>
          <article><span>Counter Signers</span><strong>{stats.counter}</strong><small>Counter-signing authority</small></article>
        </section>

        <section className={styles.editorCard}>
          <div className={styles.sectionHeading}>
            <div>
              <span className={styles.sectionEyebrow}>{editId ? "Update Authority" : "Add Authority"}</span>
              <h2>{editId ? "Edit PV Signatory" : "Add PV Signatory"}</h2>
              <p>Select a real ReqGen user. Signature readiness is checked directly from the profile.</p>
            </div>
            {editId && <button className={styles.secondaryButton} onClick={resetForm} disabled={saving}>Cancel Edit</button>}
          </div>

          <div className={styles.editorGrid}>
            <label className={styles.fieldWide}>
              <span>ReqGen User</span>
              <select value={selectedProfileId} onChange={(event) => setSelectedProfileId(event.target.value)} disabled={saving}>
                <option value="">Select user...</option>
                {selectableProfiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.full_name} {profile.role ? `— ${profile.role}` : ""}{profile.signature_url ? " — Signature ready" : " — No signature"}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Signatory Type</span>
              <select value={signatoryType} onChange={(event) => setSignatoryType(event.target.value as SignatoryType)} disabled={saving}>
                <option value="ChequeSigner">Cheque Signer</option>
                <option value="CounterSigner">Counter Signer</option>
                <option value="Both">Both</option>
              </select>
            </label>
            <label className={styles.activeField}>
              <span>Status</span>
              <button type="button" className={active ? styles.statusToggleActive : styles.statusToggle} onClick={() => setActive((value) => !value)} disabled={saving}>
                <ToggleLeft size={18} />{active ? "Active" : "Inactive"}
              </button>
            </label>
            <button className={styles.saveButton} onClick={() => void save()} disabled={saving || !selectedProfileId || !selectedProfile?.signature_url?.trim()}>
              <UserRoundPlus size={17} />{saving ? "Saving..." : editId ? "Update Authority" : "Add Authority"}
            </button>
          </div>

          {selectedProfile && (
            <div className={selectedProfile.signature_url ? styles.signatureReady : styles.signatureMissing}>
              <Signature size={17} />
              <div>
                <strong>{selectedProfile.signature_url ? "Signature ready" : "Signature missing"}</strong>
                <span>{selectedProfile.full_name} · {selectedProfile.email || "No email"}</span>
              </div>
            </div>
          )}
        </section>

        <section className={styles.registerCard}>
          <div className={styles.registerHeader}>
            <div>
              <span className={styles.sectionEyebrow}>Live Register</span>
              <h2>PV Signatories Register</h2>
              <p>Search and manage the authorities available to the Payment Voucher workflow.</p>
            </div>
            <span className={styles.recordCount}>{filteredRows.length} record{filteredRows.length === 1 ? "" : "s"}</span>
          </div>

          <div className={styles.filters}>
            <label className={styles.searchField}><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, role or email..." /></label>
            <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as FilterType)}>
              <option value="ALL">All authority types</option>
              <option value="ChequeSigner">Cheque Signers</option>
              <option value="CounterSigner">Counter Signers</option>
              <option value="Both">Both</option>
            </select>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as FilterStatus)}>
              <option value="ALL">All statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
            <select value={signatureFilter} onChange={(event) => setSignatureFilter(event.target.value as FilterSignature)}>
              <option value="ALL">All signatures</option>
              <option value="READY">Signature ready</option>
              <option value="MISSING">Signature missing</option>
            </select>
          </div>

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr><th>User</th><th>Authority</th><th>Signature</th><th>Status</th><th>Updated</th><th>Actions</th></tr></thead>
              <tbody>
                {filteredRows.map((row) => {
                  const profile = profileByName.get(personKey(row.full_name));
                  const signatureReady = Boolean(profile?.signature_url?.trim());
                  return (
                    <tr key={row.id}>
                      <td>
                        <div className={styles.personCell}>
                          <span className={styles.avatar}>{initials(row.full_name)}</span>
                          <div><strong>{row.full_name}</strong><small>{profile?.email || "Profile match unavailable"}{profile?.role ? ` · ${profile.role}` : ""}</small></div>
                        </div>
                      </td>
                      <td><span className={styles.authorityBadge}>{typeLabel(row.signatory_type)}</span><small className={styles.authorityHelp}>{typeHelpText(row.signatory_type)}</small></td>
                      <td>{signatureReady ? <span className={styles.readyBadge}><CheckCircle2 size={14} />Ready</span> : <span className={styles.missingBadge}><CircleAlert size={14} />Missing</span>}</td>
                      <td><span className={row.is_active ? styles.activeBadge : styles.inactiveBadge}>{row.is_active ? "Active" : "Inactive"}</span></td>
                      <td>{shortDateTime(row.updated_at || row.created_at)}</td>
                      <td>
                        <div className={styles.actions}>
                          <button onClick={() => startEdit(row)} disabled={saving} title="Edit"><Pencil size={15} />Edit</button>
                          <button onClick={() => void toggleActive(row)} disabled={saving} title={row.is_active ? "Deactivate" : "Activate"}><ToggleLeft size={15} />{row.is_active ? "Deactivate" : "Activate"}</button>
                          <button className={styles.deleteButton} onClick={() => void remove(row)} disabled={saving} title="Delete"><Trash2 size={15} />Delete</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredRows.length === 0 && <tr><td colSpan={6}><div className={styles.emptyState}>No Payment Voucher signatories match the current filters.</div></td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        <section className={styles.noteCard}>
          <Signature size={18} />
          <div>
            <strong>PV Settings Note</strong>
            <p>Active Cheque Signers appear under “Cheque Signed By”. Active Counter Signers appear under “Counter Signed By”. “Both” appears in both lists. ReqGen blocks deletion when a name already appears on a historical voucher; deactivate that authority instead.</p>
          </div>
        </section>
      </div>
    </main>
  );
}
