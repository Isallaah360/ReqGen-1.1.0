/** ReqGen v4 — how strong a new password is, in plain words (Change Password and Reset Password). */
export function passwordStrength(p: string) {
  const score = [p.length >= 8, p.length >= 12, /[A-Z]/.test(p), /[a-z]/.test(p), /\d/.test(p), /[^A-Za-z0-9]/.test(p)].filter(Boolean).length;
  if (!p) return { score, ok: false, text: "Use at least 8 characters.", tone: "var(--v4-muted)" };
  if (score <= 2 || p.length < 8) return { score, ok: false, text: "Weak — add capital letters, numbers and a symbol.", tone: "var(--v4-red)" };
  if (score <= 4) return { score, ok: true, text: "Good — longer is better.", tone: "var(--v4-amber)" };
  return { score, ok: true, text: "Strong.", tone: "var(--v4-green)" };
}
