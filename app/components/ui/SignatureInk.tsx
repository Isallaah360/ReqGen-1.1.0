"use client";

import { useEffect, useState } from "react";
import { extractSignatureInk } from "@/lib/signatureInk";

type InkState = { src: string; url: string | null; failed: boolean };

/**
 * ReqGen v3.1.5 — THE way a signature is shown (request print, voucher print,
 * profile preview). The stored image is passed through the Signature Ink
 * Engine (lib/signatureInk.ts): paper background removed, ink deepened, empty
 * space trimmed. The image always fits inside its slot (.rg-sig-slot) — it can
 * never spill over the document again.
 *
 * Until the cleaned ink is ready, nothing is drawn (no flash of the paper
 * background). If cleaning is impossible, the original is drawn with a
 * multiply blend so a light background still disappears on white paper.
 */
export default function SignatureInk({ src, alt = "Signature", className = "" }: { src: string | null | undefined; alt?: string; className?: string }) {
  const [state, setState] = useState<InkState | null>(null);

  useEffect(() => {
    if (!src) return;
    let alive = true;
    extractSignatureInk(src)
      .then((result) => { if (alive) setState({ src, url: result.url, failed: false }); })
      .catch(() => { if (alive) setState({ src, url: null, failed: true }); });
    return () => { alive = false; };
  }, [src]);

  if (!src) return null;
  const current = state && state.src === src ? state : null;
  if (!current) return <span className="rg-sig-pending" aria-hidden="true" />;

  return (
    // eslint-disable-next-line @next/next/no-img-element -- processed data URL / Supabase Storage signature; sized by .rg-sig-slot
    <img
      src={current.url || src}
      alt={alt}
      className={`rg-sig-img${current.failed ? " is-raw" : ""} ${className}`.trim()}
      draggable={false}
    />
  );
}
