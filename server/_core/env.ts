export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  /** True only when NODE_ENV is *explicitly* "development". */
  isDevelopment: process.env.NODE_ENV === "development",
  /**
   * Opt-in escape hatch that injects a mock admin when no real session is
   * present. Off by default. Intended only for local development without an
   * OAuth server or seeded credentials. Gated by `devAuthBypassEnabled()`.
   */
  allowDevAuthBypass: process.env.ALLOW_DEV_AUTH_BYPASS === "true",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
};

/**
 * The dev auth bypass is active only when explicitly enabled AND NODE_ENV is
 * explicitly "development" (fail-closed). Requiring a positive development
 * marker — rather than merely "not production" — means a deploy that forgets to
 * set NODE_ENV (the common mistake) can never silently run with an open bypass.
 */
export function devAuthBypassEnabled(): boolean {
  return ENV.allowDevAuthBypass && ENV.isDevelopment;
}

/**
 * Boot-time guard: refuse to start if the bypass is enabled outside an explicit
 * development environment. Call once during server bootstrap.
 */
export function assertSafeAuthConfig(): void {
  if (ENV.allowDevAuthBypass && !ENV.isDevelopment) {
    throw new Error(
      "ALLOW_DEV_AUTH_BYPASS=true but NODE_ENV is not 'development'. " +
      "Refusing to start with an open auth bypass. Unset ALLOW_DEV_AUTH_BYPASS for this environment."
    );
  }
}

/**
 * Platform owner = the super-admin who manages organizations across the whole
 * deployment. In production this MUST match the configured OWNER_OPEN_ID. When
 * no owner is configured (local dev), the dev-auth-bypass admin is treated as
 * owner — and the bypass is force-disabled in production, so this never grants
 * owner access in prod.
 */
export function isPlatformOwner(openId: string | null | undefined): boolean {
  if (!openId) return false;
  if (ENV.ownerOpenId) return openId === ENV.ownerOpenId;
  return devAuthBypassEnabled();
}
