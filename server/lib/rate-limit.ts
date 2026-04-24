import type { Request, Response, NextFunction } from "express";

/**
 * Tiny in-memory sliding-window rate limiter.
 *
 * Defence-in-depth for AI endpoints: stops a runaway client (or compromised
 * admin session) from burning OpenAI credits. Single-process scope is fine
 * for our deployment; if we ever scale horizontally, swap this for Redis.
 *
 * Key derivation: prefer authenticated user id (req.session.userId) so a
 * legitimate admin behind a NAT isn't punished by a colleague's traffic.
 * Falls back to client IP.
 */
type Bucket = { count: number; windowStart: number };

export function createRateLimiter(opts: {
  windowMs: number;
  max: number;
  name: string;
}) {
  const { windowMs, max, name } = opts;
  const buckets = new Map<string, Bucket>();

  // Garbage-collect expired buckets every windowMs to avoid unbounded growth.
  setInterval(() => {
    const now = Date.now();
    for (const [k, b] of buckets) {
      if (now - b.windowStart > windowMs) buckets.delete(k);
    }
  }, windowMs).unref?.();

  return function rateLimitMiddleware(req: Request, res: Response, next: NextFunction) {
    const userId = (req.session as any)?.userId;
    const ip = (req.ip || req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown")
      .toString().split(",")[0].trim();
    const key = `${name}:${userId ?? `ip:${ip}`}`;

    const now = Date.now();
    let b = buckets.get(key);
    if (!b || now - b.windowStart >= windowMs) {
      b = { count: 0, windowStart: now };
      buckets.set(key, b);
    }
    b.count += 1;

    const remaining = Math.max(0, max - b.count);
    const resetSeconds = Math.ceil((b.windowStart + windowMs - now) / 1000);
    res.setHeader("X-RateLimit-Limit", String(max));
    res.setHeader("X-RateLimit-Remaining", String(remaining));
    res.setHeader("X-RateLimit-Reset", String(resetSeconds));

    if (b.count > max) {
      res.setHeader("Retry-After", String(resetSeconds));
      return res.status(429).json({
        message: `Too many requests. Try again in ${resetSeconds}s.`,
        limiter: name,
      });
    }
    next();
  };
}
