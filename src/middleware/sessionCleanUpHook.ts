import { cleanupInactiveSessions } from "./sessionCleanup";

let lastRun = 0;
let isRunning = false;

const THROTTLE_MS = 60 * 1000;

export const sessionCleanupHook = async () => {
  const now = Date.now();

  if (now - lastRun < THROTTLE_MS) {
    console.log("[Cleanup] Skipped (throttled)");
    return;
  }

  if (isRunning) {
    console.log("[Cleanup] Skipped (already running)");
    return;
  }

  isRunning = true;
  lastRun = now;

  console.log("[Cleanup] Started");

  try {
    await cleanupInactiveSessions();
  } catch (err) {
    console.error("[Cleanup] Error:", err);
  } finally {
    isRunning = false;
    console.log("[Cleanup] Finished");
  }
};