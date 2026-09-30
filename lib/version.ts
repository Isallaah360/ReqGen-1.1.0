/**
 * Canonical ReqGen product version — the ONLY place it is defined.
 *
 * Format: MAJOR.MINOR.PATCH (Semantic Versioning), displayed with a
 * lower-case "v" prefix, e.g. "ReqGen v3.0.1".
 *   - MAJOR 3  = the ReqGen v3 generation (restructure series)
 *   - MINOR 0  = feature line
 *   - PATCH 1  = patch number; the next patch is v3.0.2
 *
 * The sidebar, footer, exports, print-outs and reports all read from here.
 * package.json "version" carries the same number without the "v".
 */
export const REQGEN_SEMVER = "3.0.1" as const;
export const REQGEN_VERSION = `v${REQGEN_SEMVER}` as const;
export const REQGEN_PRODUCT_NAME = "ReqGen" as const;
export const REQGEN_PRODUCT_LABEL = `${REQGEN_PRODUCT_NAME} ${REQGEN_VERSION}` as const;
