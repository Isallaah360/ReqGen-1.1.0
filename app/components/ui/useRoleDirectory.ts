"use client";

import { useEffect, useState } from "react";
import { loadRoleDirectory, type RoleDirectory } from "@/lib/userIdentity";

export function useRoleDirectory(): RoleDirectory | null {
  const [directory, setDirectory] = useState<RoleDirectory | null>(null);
  useEffect(() => {
    let alive = true;
    void loadRoleDirectory().then((dir) => { if (alive) setDirectory(dir); });
    return () => { alive = false; };
  }, []);
  return directory;
}
