// Once-a-minute background check for time-based Teams messages ("stenger om 1 time", purring kl. 11).
// Sales close by the clock (status stays "open"), so nothing else would notice the deadline.
import { checkDeadlines, notificationsEnabled } from "./notify";

const globalForScheduler = globalThis as unknown as { __vlScheduler?: NodeJS.Timeout };

export function start(): void {
  if (globalForScheduler.__vlScheduler || !notificationsEnabled()) return;
  const tick = () => {
    try {
      checkDeadlines();
    } catch (e) {
      console.error("[scheduler]", (e as Error).message);
    }
  };
  globalForScheduler.__vlScheduler = setInterval(tick, 60_000);
  globalForScheduler.__vlScheduler.unref();
  console.log("[scheduler] Teams-varsler er på");
}
