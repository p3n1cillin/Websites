"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  PROSPECT_STATUSES,
  type Business,
  type OutreachMessage,
  type PreviewStats,
  type Proposal,
  type Prospect,
  type ProspectStatus,
  type SitePreview,
} from "@/lib/types";
import {
  analyseProspectAction,
  deleteProspectAction,
  setProspectStatusAction,
  generatePreviewAction,
  draftOutreachAction,
  markOutreachSentAction,
  dispatchOutreachAction,
  deleteOutreachAction,
  revokePreviewAction,
  setPreviewPasswordAction,
  onboardProspectAction,
  createProposalAction,
  sendProposalAction,
  markProposalAcceptedAction,
} from "./actions";
import { buildLeadIntelReport } from "@/lib/lead-intel";
import { buildBusinessIntelligence } from "@/lib/business-intel";

const STATUS_LABEL: Record<ProspectStatus, string> = {
  discovered: "Discovered",
  analysed: "Analysed",
  previewed: "Previewed",
  contacted: "Contacted",
  responded: "Responded",
  negotiating: "Negotiating",
  won: "Won",
  lost: "Lost",
};

const STATUS_ACCENT: Record<ProspectStatus, string> = {
  discovered: "border-slate-300",
  analysed: "border-indigo-300",
  previewed: "border-violet-300",
  contacted: "border-amber-300",
  responded: "border-sky-300",
  negotiating: "border-orange-300",
  won: "border-emerald-400",
  lost: "border-slate-200",
};

function scoreColor(score: number): string {
  if (score >= 70) return "bg-emerald-100 text-emerald-700";
  if (score >= 45) return "bg-amber-100 text-amber-700";
  return "bg-slate-100 text-slate-600";
}

const VERIFY_LABEL: Record<keyof NonNullable<Business["verification"]>, string> = {
  phone: "Phone number",
  email: "Email address",
  address: "Street address",
  rating: "Star rating",
  testimonials: "Customer reviews",
};

/**
 * Data-integrity checklist for a generated demo — surfaces which facts still need
 * a human before the site is client-ready ("never fake"). Verified facts are
 * counted but not listed; missing/template facts are called out to confirm/replace.
 */
function VerificationChecklist({ v }: { v: NonNullable<Business["verification"]> }) {
  const pending = (Object.keys(v) as (keyof typeof v)[]).filter((k) => v[k] !== "verified");
  if (pending.length === 0) {
    return (
      <p className="rounded-lg bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-700">
        ✓ All facts verified — safe to send.
      </p>
    );
  }
  return (
    <div className="rounded-lg bg-amber-50 p-2 text-[11px] text-amber-800">
      <p className="font-semibold">⚠ Verify before sending ({pending.length}):</p>
      <ul className="mt-0.5 space-y-0.5">
        {pending.map((k) => (
          <li key={k}>
            • {VERIFY_LABEL[k]} —{" "}
            <span className="text-amber-600">
              {v[k] === "missing" ? "add the real value" : "generic draft, confirm/replace"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const gbp = (pence: number) => `£${Math.round(pence / 100).toLocaleString()}`;

/**
 * Lead Intelligence Report — the sales ammunition for a prospect, assembled from
 * the website audit + scores + category economics (lib/lead-intel). Collapsed by
 * default; £ figures are clearly-labelled estimates, never claimed as fact.
 */
const SCORE_BAR = (v: number) => (v >= 70 ? "bg-emerald-500" : v >= 40 ? "bg-amber-500" : "bg-red-500");
const LEAK_DOT: Record<"high" | "medium" | "low", string> = {
  high: "text-red-600",
  medium: "text-amber-600",
  low: "text-slate-500",
};

/** Structured Business Intelligence (§4) — sub-scores + money-linked leaks + competitor gap. */
function IntelBlock({ prospect, peers }: { prospect: Prospect; peers: Prospect[] }) {
  const bi = buildBusinessIntelligence(prospect, peers);
  const subs: [string, number][] = [
    ["SEO", bi.scores.seo],
    ["UX", bi.scores.ux],
    ["Conversion", bi.scores.conversion],
  ];
  return (
    <div className="space-y-2 rounded-md bg-white p-2">
      <p className="font-semibold text-slate-700">Business intelligence</p>

      <div className="space-y-1">
        {subs.map(([label, v]) => (
          <div key={label} className="flex items-center gap-2">
            <span className="w-16 shrink-0 text-[11px] text-slate-500">{label}</span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
              <div className={`h-full rounded-full ${SCORE_BAR(v)}`} style={{ width: `${Math.max(3, v)}%` }} />
            </div>
            <span className="w-7 shrink-0 text-right text-[11px] font-medium text-slate-600">{v}</span>
          </div>
        ))}
      </div>

      {bi.revenueLeaks.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold text-slate-600">Revenue leaks</p>
          <ul className="mt-0.5 space-y-0.5">
            {bi.revenueLeaks.slice(0, 4).map((l, idx) => (
              <li key={idx} className="flex justify-between gap-2">
                <span><span className={LEAK_DOT[l.severity]}>•</span> {l.label}</span>
                <span className="shrink-0 font-medium text-red-600">{gbp(l.impactPence)}/mo</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-[11px] text-slate-500">
        Modelled loss: <span className="font-medium text-red-600">{gbp(bi.revenueLossRange.lowPence)}–{gbp(bi.revenueLossRange.highPence)}/mo</span>
        {" · "}~{bi.estMonthlyLeadLoss} lost enquiries/mo
      </p>

      {bi.competitorGap && (
        <p className={`text-[11px] ${bi.competitorGap.behind ? "text-red-600" : "text-emerald-600"}`}>
          {bi.competitorGap.summary}
        </p>
      )}
    </div>
  );
}

function LeadIntelPanel({ prospect, peers }: { prospect: Prospect; peers: Prospect[] }) {
  const r = buildLeadIntelReport(prospect);
  return (
    <details className="rounded-lg bg-slate-50 p-2 text-xs text-slate-600">
      <summary className="cursor-pointer select-none font-medium text-slate-700">
        Lead intelligence report
      </summary>
      <div className="mt-2 space-y-2">
        <p className="font-medium text-slate-800">{r.headline}</p>

        <div className="rounded-md bg-white p-2">
          <p className="font-semibold text-slate-700">
            Est. missed revenue: <span className="text-red-600">{gbp(r.roi.estMissedValuePence)}/mo</span>
          </p>
          <p className="text-[11px] text-slate-500">
            ~{r.roi.estMonthlyLeads} potential enquiries/mo · capturing ~{r.roi.capturedPct}% today
          </p>
        </div>

        <IntelBlock prospect={prospect} peers={peers} />

        {r.currentSite.problems.length > 0 && (
          <div>
            <p className="font-semibold text-slate-700">Current site problems</p>
            <ul className="mt-0.5 space-y-0.5">
              {r.currentSite.problems.map((x, idx) => (
                <li key={idx}>• {x}</li>
              ))}
            </ul>
          </div>
        )}

        {r.seoWeaknesses.length > 0 && (
          <div>
            <p className="font-semibold text-slate-700">SEO weaknesses</p>
            <ul className="mt-0.5 space-y-0.5">
              {r.seoWeaknesses.map((x, idx) => (
                <li key={idx}>• {x}</li>
              ))}
            </ul>
          </div>
        )}

        {r.conversionIssues.length > 0 && (
          <div>
            <p className="font-semibold text-slate-700">Conversion issues</p>
            <ul className="mt-0.5 space-y-0.5">
              {r.conversionIssues.map((x, idx) => (
                <li key={idx}>• {x}</li>
              ))}
            </ul>
          </div>
        )}

        <div>
          <p className="font-semibold text-slate-700">The opportunity</p>
          <ul className="mt-0.5 space-y-0.5">
            {r.opportunities.map((x, idx) => (
              <li key={idx}>• {x}</li>
            ))}
          </ul>
        </div>

        <p className="text-[10px] italic text-slate-400">{r.roi.assumptions.join(" ")}</p>
      </div>
    </details>
  );
}

export default function Board({
  prospects,
  previewByProspect = {},
  outreachByProspect = {},
  portalUrlByProspect = {},
  proposalByProspect = {},
  previewStats = {},
  siteUrl = "",
}: {
  prospects: Prospect[];
  previewByProspect?: Record<string, SitePreview>;
  outreachByProspect?: Record<string, OutreachMessage[]>;
  portalUrlByProspect?: Record<string, string>;
  proposalByProspect?: Record<string, Proposal>;
  previewStats?: Record<string, PreviewStats>;
  siteUrl?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const setKey = (k: string, v: boolean) => setBusy((b) => ({ ...b, [k]: v }));

  function run(key: string, fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    setKey(key, true);
    startTransition(async () => {
      try {
        const res = await fn();
        if (!res.ok) setError(res.error || "Action failed.");
        else router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Action failed.");
      } finally {
        setKey(key, false);
      }
    });
  }

  function move(p: Prospect, dir: -1 | 1) {
    const i = PROSPECT_STATUSES.indexOf(p.status);
    const next = PROSPECT_STATUSES[i + dir];
    if (!next) return;
    run(`move-${p.id}`, () => setProspectStatusAction(p.id, next));
  }

  const byStatus = (s: ProspectStatus) => prospects.filter((p) => p.status === s);

  return (
    <div className="space-y-3">
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <div className="flex gap-4 overflow-x-auto pb-4">
        {PROSPECT_STATUSES.map((status) => {
          const items = byStatus(status);
          return (
            <div key={status} className="w-72 flex-shrink-0">
              <div className="mb-2 flex items-center justify-between px-1">
                <h2 className="text-sm font-semibold text-slate-700">
                  {STATUS_LABEL[status]}
                </h2>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                  {items.length}
                </span>
              </div>

              <div className="space-y-3">
                {items.map((p) => {
                  const i = PROSPECT_STATUSES.indexOf(p.status);
                  const preview = previewByProspect[p.id];
                  const stats = preview ? previewStats[preview.id] : undefined;
                  const messages = outreachByProspect[p.id] ?? [];
                  const latestMsg = messages[0];
                  const portalUrl = portalUrlByProspect[p.id];
                  const proposal = proposalByProspect[p.id];
                  const proposalUrl = proposal ? `${siteUrl}/proposal/${proposal.token}` : null;
                  const busyCard =
                    busy[`move-${p.id}`] ||
                    busy[`qa-${p.id}`] ||
                    busy[`del-${p.id}`] ||
                    busy[`prev-${p.id}`] ||
                    busy[`out-${p.id}`] ||
                    busy[`prop-${p.id}`] ||
                    busy[`onb-${p.id}`];
                  return (
                    <div
                      key={p.id}
                      className={`rounded-xl border-l-4 border border-slate-200 bg-white p-3 shadow-sm ${STATUS_ACCENT[status]} ${
                        busyCard ? "opacity-60" : ""
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate font-medium text-slate-900">{p.name}</p>
                          <p className="text-xs capitalize text-slate-500">
                            {p.category}
                            {p.city ? ` · ${p.city}` : ""}
                          </p>
                        </div>
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${scoreColor(
                            p.opportunityScore
                          )}`}
                          title="Opportunity score"
                        >
                          {p.opportunityScore}
                        </span>
                      </div>

                      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-400">
                        <span>£{Math.round(p.valueEstimate / 100)}/yr est.</span>
                        {p.websiteUrl ? (
                          <a
                            href={p.websiteUrl.startsWith("http") ? p.websiteUrl : `https://${p.websiteUrl}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-slate-500 underline hover:text-slate-900"
                          >
                            site
                          </a>
                        ) : (
                          <span className="text-emerald-600">no site</span>
                        )}
                        {p.phone && <span>{p.phone}</span>}
                      </div>

                      {p.analysis && (
                        <div className="mt-2 rounded-lg bg-slate-50 p-2 text-xs text-slate-600">
                          <p>{p.analysis.summary}</p>
                          <p className="mt-1 font-medium text-slate-700">
                            Angle: <span className="font-normal">{p.analysis.angle}</span>
                          </p>
                          {p.analysis.audit && (
                            <div className="mt-1.5 border-t border-slate-200 pt-1.5">
                              <p className="font-medium text-slate-700">
                                Their site:{" "}
                                {p.analysis.audit.reachable ? (
                                  <span
                                    className={
                                      p.analysis.audit.overall >= 70
                                        ? "text-emerald-600"
                                        : p.analysis.audit.overall >= 40
                                          ? "text-amber-600"
                                          : "text-red-600"
                                    }
                                  >
                                    {p.analysis.audit.overall}/100
                                  </span>
                                ) : (
                                  <span className="text-red-600">didn&apos;t load</span>
                                )}
                              </p>
                              {p.analysis.audit.issues.slice(0, 3).map((iss, idx) => (
                                <p key={idx} className="text-slate-500">
                                  • {iss}
                                </p>
                              ))}
                              {(p.analysis.audit.signals.builder ||
                                (p.analysis.audit.signals.socials?.length ?? 0) > 0) && (
                                <p className="mt-1 text-[10px] text-slate-400">
                                  {p.analysis.audit.signals.builder
                                    ? `Tech: ${p.analysis.audit.signals.builder}`
                                    : ""}
                                  {p.analysis.audit.signals.builder &&
                                  p.analysis.audit.signals.socials?.length
                                    ? " · "
                                    : ""}
                                  {p.analysis.audit.signals.socials?.length
                                    ? `Social: ${p.analysis.audit.signals.socials.join(", ")}`
                                    : ""}
                                </p>
                              )}
                              {p.analysis.audit.reputation &&
                                (p.analysis.audit.reputation.platforms.length > 0 ||
                                  p.analysis.audit.reputation.onPageRating) && (
                                  <p className="mt-0.5 text-[10px] text-amber-600">
                                    Reviews:{" "}
                                    {p.analysis.audit.reputation.onPageRating?.value
                                      ? `${p.analysis.audit.reputation.onPageRating.value}/5 on-site · `
                                      : ""}
                                    {p.analysis.audit.reputation.platforms.length
                                      ? p.analysis.audit.reputation.platforms.join(", ")
                                      : "none shown"}
                                  </p>
                                )}
                            </div>
                          )}
                          {!p.analysis.ai && (
                            <p className="mt-1 text-[10px] uppercase tracking-wide text-slate-400">
                              heuristic (no AI key)
                            </p>
                          )}
                        </div>
                      )}

                      <div className="mt-2">
                        <LeadIntelPanel prospect={p} peers={prospects} />
                      </div>

                      <div className="mt-2.5 flex items-center gap-1">
                        <button
                          onClick={() => move(p, -1)}
                          disabled={i === 0 || busyCard}
                          title="Move back"
                          className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                        >
                          ◀
                        </button>
                        <button
                          onClick={() => move(p, 1)}
                          disabled={i === PROSPECT_STATUSES.length - 1 || busyCard}
                          title="Move forward"
                          className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                        >
                          ▶
                        </button>
                        <button
                          onClick={() => run(`qa-${p.id}`, () => analyseProspectAction(p.id))}
                          disabled={busyCard}
                          className="flex-1 rounded-md bg-slate-900 px-2 py-1 text-xs font-medium text-white hover:bg-slate-700 disabled:opacity-50"
                        >
                          {busy[`qa-${p.id}`] ? "Analysing…" : p.analysis ? "Re-analyse" : "Analyse"}
                        </button>
                        <button
                          onClick={() => run(`del-${p.id}`, () => deleteProspectAction(p.id))}
                          disabled={busyCard}
                          title="Delete prospect"
                          className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
                        >
                          ✕
                        </button>
                      </div>

                      {/* Sales: demo preview + outreach (Phase E). */}
                      <div className="mt-2.5 space-y-2 border-t border-slate-100 pt-2.5">
                        {/* Demo preview */}
                        {preview ? (
                          <>
                            <div className="flex items-center justify-between gap-2 text-xs">
                              <a
                                href={`/preview/${preview.token}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-medium text-violet-700 hover:underline"
                              >
                                View demo ↗
                              </a>
                              <span className="text-slate-400">
                                QA {preview.qaScore} · {preview.views} view{preview.views === 1 ? "" : "s"}
                              </span>
                              <button
                                onClick={() => {
                                  const pw = window.prompt(
                                    "Set a password for this demo link (leave blank to remove):",
                                    ""
                                  );
                                  if (pw === null) return;
                                  run(`prev-${p.id}`, () => setPreviewPasswordAction(preview.id, pw));
                                }}
                                disabled={busyCard}
                                title="Password-protect this demo link"
                                className="text-slate-400 hover:text-slate-900 disabled:opacity-30"
                              >
                                🔒
                              </button>
                              <button
                                onClick={() =>
                                  run(`prev-${p.id}`, () => revokePreviewAction(preview.id))
                                }
                                disabled={busyCard}
                                title="Revoke demo link"
                                className="text-slate-400 hover:text-red-600 disabled:opacity-30"
                              >
                                revoke
                              </button>
                            </div>
                            {p.analysis?.audit && (
                              <p className="text-[11px] text-emerald-600">
                                Beats their site:{" "}
                                {p.analysis.audit.reachable ? p.analysis.audit.overall : 0} → {preview.qaScore}
                              </p>
                            )}
                            {stats && (stats.views > 0 || stats.conversions > 0) && (
                              <p className="text-[11px] text-slate-500">
                                📊 {stats.views} open{stats.views === 1 ? "" : "s"}
                                {stats.conversions > 0 && ` · ${stats.conversions} action${stats.conversions === 1 ? "" : "s"}`}
                                {stats.dwellMs > 0 && ` · ~${Math.round(stats.dwellMs / 1000 / Math.max(stats.views, 1))}s avg`}
                              </p>
                            )}
                            {preview.businessDraft.verification && (
                              <VerificationChecklist v={preview.businessDraft.verification} />
                            )}
                          </>
                        ) : (
                          <button
                            onClick={() =>
                              run(`prev-${p.id}`, () => generatePreviewAction(p.id))
                            }
                            disabled={busyCard}
                            className="w-full rounded-md border border-violet-200 bg-violet-50 px-2 py-1 text-xs font-medium text-violet-700 hover:bg-violet-100 disabled:opacity-50"
                          >
                            {busy[`prev-${p.id}`] ? "Building demo…" : "Generate demo"}
                          </button>
                        )}

                        {/* Outreach */}
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() =>
                              run(`out-${p.id}`, () => draftOutreachAction(p.id))
                            }
                            disabled={busyCard}
                            className="flex-1 rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                          >
                            {busy[`out-${p.id}`]
                              ? "Drafting…"
                              : messages.length
                                ? "Draft another"
                                : "Draft outreach"}
                          </button>
                          {messages.length > 0 && (
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">
                              {messages.length}
                            </span>
                          )}
                        </div>

                        {latestMsg && (
                          <details className="rounded-lg bg-slate-50 p-2 text-xs text-slate-600">
                            <summary className="cursor-pointer select-none font-medium text-slate-700">
                              {latestMsg.subject || "Outreach draft"}
                              <span
                                className={`ml-1 font-normal ${
                                  latestMsg.status === "sent" ? "text-emerald-600" : "text-slate-400"
                                }`}
                              >
                                · {latestMsg.status}
                              </span>
                            </summary>
                            <pre className="mt-1.5 whitespace-pre-wrap break-words font-sans text-[11px] leading-snug text-slate-600">
                              {latestMsg.body}
                            </pre>
                            {!latestMsg.ai && (
                              <p className="mt-1 text-[10px] uppercase tracking-wide text-slate-400">
                                template (no AI key)
                              </p>
                            )}
                            <div className="mt-1.5 flex items-center gap-2">
                              {latestMsg.status === "draft" && (
                                <>
                                  {latestMsg.channel === "email" && (
                                    <button
                                      onClick={() =>
                                        run(`out-${p.id}`, () => dispatchOutreachAction(latestMsg.id))
                                      }
                                      disabled={busyCard}
                                      title="Email this to the prospect now (needs RESEND_API_KEY + their email)"
                                      className="rounded-md bg-emerald-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                                    >
                                      Send now
                                    </button>
                                  )}
                                  <button
                                    onClick={() =>
                                      run(`out-${p.id}`, () => markOutreachSentAction(latestMsg.id))
                                    }
                                    disabled={busyCard}
                                    className="rounded-md bg-slate-900 px-2 py-1 text-[11px] font-medium text-white hover:bg-slate-700 disabled:opacity-50"
                                  >
                                    Mark sent
                                  </button>
                                </>
                              )}
                              <button
                                onClick={() =>
                                  run(`out-${p.id}`, () => deleteOutreachAction(latestMsg.id))
                                }
                                disabled={busyCard}
                                className="text-[11px] text-slate-400 hover:text-red-600 disabled:opacity-30"
                              >
                                delete
                              </button>
                            </div>
                          </details>
                        )}

                        {/* Proposal — the closing asset (scope, price, timeline). */}
                        {proposal ? (
                          <div className="space-y-1.5 rounded-lg bg-indigo-50/60 p-2 text-xs">
                            <div className="flex items-center justify-between gap-2">
                              <a
                                href={proposalUrl ?? "#"}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-medium text-indigo-700 hover:underline"
                              >
                                View proposal ↗
                              </a>
                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                  proposal.status === "accepted"
                                    ? "bg-emerald-100 text-emerald-700"
                                    : proposal.status === "declined"
                                      ? "bg-slate-100 text-slate-500"
                                      : "bg-indigo-100 text-indigo-700"
                                }`}
                              >
                                {proposal.status}
                              </span>
                            </div>
                            <p className="truncate text-slate-400" title={proposalUrl ?? ""}>
                              {proposalUrl}
                            </p>
                            {proposal.status !== "accepted" && (
                              <button
                                onClick={() =>
                                  run(`prop-${p.id}`, () => markProposalAcceptedAction(proposal.id))
                                }
                                disabled={busyCard}
                                className="rounded-md bg-emerald-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                              >
                                Mark accepted → won
                              </button>
                            )}
                          </div>
                        ) : (
                          <button
                            onClick={() =>
                              run(`prop-${p.id}`, () => createProposalAction(p.id))
                            }
                            disabled={busyCard}
                            className="w-full rounded-md border border-indigo-200 bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
                          >
                            {busy[`prop-${p.id}`] ? "Drafting proposal…" : "Send proposal"}
                          </button>
                        )}

                        {/* Onboarding — only once the deal is won. */}
                        {p.status === "won" &&
                          (portalUrl ? (
                            <a
                              href={portalUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-center text-xs font-medium text-emerald-700 hover:bg-emerald-100"
                            >
                              Open customer portal ↗
                            </a>
                          ) : (
                            <button
                              onClick={() => run(`onb-${p.id}`, () => onboardProspectAction(p.id))}
                              disabled={busyCard}
                              className="w-full rounded-md bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                            >
                              {busy[`onb-${p.id}`] ? "Onboarding…" : "Onboard → create site"}
                            </button>
                          ))}
                      </div>
                    </div>
                  );
                })}

                {items.length === 0 && (
                  <div className="rounded-xl border border-dashed border-slate-200 px-3 py-6 text-center text-xs text-slate-300">
                    —
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
