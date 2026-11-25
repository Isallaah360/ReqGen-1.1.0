import Coming from "../screens/Coming";

/**
 * App 4.0.0: the app screen for each office page. Every office is rebuilt as an app screen, office by
 * office (Payment Vouchers and Finance next, then Registry, Reports and Administration). A page not
 * rebuilt yet says so; the app never opens a website page.
 */
export function screenFor(_href: string, title: string) {
  return <Coming title={title} />;
}
