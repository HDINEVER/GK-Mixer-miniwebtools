/**
 * White-label / Brand Edition configuration.
 *
 * - In the main multi-brand repository, `DEFAULT_BRAND_EDITION` is `"ALL"`.
 * - In the Night Works distribution repository (`GK-mixer-Distribution-Network`),
 *   `scripts/prepare-nightworks-repo.mjs` rewrites `DEFAULT_BRAND_EDITION` to `"Night Works"`,
 *   and `VITE_BRAND_EDITION` can also override it at build/dev time.
 */
export type BrandEdition = "ALL" | "Night Works";

export const DEFAULT_BRAND_EDITION: BrandEdition = "ALL";

const envEdition = (
  typeof import.meta !== "undefined" &&
  (import.meta as unknown as { env?: Record<string, string | undefined> }).env
    ?.VITE_BRAND_EDITION
)?.trim();

export const BRAND_EDITION: BrandEdition =
  envEdition === "Night Works" ? "Night Works" : DEFAULT_BRAND_EDITION;

export const IS_SINGLE_BRAND_EDITION: boolean = BRAND_EDITION !== "ALL";
export const IS_NIGHTWORKS_EDITION: boolean = BRAND_EDITION === "Night Works";
