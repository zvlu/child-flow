export const COOKIE_NAME = "app_session_id";
export const ONE_YEAR_MS = 1000 * 60 * 60 * 24 * 365;
/**
 * Lifetime of a mobile (email/password) session token. Kept short relative to
 * the OAuth cookie because these tokens grant access to children's PII/PHI from
 * a device; clients re-authenticate (password or biometric) when it expires.
 */
export const MOBILE_SESSION_TTL_MS = 1000 * 60 * 60 * 12;
/**
 * Idle timeout for browser sessions. The cookie is re-issued on every
 * authenticated request (sliding window), so a session only expires after this
 * long with no API activity. Mobile uses MOBILE_SESSION_TTL_MS instead: the
 * token lives in the hardware Keychain and the app locks itself after
 * backgrounding (see ios/Sources/App/AppState.swift).
 */
export const WEB_SESSION_IDLE_TTL_MS = 1000 * 60 * 30;
export const AXIOS_TIMEOUT_MS = 30_000;
export const UNAUTHED_ERR_MSG = 'Please login (10001)';
export const NOT_ADMIN_ERR_MSG = 'You do not have required permission (10002)';
