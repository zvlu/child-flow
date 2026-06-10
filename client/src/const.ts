export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

/**
 * Active organization for all data queries. Single-tenant for now;
 * replace with an organization context when multi-tenant support lands.
 */
export const ORGANIZATION_ID = 1;

// Generate login URL at runtime so redirect URI reflects the current origin.
export const getLoginUrl = () => {
  const oauthPortalUrl = import.meta.env.VITE_OAUTH_PORTAL_URL;
  const appId = import.meta.env.VITE_APP_ID;
  
  // Basic check for existence
  if (!oauthPortalUrl || !appId) {
    return "/dashboard";
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
    return "/dashboard";
  }
};
