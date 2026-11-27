import { linkParts } from "@/lib/directLetter";

/** 6.3.2: message text with its web links made clickable (http and https only; they open in a new tab). */
export default function LinkText({ text }: { text: string | null | undefined }) {
  return <>{linkParts(String(text || "")).map((p, i) => (p.href ? <a key={i} className="rg-lnk" href={p.href} target="_blank" rel="noopener noreferrer">{p.text}</a> : <span key={i}>{p.text}</span>))}</>;
}
