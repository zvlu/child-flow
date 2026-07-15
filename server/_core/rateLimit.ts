/**
 * Minimal in-memory fixed-window rate limiter, keyed by an arbitrary string
 * (typically `action:ip`). Good enough to blunt brute-force / signup-spam on a
 * single instance; a multi-instance deployment should swap this for a shared
 * store (e.g. Redis).
 */
import type { Request, Response } from "express";
import { clientIpFromReq } from "./audit";

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();
let lastSweep = 0;

function sweep(now: number) {
  // Occasionally drop expired buckets so the map can't grow unbounded.
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  buckets.forEach((b, key) => { if (now >= b.resetAt) buckets.delete(key); });
}

export function rateLimit(key: string, max: number, windowMs: number): { ok: boolean; retryAfterSec: number } {
  const now = Date.now();
  sweep(now);
  const b = buckets.get(key);
  if (!b || now >= b.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterSec: 0 };
  }
  if (b.count >= max) {
    return { ok: false, retryAfterSec: Math.ceil((b.resetAt - now) / 1000) };
  }
  b.count++;
  return { ok: true, retryAfterSec: 0 };
}

/**
 * Shared throttle wrapper for Express handlers. Keys the bucket on
 * `action:ip` and, if the caller is over the limit, writes a 429 response
 * and returns true (caller should return immediately). Extracted so any
 * route file can apply the same per-action IP throttling that auth.ts uses
 * for login/signup, instead of each file rolling its own copy.
 */
export function throttled(
  req: Request,
  res: Response,
  action: string,
  max: number,
  windowMs: number
): boolean {
  const ip = clientIpFromReq(req);
  const { ok, retryAfterSec } = rateLimit(`${action}:${ip}`, max, windowMs);
  if (!ok) {
    res.status(429).json({ error: "Too many attempts. Please try again later.", retryAfterSec });
    return true;
  }
  return false;
}
