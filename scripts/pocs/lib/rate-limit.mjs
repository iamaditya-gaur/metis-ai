const state = new Map();

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function waitForRateLimit(bucket, minIntervalMs) {
  if (!minIntervalMs || minIntervalMs <= 0) {
    return;
  }

  const now = Date.now();
  const lastStartedAt = state.get(bucket) ?? 0;
  const waitMs = Math.max(0, lastStartedAt + minIntervalMs - now);

  if (waitMs > 0) {
    await sleep(waitMs);
  }

  state.set(bucket, Date.now());
}

export function readRateLimitMs(envKey, fallbackMs) {
  const raw = process.env[envKey]?.trim();

  if (!raw) {
    return fallbackMs;
  }

  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallbackMs;
}
