export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  /**
   * Opt-in escape hatch that injects a mock admin when no real session is
   * present. Off by default and force-disabled in production. Intended only for
   * local development without an OAuth server or seeded credentials.
   */
  allowDevAuthBypass: process.env.ALLOW_DEV_AUTH_BYPASS === "true",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
};

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
  return ENV.allowDevAuthBypass && !ENV.isProduction;
}
