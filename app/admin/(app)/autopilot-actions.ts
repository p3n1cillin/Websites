"use server";

import { requireOrg } from "@/lib/auth";
import { runAutopilot, type AutopilotResult } from "@/lib/autopilot";

/**
 * Operator-triggered Autopilot run — drives the whole funnel forward one pass
 * (discover → demos → outreach → ventures). Runs agents with auto autonomy (the
 * interactive-action convention). Returns a summary incl. what's blocked on a human.
 */
export async function runAutopilotNowAction(): Promise<{
  ok: boolean;
  result?: AutopilotResult;
  error?: string;
}> {
  const org = await requireOrg();
  try {
    const result = await runAutopilot({
      orgId: org.id,
      orgName: org.name,
      ownerUserId: org.ownerUserId,
    });
    return { ok: true, result };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Autopilot failed." };
  }
}
