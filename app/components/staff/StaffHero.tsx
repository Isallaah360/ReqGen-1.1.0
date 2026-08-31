import type { ReactNode } from "react";

type StaffHeroProps = {
  name: string;
  designation?: string;
  description: string;
  actions?: ReactNode;
  roleSwitcher?: ReactNode;
};

export default function StaffHero({ name, designation, description, actions, roleSwitcher }: StaffHeroProps) {
  return (
    <header className="rg-module-header staff-adopted-header">
      <div className="rg-module-heading">
        <h1>{designation || "Staff Overview"}</h1>
        <p className="rg-module-description">{description}</p>
        <p className="rg-context-line">{name}</p>
      </div>
      {(actions || roleSwitcher) ? <div className="rg-module-actions">{roleSwitcher}{actions}</div> : null}
    </header>
  );
}
