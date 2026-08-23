import { Redis } from "@upstash/redis";

const PUBLIC_BOARD_KEY = "vouch-market:public-board:v1";
const PUBLIC_BOARD_TTL_SECONDS = 45;
let redis: Redis | null | undefined;

export function isUpstashConfigured(env: NodeJS.ProcessEnv = process.env) {
  return Boolean(env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN);
}

function getRedis() {
  if (redis !== undefined) return redis;
  if (!isUpstashConfigured()) {
    redis = null;
    return redis;
  }
  redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });
  return redis;
}

export async function getCachedPublicBoard<T>(loader: () => Promise<T>): Promise<T> {
  const client = getRedis();
  if (!client) return loader();
  try {
    const cached = await client.get<T>(PUBLIC_BOARD_KEY);
    if (cached) return cached;
    const fresh = await loader();
    await client.set(PUBLIC_BOARD_KEY, fresh, { ex: PUBLIC_BOARD_TTL_SECONDS });
    return fresh;
  } catch (error) {
    console.warn("[Upstash] Public board cache unavailable; falling back to database", error);
    return loader();
  }
}

export async function invalidatePublicBoardCache() {
  const client = getRedis();
  if (!client) return;
  try {
    await client.del(PUBLIC_BOARD_KEY);
  } catch (error) {
    console.warn("[Upstash] Public board invalidation skipped", error);
  }
}
