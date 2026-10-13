"use client";

import { useEffect, useState } from "react";
import { loadRoleDirectory, roleLabel, type RoleDirectory } from "@/lib/userIdentity";

/**
 * ReqGen v3.0.2 standard for showing a person: name followed by a role chip.
 * Pass the role when the page already knows it (e.g. the role recorded on an
 * audit or history event). If it is missing, the role is looked up from the
 * cached profile directory by user id, then by name.
 */
export function PersonName({
  name,
  role,
  userId,
  fallback = "—",
}: {
  name: string | null | undefined;
  role?: string | null;
  userId?: string | null;
  fallback?: string;
}) {
  const known = roleLabel(role);
  const [directory, setDirectory] = useState<RoleDirectory | null>(null);

  useEffect(() => {
    if (known) return;
    let alive = true;
    void loadRoleDirectory().then((dir) => { if (alive) setDirectory(dir); });
    return () => { alive = false; };
  }, [known]);

  const person = String(name ?? "").trim();
  if (!person) return <span className="rg-person">{fallback}</span>;
  if (/^system$/i.test(person)) return <span className="rg-person"><strong>System</strong></span>;

  const resolved = known || (directory ? directory.roleById(userId) || directory.roleByName(person) : "");

  return (
    <span className="rg-person">
      <strong>{person}</strong>
      {resolved ? <span className="rg-role-chip">{resolved}</span> : null}
    </span>
  );
}
