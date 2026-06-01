interface RateLimitState {
  count: number;
  windowStart: number;
}

// Simple in-memory rate limiter: max N requests per window (ms) per user
export class RateLimiter {
  private readonly state = new Map<number, RateLimitState>();

  constructor(
    private readonly maxRequests: number,
    private readonly windowMs: number,
  ) {}

  isAllowed(userId: number): boolean {
    const now = Date.now();
    const entry = this.state.get(userId);

    if (!entry || now - entry.windowStart > this.windowMs) {
      this.state.set(userId, { count: 1, windowStart: now });
      return true;
    }

    if (entry.count < this.maxRequests) {
      entry.count++;
      return true;
    }

    return false;
  }
}

// 10 messages per 60 seconds per user
export const rateLimiter = new RateLimiter(10, 60_000);
