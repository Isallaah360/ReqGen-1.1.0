import { askCode } from "../lib/core";
/** 3.0.2: the website's confirmWithCode, drawn by the app's own code sheet. */
export const confirmWithCode = (what = "confirm this", purpose: "action" | "sign_in" = "action") => askCode(what, purpose);
export const CODE_REQUIRED = /REQGEN_CODE_REQUIRED/;
export const plainCodeError = (message: string) => message.replace(/^.*REQGEN_CODE_REQUIRED:\s*/, "");
