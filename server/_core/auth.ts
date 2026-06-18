import { MOBILE_SESSION_TTL_MS, COOKIE_NAME, WEB_SESSION_IDLE_TTL_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import { randomUUID } from "crypto";
import * as db from "../db";
import { hashPassword, verifyPassword } from "./password";
import { getSessionCookieOptions } from "./cookies";
import { rateLimit } from "./rateLimit";
import { sdk } from "./sdk";

/**
 * Throttle an endpoint by client IP. Returns true if the request was rejected
 * (and has already written a 429 response).
 */
function throttled(req: Request, res: Response, action: string, max: number, windowMs: number): boolean {
  const ip = clientIp(req) ?? "unknown";
  const { ok, retryAfterSec } = rateLimit(`${action}:${ip}`, max, windowMs);
  if (!ok) {
    res.setHeader("Retry-After", String(retryAfterSec));
    res.status(429).json({ error: "Too many attempts. Please wait a bit and try again." });
    return true;
  }
  return false;
}

/** Issue a web session cookie for openId (mirrors the OAuth callback). */
async function setWebSession(req: Request, res: Response, openId: string, name: string) {
  const token = await sdk.createSessionToken(openId, { name, expiresInMs: WEB_SESSION_IDLE_TTL_MS });
  res.cookie(COOKIE_NAME, token, { ...getSessionCookieOptions(req), maxAge: WEB_SESSION_IDLE_TTL_MS });
}

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
    if (throttled(req, res, "login", 10, 10 * 60 * 1000)) return;
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

  /**
   * Web email/password sign-in. Same credential check as /api/auth/login, but
   * sets the browser session cookie instead of returning a bearer token.
   */
  app.post("/api/auth/web-login", async (req: Request, res: Response) => {
    if (throttled(req, res, "login", 10, 10 * 60 * 1000)) return;
    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    const ip = clientIp(req);
    if (!email || !password) {
      res.status(400).json({ error: "Email and password are required" });
      return;
    }
    const user = await db.getUserByEmail(email);
    const passwordOk = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !user.passwordHash || !passwordOk) {
      await db.insertAuditLog({ userId: user?.id ?? null, actorOpenId: user?.openId ?? null, action: "login_failed", resourceType: "auth", resourceId: email, ipAddress: ip });
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }
    await setWebSession(req, res, user.openId, user.name ?? "");
    await db.insertAuditLog({ userId: user.id, actorOpenId: user.openId, action: "login", resourceType: "auth", ipAddress: ip });
    res.json({ success: true });
  });

  /**
   * Self-serve web sign-up: creates an admin account + its own organization and
   * signs in. Tenant isolation (org-scoped routes) keeps the new org's data
   * separate from every other program.
   */
  app.post("/api/auth/web-signup", async (req: Request, res: Response) => {
    if (throttled(req, res, "signup", 5, 60 * 60 * 1000)) return;
    const programName = typeof req.body?.programName === "string" ? req.body.programName.trim() : "";
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    const ip = clientIp(req);

    if (!programName || !name || !email || password.length < 8) {
      res.status(400).json({ error: "Program name, your name, a valid email, and an 8+ character password are required." });
      return;
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      res.status(400).json({ error: "Enter a valid email address." });
      return;
    }
    if (await db.getUserByEmail(email)) {
      res.status(409).json({ error: "An account with that email already exists. Try signing in." });
      return;
    }

    const openId = `local:${randomUUID()}`;
    await db.upsertUser({ openId, name, email, role: "admin", loginMethod: "password", lastSignedIn: new Date() });
    await db.setUserPassword(openId, await hashPassword(password));
    const created = await db.getUserByOpenId(openId);
    if (!created) {
      res.status(500).json({ error: "Could not create your account. Please try again." });
      return;
    }
    const org = await db.createOrganization({
      name: programName,
      agencyId: `ORG-${created.id}`,
      ownerId: created.id,
      subscriptionTier: "starter",
      maxChildren: 100,
      maxStaff: 20,
      isActive: 1,
    });
    await db.assignUserOrganization(openId, Number(org.id));
    await setWebSession(req, res, openId, name);
    await db.insertAuditLog({ userId: created.id, actorOpenId: openId, action: "signup", resourceType: "auth", resourceId: `org:${org.id}`, ipAddress: ip });
    res.json({ success: true });
  });
}
