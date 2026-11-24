// 3.0.2: printing inside the app. The website's A4 pages are drawn exactly as on the website,
// then saved as a PDF on the phone and opened, ready to print or share. Layout helpers are the website's own.
import { fitA4, useA4Fit } from "../../../../lib/printA4";
import { savePdf } from "../lib/files2";
export { fitA4, useA4Fit };

export async function printA4Sheet(page: HTMLElement | null | Array<HTMLElement | null>, title = "ReqGen document") {
  const pages = (Array.isArray(page) ? page : [page]).filter((p): p is HTMLElement => !!p);
  if (!pages.length) return;
  pages.forEach(fitA4);
  await savePdf(pages, title);
}
