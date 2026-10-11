import { Moon, Sun, Sunrise, Sunset } from "lucide-react";

/**
 * ReqGen v4.1 greeting — one rule for the whole app.
 *   04:00–11:59 Good Morning · 12:00–15:59 Good Afternoon
 *   16:00–19:59 Good Evening · 20:00–03:59 Good Night
 * Each part of the day has its own coloured picture.
 */
export type DayPart = { text: string; Glyph: typeof Sun; colour: string; tint: string };

export function dayPart(hour: number): DayPart {
  if (hour >= 4 && hour < 12) return { text: "Good Morning", Glyph: Sunrise, colour: "#E8890C", tint: "#FFF3DF" };
  if (hour >= 12 && hour < 16) return { text: "Good Afternoon", Glyph: Sun, colour: "#F2A900", tint: "#FFF8D9" };
  if (hour >= 16 && hour < 20) return { text: "Good Evening", Glyph: Sunset, colour: "#D9541E", tint: "#FDEBE2" };
  return { text: "Good Night", Glyph: Moon, colour: "#4F5BD5", tint: "#ECEEFF" };
}

/** "ISAH USMAN BARDE" → "Isah" */
export function firstNameOf(full: string) {
  const first = (full || "").trim().split(/\s+/)[0] || "";
  return first ? first.charAt(0).toUpperCase() + first.slice(1).toLowerCase() : "";
}

export function DayIcon({ hour, size = 22 }: { hour: number; size?: number }) {
  const p = dayPart(hour);
  const G = p.Glyph;
  return (
    <span className="v4-dayicon" style={{ width: size + 18, height: size + 18, background: p.tint, color: p.colour }} aria-hidden="true">
      <G size={size} strokeWidth={2.2} fill={G === Moon ? p.colour : "none"} fillOpacity={G === Moon ? 0.25 : 0} />
    </span>
  );
}
