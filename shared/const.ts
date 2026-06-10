export const COOKIE_NAME = "app_session_id";
export const ONE_YEAR_MS = 1000 * 60 * 60 * 24 * 365;
/**
 * Lifetime of a mobile (email/password) session token. Kept short relative to
 * the OAuth cookie because these tokens grant access to children's PII/PHI from
 * a device; clients re-authenticate (password or biometric) when it expires.
 */
export const MOBILE_SESSION_TTL_MS = 1000 * 60 * 60 * 12;
export const AXIOS_TIMEOUT_MS = 30_000;
export const UNAUTHED_ERR_MSG = 'Please login (10001)';
export const NOT_ADMIN_ERR_MSG = 'You do not have required permission (10002)';
