/**
 * Job worker — drains due jobs and dispatches each through the agent runner.
 * Invoked by /api/jobs/tick (Vercel Cron) and safe to call repeatedly.
 *
 * The runner already records the agent_run, usage and cost; the worker only
 * manages job lifecycle (claim → run → done/retry).
 */

import { runAgent } from "../agents/runner";
import { claimDueJobs, markRunning, markDone, markFailed } from "./queue";

export interface TickResult {
  claimed: number;
  done: number;
  failed: number;
  results: Array<{ jobId: string; kind: string; status: string; costPence: number }>;
}

export async function tick(batch = 10): Promise<TickResult> {
  const jobs = await claimDueJobs(batch);
  const out: TickResult = { claimed: jobs.length, done: 0, failed: 0, results: [] };

  for (const job of jobs) {
    // Best-effort lock: skip if another worker already claimed it.
    const locked = await markRunning(job.id);
    if (!locked) continue;

    try {
      const result = await runAgent({
        kind: job.kind,
        input: job.payload,
        orgId: job.orgId,
        actorUserId: null, // autonomous
      });
      if (result.status === "failed") {
        await markFailed(job, result.error ?? "Agent run failed.");
        out.failed += 1;
      } else {
        await markDone(job.id);
        out.done += 1;
      }
      out.results.push({
        jobId: job.id,
        kind: job.kind,
        status: result.status,
        costPence: result.costPence,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await markFailed(job, message);
      out.failed += 1;
      out.results.push({ jobId: job.id, kind: job.kind, status: "failed", costPence: 0 });
    }
  }

  return out;
}
