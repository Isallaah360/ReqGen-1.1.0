import OfficeScreen from "../office/OfficeScreen";

/** 3.0.2: every office page opens inside the app (the website's own page, packed in the APK). */
export function screenFor(href: string, title: string) {
  return <OfficeScreen href={href} title={title} />;
}
