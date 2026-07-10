export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

/**
 * Active organization for all data queries.
 *
 * This is a LIVE ES-module binding, not a constant: it starts at the
 * historical default (1) and useAuth syncs it to the signed-in user's real
 * organization as soon as the session resolves — before any org-scoped page
 * renders (AppLayout gates children on auth; Kiosk gates itself). Importers
 * read the current value at call time, so all ~50 pages became
 * multi-tenant-correct without changing their imports.
 *
 * The server independently enforces tenancy on every procedure
 * (enforceOrgScope); this binding only makes the client ask for the RIGHT
 * org rather than always org 1.
 */
export let ORGANIZATION_ID = 1;

/** Called by useAuth when the session user resolves. */
export function syncOrganizationId(orgId: number | null | undefined) {
  if (typeof orgId === "number" && orgId > 0) {
    ORGANIZATION_ID = orgId;
  }
}

// Generate login URL at runtime so redirect URI reflects the current origin.
export const getLoginUrl = () => {
  const oauthPortalUrl = import.meta.env.VITE_OAUTH_PORTAL_URL;
  const appId = import.meta.env.VITE_APP_ID;
  
  // Basic check for existence
  if (!oauthPortalUrl || !appId) {
    return "/signin";
  }

  try {
    // Ensure oauthPortalUrl is a valid URL string before passing to URL constructor
    const baseUrl = oauthPortalUrl.startsWith('http') ? oauthPortalUrl : `https://${oauthPortalUrl}`;
    const url = new URL(`${baseUrl}/app-auth`);

    const redirectUri = `${window.location.origin}/api/oauth/callback`;
    const state = btoa(redirectUri);

    url.searchParams.set("appId", appId);
    url.searchParams.set("redirectUri", redirectUri);
    url.searchParams.set("state", state);
    url.searchParams.set("type", "signIn");

    return url.toString();
  } catch (e) {
    console.error("Failed to construct login URL:", e);
    return "/signin";
  }
};
