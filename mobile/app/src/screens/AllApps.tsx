import { useMemo, useState, type ReactNode } from "react";
import { LayoutGrid, Search } from "lucide-react";
import { Body, Head, useNav } from "../ui";
import { AppGrid, iconFor, tileColor, useOffices, type AppIcon } from "./Offices";
import { pageIcon } from "../lib/appIcons";
import { screenFor } from "../lib/screens";
import type { ModuleDef } from "../lib/offices";

/**
 * 4.2.2: every page this position can open, as app icons, office by office (like a phone's app drawer).
 * The home screen shows two rows; the More icon (four rounded squares) opens this.
 */
const TONE_RED = "#EF3F27";
export function pageApps(offices: ModuleDef[], push: (n: ReactNode) => void): Array<{ office: ModuleDef; apps: AppIcon[] }> {
  return offices.map((m) => ({
    office: m,
    apps: m.tiles.map((t, i) => ({ key: t.href, label: t.title, icon: pageIcon(t.title, iconFor(t.icon)), color: t.tone === "red" ? TONE_RED : tileColor(i)[0], onClick: () => push(screenFor(t.href, t.title)) })),
  }));
}

export const moreIcon = <span className="app-svg"><LayoutGrid size={28} /></span>;

export default function AllApps({ everyday }: { everyday: AppIcon[] }) {
  const offices = useOffices();
  const { push } = useNav();
  const [q, setQ] = useState("");
  const groups = useMemo(() => pageApps(offices, push), [offices, push]);
  const k = q.trim().toLowerCase();
  const match = (a: AppIcon) => !k || a.label.toLowerCase().includes(k);
  const shownEveryday = everyday.filter(match);
  const shown = groups.map((g) => ({ ...g, apps: g.apps.filter((a) => match(a) || (!!k && g.office.label.toLowerCase().includes(k))) })).filter((g) => g.apps.length);
  return (
    <>
      <Head title="All apps" />
      <Body>
        <label className="search-in">
          <Search size={18} aria-hidden="true" />
          <input className="inp" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a page, for example Staff" aria-label="Find a page" />
        </label>
        {shownEveryday.length ? <><div className="sect"><b>Everyday</b></div><AppGrid label="Everyday" items={shownEveryday} /></> : null}
        {shown.map((g) => (
          <div key={g.office.key}>
            <div className="sect"><b>{g.office.label}</b></div>
            <AppGrid label={g.office.label} items={g.apps} />
          </div>
        ))}
        {!shownEveryday.length && !shown.length ? <p className="mu" style={{ textAlign: "center" }}>Nothing matches “{q}”.</p> : null}
      </Body>
    </>
  );
}
