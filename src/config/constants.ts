export const CONSTANTS = {
  RATE_LIMIT_POINTS: 1000, // 1000 requests
  RATE_LIMIT_DURATION: 3600, // 1 hour
} as const;

export const ONLINE_THRESHOLD_MS = 10 * 60 * 1000; // 5 minutes