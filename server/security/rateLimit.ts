import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

let limiter: Ratelimit | null | undefined;

function getLimiter() {
  if (limiter !== undefined) return limiter;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    limiter = null;
    return limiter;
  }
  limiter = new Ratelimit({
    redis: new Redis({ url, token }),
    limiter: Ratelimit.slidingWindow(30, "1 m"),
    prefix: "vouch-market:public-mutation",
    analytics: false,
  });
  return limiter;
}

export function clientRateLimitKey(headers: Record<string, string | string[] | undefined>, fallbackIp?: string) {
  const forwarded = headers["x-forwarded-for"];
  const firstForwarded = Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(",")[0];
  return `ip:${(firstForwarded ?? fallbackIp ?? "unknown").trim()}`;
}

export async function enforcePublicMutationRateLimit(identifier: string) {
  const activeLimiter = getLimiter();
  if (!activeLimiter) return;
  const result = await activeLimiter.limit(identifier);
  if (!result.success) throw new Error("Too many marketplace actions. Please wait a moment and try again.");
}
