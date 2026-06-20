/**
 * QA agent (Agent 4) — the quality gate every generated site clears before it ships.
 *
 * Read-only: it scores a Business × DesignDNA candidate (deterministically, see
 * lib/design/qa.ts) against its sibling sites for content uniqueness and returns a
 * QaReport with an overall score + pass/fail. The factory blocks "Use this design"
 * when a candidate fails; a batch caller can enqueue a regenerate.
 *
 * Inputs are passed in full (business + dna + siblings) so the handler stays pure and
 * testable — the data access happens in the caller (the factory action), which has
 * already confirmed org ownership.
 */

import type { Business } from "../types";
import type { DesignDNA } from "../design/types";
import { scoreSite, type QaReport } from "../design/qa";
import type { AgentDefinition } from "./types";

export interface QaAgentInput {
  business: Business;
  dna: DesignDNA;
  /** Other sites to de-duplicate copy against (e.g. the org's other businesses). */
  siblings?: Business[];
  threshold?: number;
}

export const qaAgent: AgentDefinition<QaAgentInput, QaReport> = {
  kind: "qa",
  title: "QA Gate",
  description:
    "Scores a generated site for completeness, content quality, design coherence and uniqueness.",
  defaultAutonomy: "suggest",
  sideEffecting: false,
  async handler(input) {
    const report = scoreSite(
      input.business,
      input.dna,
      input.siblings ?? [],
      input.threshold
    );
    return {
      output: report,
      summary: `QA ${report.overall}/100 — ${report.pass ? "pass" : "fail"} (threshold ${report.threshold}).`,
    };
  },
};
