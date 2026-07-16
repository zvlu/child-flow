import type { Request, Response, NextFunction } from "express";
import { rateLimit } from "./rateLimit";

/**
 * Baseline security response headers applied to every response.
 *
 * A strict Content-Security-Policy is intentionally NOT set here — it needs
 * per-deployment tuning (script/style sources, the Vite dev server) so it
 * doesn't break the SPA. Add CSP once it can be tested against the built app.
 */
export function securityHeaders(req: Request, res: Response, next: NextFunction) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-DNS-Prefetch-Control", "off");
  res.setHeader("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
  if (req.secure || req.headers["x-forwarded-proto"] === "https") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  next();
}

function ipOf(req: Request): string {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.length > 0) return fwd.split(",")[0]!.trim();
  return req.ip ?? "unknown";
}

/**
 * Coarse per-IP limit across the whole API surface (the auth endpoints keep
 * their own stricter limits). Generous enough not to affect normal use —
 * tRPC batching means a page load is only a handful of requests — but it caps
 * scripted abuse and the media-upload endpoints. Swap the in-memory store for
 * Redis on multi-instance deployments.
 */
export function apiRateLimiter(req: Request, res: Response, next: NextFunction) {
  const { ok, retryAfterSec } = rateLimit(`api:${ipOf(req)}`, 600, 60_000);
  if (!ok) {
    res.setHeader("Retry-After", String(retryAfterSec));
    res.status(429).json({ error: "Too many requests. Please slow down and try again." });
    return;
  }
  next();
}
