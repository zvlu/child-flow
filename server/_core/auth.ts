import { MOBILE_SESSION_TTL_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { verifyPassword } from "./password";
import { sdk } from "./sdk";

/**
 * Email/password sign-in for the native mobile clients.
 *
 * The web app authenticates via the OAuth cookie flow (see oauth.ts). Mobile
 * clients have no browser session, so they POST credentials here and receive a
 * short-lived JWT which they send as `Authorization: Bearer <token>`
 * (see sdk.authenticateRequest / context.ts).
 */

/**
 * A syntactically valid scrypt hash of nothing in particular. We run a
 * verification against this when the account is missing or has no password set,
 * so an attacker can't distinguish those cases by response timing
 * (user enumeration).
 */
const DUMMY_HASH = `scrypt$${"0".repeat(32)}$${"0".repeat(128)}`;

function clientIp(req: Request): string | undefined {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.length > 0) {
    return fwd.split(",")[0]!.trim();
  }
  return req.ip;
}

export function registerAuthRoutes(app: Express) {
  /**
   * Who am I? Lets the mobile apps know the signed-in user's role so they can
   * show or hide admin-only functions (the server still enforces every
   * permission independently).
   */
  app.get("/api/auth/me", async (req: Request, res: Response) => {
    try {
      const user = await sdk.authenticateRequest(req);
      res.json({
        id: String(user.id),
        fullName: user.name ?? "",
        email: user.email ?? "",
        role: user.role,
      });
    } catch {
      res.status(401).json({ error: "Please sign in again" });
    }
  });

  app.post("/api/auth/login", async (req: Request, res: Response) => {
    const email =
      typeof req.body?.email === "string"
        ? req.body.email.trim().toLowerCase()
        : "";
    const password =
      typeof req.body?.password === "string" ? req.body.password : "";
    const ip = clientIp(req);

    if (!email || !password) {
      res.status(400).json({ error: "Email and password are required" });
      return;
    }

    const user = await db.getUserByEmail(email);

    // Always run a hash verification to keep response timing uniform whether or
    // not the account exists / has a password configured.
    const passwordOk = await verifyPassword(
      password,
      user?.passwordHash ?? DUMMY_HASH
    );

    if (!user || !user.passwordHash || !passwordOk) {
      await db.insertAuditLog({
        userId: user?.id ?? null,
        actorOpenId: user?.openId ?? null,
        action: "login_failed",
        resourceType: "auth",
        resourceId: email,
        ipAddress: ip,
      });
      // Generic message — never reveal whether the email exists.
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    const token = await sdk.createSessionToken(user.openId, {
      name: user.name ?? "",
      expiresInMs: MOBILE_SESSION_TTL_MS,
    });

    await db.insertAuditLog({
      userId: user.id,
      actorOpenId: user.openId,
      action: "login",
      resourceType: "auth",
      ipAddress: ip,
    });

    res.json({ token });
  });
}
