import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import Redis from "ioredis";
import { env } from "../env";

export interface RateLimiter {
  hit(key: string, windowSec: number): Promise<number>;
}

class MemoryRateLimiter implements RateLimiter {
  private readonly buckets = new Map<string, { count: number; resetAt: number }>();
  private readonly cleanup: NodeJS.Timeout;

  constructor() {
    this.cleanup = setInterval(() => this.sweep(), 60_000);
    this.cleanup.unref();
  }

  private sweep(): void {
    const now = Date.now();
    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= now) this.buckets.delete(key);
    }
  }

  async hit(key: string, windowSec: number): Promise<number> {
    const now = Date.now();
    const existing = this.buckets.get(key);
    if (!existing || existing.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + windowSec * 1000 });
      return 1;
    }
    existing.count += 1;
    return existing.count;
  }
}

class RedisRateLimiter implements RateLimiter {
  private readonly logger = new Logger(RedisRateLimiter.name);
  private readonly fallback = new MemoryRateLimiter();

  constructor(private readonly redis: Redis) {}

  async hit(key: string, windowSec: number): Promise<number> {
    try {
      const redisKey = `rl:${key}`;
      const count = await this.redis.incr(redisKey);
      if (count === 1) {
        await this.redis.expire(redisKey, windowSec);
      }
      return count;
    } catch (err) {
      this.logger.warn(`redis rate limiter unavailable, falling back to memory: ${String(err)}`);
      return this.fallback.hit(key, windowSec);
    }
  }
}

@Injectable()
export class RateLimiterService implements OnModuleDestroy {
  private limiter: RateLimiter;
  private redis: Redis | null = null;

  constructor() {
    const redisUrl = env().REDIS_URL;
    if (redisUrl) {
      this.redis = new Redis(redisUrl, {
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
        retryStrategy: (times) => Math.min(times * 1000, 30_000),
      });
      this.redis.on("error", () => {});
      this.limiter = new RedisRateLimiter(this.redis);
    } else {
      this.limiter = new MemoryRateLimiter();
    }
  }

  async hit(key: string, windowSec: number): Promise<number> {
    return this.limiter.hit(key, windowSec);
  }

  async ping(): Promise<boolean> {
    if (!this.redis) return false;
    try {
      const pong = await this.redis.ping();
      return pong === "PONG";
    } catch {
      return false;
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.redis) {
      this.redis.disconnect();
    }
  }
}
