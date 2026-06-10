import { COOKIE_NAME, WEB_SESSION_IDLE_TTL_MS } from "@shared/const";
import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { getSessionCookieOptions } from "./cookies";
import { ENV } from "./env";
import { sdk } from "./sdk";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

/**
 * Mock admin used ONLY when ALLOW_DEV_AUTH_BYPASS=true and not in production.
 * This is an explicit, opt-in local-development escape hatch — it is never
 * injected implicitly and can never be active in a production build.
 */
const DEV_MOCK_USER: User = {
  id: 1,
  openId: "dev-test-user",
  name: "Test Administrator",
  email: "admin@childflow.org",
  loginMethod: "dev",
  passwordHash: null,
  role: "admin",
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
};

let warnedAboutDevBypass = false;

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    user = await sdk.authenticateRequest(opts.req);

    // Sliding idle timeout for browser sessions: every authenticated
    // cookie-based request re-issues the cookie with a fresh
    // WEB_SESSION_IDLE_TTL_MS window, so the session only expires after that
    // long with no activity. Mobile clients authenticate with a Bearer token
    // (fixed TTL) and are skipped.
    if (user && !opts.req.headers.authorization) {
      const refreshed = await sdk.createSessionToken(user.openId, {
        name: user.name ?? "",
        expiresInMs: WEB_SESSION_IDLE_TTL_MS,
      });
      opts.res.cookie(COOKIE_NAME, refreshed, {
        ...getSessionCookieOptions(opts.req),
        maxAge: WEB_SESSION_IDLE_TTL_MS,
      });
    }
  } catch (error) {
    // Authentication is optional for public procedures.
    user = null;
  }

  if (!user && ENV.allowDevAuthBypass && !ENV.isProduction) {
    if (!warnedAboutDevBypass) {
      console.warn(
        "[Auth] ALLOW_DEV_AUTH_BYPASS is enabled — injecting a mock admin for " +
          "unauthenticated requests. NEVER enable this outside local development."
      );
      warnedAboutDevBypass = true;
    }
    user = DEV_MOCK_USER;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
