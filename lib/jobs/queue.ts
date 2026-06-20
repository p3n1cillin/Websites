/**
 * Durable job queue (jobs table). enqueue() schedules an agent to run later;
 * the worker (lib/jobs/worker.ts) claims due jobs and dispatches them through the
 * agent runner. Service-role access throughout (no user session in the worker).
 *
 * This is deliberately a DB-backed queue — no new infra dep, same posture as the
 * rest of the app. To move to a hosted queue (QStash/Inngest) later, reimplement
 * enqueue()/claimDueJobs() against it; callers don't change.
 */

import type { AgentKind } from "../agents/types";
import { sbSelect, sbInsert, sbUpdate, supabaseWritable } from "../supabase/client";

export type JobStatus = "queued" | "running" | "done" | "failed";

export interface Job {
  id: string;
  orgId: string;
  kind: AgentKind;
  payload: unknown;
  status: JobStatus;
  attempts: number;
  maxAttempts: number;
  runAfter: string;
  lastError?: string | null;
}

interface JobRow {
  id: string;
  org_id: string;
  kind: string;
  payload: unknown;
  status: string;
  attempts: number;
  max_attempts: number;
  run_after: string;
  last_error: string | null;
}

function toJob(row: JobRow): Job {
  return {
    id: row.id,
    orgId: row.org_id,
    kind: row.kind as AgentKind,
    payload: row.payload,
    status: row.status as JobStatus,
    attempts: row.attempts,
    maxAttempts: row.max_attempts,
    runAfter: row.run_after,
    lastError: row.last_error,
  };
}

const JOB_COLS =
  "select=id,org_id,kind,payload,status,attempts,max_attempts,run_after,last_error";

/** Schedule an agent run. `runAfter` defaults to now. Returns the job id (or null). */
export async function enqueue(input: {
  orgId: string;
  kind: AgentKind;
  payload?: unknown;
  runAfter?: Date;
  maxAttempts?: number;
}): Promise<string | null> {
  if (!supabaseWritable) return null;
  const row = await sbInsert<{ id: string }>("jobs", {
    org_id: input.orgId,
    kind: input.kind,
    payload: input.payload ?? null,
    run_after: (input.runAfter ?? new Date()).toISOString(),
    max_attempts: input.maxAttempts ?? 3,
  });
  return row?.id ?? null;
}

/** Fetch the next batch of due, queued jobs (oldest first). */
export async function claimDueJobs(limit = 10): Promise<Job[]> {
  if (!supabaseWritable) return [];
  const now = new Date().toISOString();
  const rows = await sbSelect<JobRow>({
    query: `jobs?${JOB_COLS}&status=eq.queued&run_after=lte.${now}&order=run_after.asc&limit=${limit}`,
    tier: "service",
  });
  return rows.map(toJob);
}

/** Optimistic claim: flip queued→running, but only if still queued (best-effort lock). */
export async function markRunning(id: string): Promise<boolean> {
  if (!supabaseWritable) return false;
  const rows = await sbUpdate<JobRow>(
    "jobs",
    `id=eq.${encodeURIComponent(id)}&status=eq.queued`,
    { status: "running" }
  );
  return rows.length > 0;
}

export async function markDone(id: string): Promise<void> {
  if (!supabaseWritable) return;
  await sbUpdate<JobRow>("jobs", `id=eq.${encodeURIComponent(id)}`, { status: "done" });
}

/** Fail a job: retry (back to queued, delayed) until max_attempts, then give up. */
export async function markFailed(job: Job, error: string): Promise<void> {
  if (!supabaseWritable) return;
  const attempts = job.attempts + 1;
  const giveUp = attempts >= job.maxAttempts;
  await sbUpdate<JobRow>("jobs", `id=eq.${encodeURIComponent(job.id)}`, {
    status: giveUp ? "failed" : "queued",
    attempts,
    last_error: error.slice(0, 1000),
    // Exponential-ish backoff before the next attempt.
    run_after: giveUp ? undefined : new Date(Date.now() + attempts * 60_000).toISOString(),
  });
}
