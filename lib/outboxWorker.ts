import "server-only";

import { deliverOutboxBatch } from "@/lib/outbox";
import {
  recordOutboxSchedulerFailure,
  recordOutboxSchedulerStarted,
  recordOutboxSchedulerSuccess,
} from "@/lib/operationalHeartbeat";
import { purgeExpiredOperationalData } from "@/lib/retention";
import { runMembershipSweep } from "@/lib/membership/sweep";
import { kickCardExportJobs } from "@/lib/cards/exportJobs";

const OUTBOX_WORKER_INTERVAL_MS = 60_000;

type OutboxWorkerState = {
  started?: boolean;
  running?: boolean;
  timer?: ReturnType<typeof setInterval>;
};

function workerState() {
  return globalThis as typeof globalThis & { __sweOutboxWorker?: OutboxWorkerState };
}

/** Runs one complete delivery/retention pass and records its operational state. */
export async function runOutboxScheduler() {
  // Heartbeat persistence is observability, not part of the delivery commit.
  // A heartbeat-table issue must not stop otherwise healthy queue processing.
  await recordOutboxSchedulerStarted().catch(() => undefined);
  try {
    // Membership changes first, so reminders and notices they queue go out in the same pass.
    await runMembershipSweep().catch(() => console.error("[membership sweep] run failed"));
    const result = await deliverOutboxBatch();
    // Bulk card exports (background PDF/ZIP builds) run on their own, so a long render never holds this pass up.
    kickCardExportJobs();
    const purged = await purgeExpiredOperationalData();
    await recordOutboxSchedulerSuccess(result).catch(() => undefined);
    return { ...result, purged };
  } catch (error) {
    await recordOutboxSchedulerFailure(error).catch(() => undefined);
    throw error;
  }
}

/**
 * Start one polling worker per Node.js process. Queue row claims make this safe
 * across replicas; the singleton guard avoids duplicate timers during dev HMR.
 */
export function startOutboxWorker() {
  const runtime = workerState();
  if (runtime.__sweOutboxWorker?.started) return;

  const state: OutboxWorkerState = { started: true, running: false };
  runtime.__sweOutboxWorker = state;

  const tick = async () => {
    if (state.running) return;
    state.running = true;
    try {
      await runOutboxScheduler();
    } catch {
      // Failure metadata is persisted separately without exception text.
      console.error("[outbox worker] scheduler run failed");
    } finally {
      state.running = false;
    }
  };

  void tick();
  state.timer = setInterval(() => {
    void tick();
  }, OUTBOX_WORKER_INTERVAL_MS);
  state.timer.unref?.();
}
