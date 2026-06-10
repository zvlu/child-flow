import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
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
