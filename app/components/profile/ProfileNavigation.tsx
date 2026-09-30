"use client";

/**
 * v3.0.1: Profile section tabs are rendered once, by the global shell's
 * numbered ModuleTabs strip (see GovernmentAppShell). Existing Profile pages
 * still import this component, so it intentionally renders nothing to avoid a
 * second, duplicate tab strip inside the workspace.
 */
export default function ProfileNavigation() {
  return null;
}
