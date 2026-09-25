/**
 * Canonical ReqGen product version.
 *
 * IMPORTANT:
 * - ReqGen uses a four-part product release identifier (e.g. 2.0.0.2).
 * - npm package.json must remain valid SemVer (three numeric parts), so the
 *   product release identifier is kept separately as REQGEN_VERSION.
 */
export const REQGEN_VERSION = "2.0.0.10" as const;
export const REQGEN_PRODUCT_NAME = "ReqGen" as const;
export const REQGEN_PRODUCT_LABEL = `${REQGEN_PRODUCT_NAME} ${REQGEN_VERSION}` as const;
