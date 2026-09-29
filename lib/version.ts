/**
 * Canonical ReqGen product version.
 *
 * IMPORTANT:
 * - ReqGen uses a two-part product release identifier: MAJOR.PATCH (e.g. 2.15).
 *   "2" is the ReqGen generation; "14" is the patch number. The next release
 *   after 2.15 is 2.16.
 * - This is the ONLY place the version is defined. The sidebar, footer, exports
 *   and reports all read REQGEN_VERSION from here — never hardcode it elsewhere.
 * - npm package.json must remain valid SemVer (three numeric parts), so it
 *   carries "2.15.0" for the same release; the product identifier stays here.
 */
export const REQGEN_VERSION = "2.15" as const;
export const REQGEN_PRODUCT_NAME = "ReqGen" as const;
export const REQGEN_PRODUCT_LABEL = `${REQGEN_PRODUCT_NAME} ${REQGEN_VERSION}` as const;
