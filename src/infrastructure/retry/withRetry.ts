export interface RetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  onRetry?: (err: unknown, attempt: number) => void;
}

const RETRYABLE_NETWORK_CODES = new Set(['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'ECONNREFUSED']);
const NON_RETRYABLE_HTTP_STATUSES = new Set([400, 401, 403, 404]);

function isRetryable(err: unknown): boolean {
  if (!(err instanceof Error)) return false;

  const nodeErr = err as NodeJS.ErrnoException;
  if (nodeErr.code !== undefined && RETRYABLE_NETWORK_CODES.has(nodeErr.code)) return true;

  if (nodeErr.code === 'SQLITE_BUSY') return true;

  const httpErr = err as { status?: number };
  if (httpErr.status !== undefined) {
    if (NON_RETRYABLE_HTTP_STATUSES.has(httpErr.status)) return false;
    return httpErr.status === 429 || (httpErr.status >= 500 && httpErr.status < 600);
  }

  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const { maxAttempts = 3, baseDelayMs = 1000, maxDelayMs = 8000, onRetry } = options;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const isLast = attempt === maxAttempts - 1;
      if (isLast || !isRetryable(err)) throw err;

      const delay = Math.random() * Math.min(maxDelayMs, baseDelayMs * 2 ** attempt);
      onRetry?.(err, attempt + 1);
      await sleep(delay);
    }
  }

  // TypeScript requires a return but this is unreachable
  throw new Error('withRetry: exhausted all attempts');
}
