// ── In-memory rate limiter ───────────────────────────────────────────────────
// Uses a Map with IP as key and an array of timestamps as value.
// Automatically cleans up expired entries every 5 minutes.

interface RateLimitEntry {
  timestamps: number[];
}

const LIMITS = {
  generate: { maxRequests: 20, windowMs: 60_000 }, // 20 req/min
  analyze: { maxRequests: 5, windowMs: 60_000 },   // 5 req/min
} as const;

const store = new Map<string, RateLimitEntry>();

// Cleanup stale entries every 5 minutes
const CLEANUP_INTERVAL = 5 * 60_000;
let lastCleanup = Date.now();

function cleanupIfNeeded(): void {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;

  const maxWindow = Math.max(LIMITS.generate.windowMs, LIMITS.analyze.windowMs);
  for (const [key, entry] of store.entries()) {
    entry.timestamps = entry.timestamps.filter((t) => now - t < maxWindow);
    if (entry.timestamps.length === 0) {
      store.delete(key);
    }
  }
}

/**
 * Check if a request from the given IP is within rate limits.
 * Returns `true` if allowed, `false` if rate limit exceeded.
 */
export function checkRateLimit(
  ip: string,
  type: "generate" | "analyze"
): boolean {
  cleanupIfNeeded();

  const now = Date.now();
  const { maxRequests, windowMs } = LIMITS[type];
  const key = `${type}:${ip}`;

  let entry = store.get(key);
  if (!entry) {
    entry = { timestamps: [] };
    store.set(key, entry);
  }

  // Remove timestamps outside the window
  entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs);

  if (entry.timestamps.length >= maxRequests) {
    return false; // Rate limit exceeded
  }

  entry.timestamps.push(now);
  return true; // Allowed
}

/**
 * Extract client IP from request headers.
 */
export function getClientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}
