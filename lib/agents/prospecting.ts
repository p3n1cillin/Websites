/**
 * Prospecting agent (Agent 7) — turns an analysed prospect into a sales asset.
 *
 * It scaffolds a complete, credible Business from the prospect's attributes,
 * generates a Design DNA, runs the QA gate, and (on `auto`) persists a
 * `site_preview` with an opaque, expiring token — the demo we show the prospect
 * at /preview/[token] before any conversation. On `auto` it also advances the
 * prospect to `previewed`.
 *
 * The draft copy is honest baseline content from per-category templates (never
 * empty placeholder); when an AI key is configured it refines the headline copy
 * (tagline + about) — otherwise the template copy stands and is clearly a draft
 * for a sales conversation, not passed off as the prospect's own site.
 */

import { aiConfigured } from "../ai/client";
import { getAiCache, setAiCache, aiCacheKey } from "../ai/cache";
import { generateDesignDNA } from "../design/dna";
import { scoreSite } from "../design/qa";
import { TASTE_COPY_RULES } from "../design/taste";
import {
  createSitePreview,
  defaultPreviewExpiry,
  draftBusinessFromProspect,
  generatePreviewToken,
} from "../previews";
import { updateProspectStatus } from "../prospects";
import { getIndustryKnowledge, recordIndustryProfile } from "../knowledge";
import { SITE_URL } from "../seo";
import type { Business, Prospect, SitePreview } from "../types";
import type { AgentDefinition } from "./types";

export interface ProspectingAgentInput {
  prospect: Prospect;
}

/** Shape of the AI Industry Profiler's JSON output (also the cache value shape). */
interface IndustryProfileAi {
  categoryLabel: string;
  primaryService: string;
  tagline: string;
  about: string;
  services: { name: string; description: string; price?: string }[];
  badges: string[];
  highlights?: { heading?: string; items: { title: string; description: string }[] };
  faqs?: { question: string; answer: string }[];
  menu?: { heading?: string; sections: { name: string; items: { name: string; description?: string; price?: string }[] }[] };
}

export interface ProspectingAgentOutput {
  applied: boolean;
  qaScore: number;
  qaPass: boolean;
  /** Present only when applied (the preview was persisted). */
  previewId?: string;
  token?: string;
  url?: string;
}

export const prospectingAgent: AgentDefinition<ProspectingAgentInput, ProspectingAgentOutput> = {
  kind: "prospecting",
  title: "Prospecting",
  description:
    "Builds a tokenised demo site for a prospect and runs it through the QA gate — the sales asset.",
  defaultAutonomy: "approve",
  sideEffecting: true,
  async handler(input, ctx) {
    const p = input.prospect;
    const draft = draftBusinessFromProspect(p);
    const dna = generateDesignDNA(draft);

    // AI Industry Profiler — the universal-industry capability. For ANY business
    // type (not just the core trades) it generates a tailored profile: the right
    // category label, services, trust badges and headline copy. The per-category
    // template is the deterministic stub when no key is set, so the draft is always
    // honest — a collectables shop gets collectables services, never plumbing.
    const industry = draft.industryLabel || draft.categoryLabel;
    let profileFromCache = false;
    if (aiConfigured) {
      // Learning loop A: feed back what we've learned this industry needs (as
      // guidance only — copy stays unique per business, preserving "no two alike").
      const known = await getIndustryKnowledge(ctx.orgId, industry);
      const guidance = known
        ? ` What we've learned this industry needs — typical services: ${known.services.slice(0, 6).join(", ")}; common questions: ${known.faqs.slice(0, 4).join("; ")}. Use as guidance, but write fresh copy unique to this business.`
        : "";
      // Token economy: the profiler is the most expensive call here. Cache its
      // result per (prospect + industry + personality) so re-building a demo for
      // the same prospect is a zero-cost cache hit — we never pay twice. Copy stays
      // unique ACROSS businesses because the key is prospect-specific.
      const cacheKey = aiCacheKey("prospecting-profile-v1", p.id, industry, dna.personality);
      let value = await getAiCache<IndustryProfileAi>(ctx.orgId, cacheKey);
      profileFromCache = value !== null;
      if (!value) {
      ({ value } = await ctx.ai.completeJson<IndustryProfileAi>({
        tier: "smart",
        maxTokens: 1300,
        system:
          "You are an expert who understands every industry. Given a local business, produce realistic website content for it, using the conventions, services and trust signals customers of THAT industry actually expect. Be concrete and local; never invent awards, named accreditations or specific prices you can't know (use 'Enquire'/'Free quote' where unknown). Output: a short category label; a primary service noun; a one-line tagline; a 50–80 word about paragraph; 4 services; 3 trust badges; a 'highlights' grid of 3–6 industry-specific specialties (e.g. practice areas for a solicitor, treatments for a clinic, product categories for a shop) each with a title + one-sentence description; 3–5 FAQs real customers of this industry ask; and a 'menu' ONLY if this is a food business (restaurant/café/takeaway) — otherwise OMIT menu entirely.\n\n" +
          TASTE_COPY_RULES,
        prompt: `Business: "${draft.name}", a ${industry} in ${draft.address.city}. Tone: ${dna.personality.replace(/-/g, " ")}. Write its website profile and the sections it needs.${guidance}`,
        schema: {
          type: "object",
          properties: {
            categoryLabel: { type: "string" },
            primaryService: { type: "string" },
            tagline: { type: "string" },
            about: { type: "string" },
            services: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  description: { type: "string" },
                  price: { type: "string" },
                },
                required: ["name", "description"],
              },
            },
            badges: { type: "array", items: { type: "string" } },
            highlights: {
              type: "object",
              properties: {
                heading: { type: "string" },
                items: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: { title: { type: "string" }, description: { type: "string" } },
                    required: ["title", "description"],
                  },
                },
              },
            },
            faqs: {
              type: "array",
              items: {
                type: "object",
                properties: { question: { type: "string" }, answer: { type: "string" } },
                required: ["question", "answer"],
              },
            },
            menu: {
              type: "object",
              properties: {
                heading: { type: "string" },
                sections: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      items: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            name: { type: "string" },
                            description: { type: "string" },
                            price: { type: "string" },
                          },
                          required: ["name"],
                        },
                      },
                    },
                    required: ["name", "items"],
                  },
                },
              },
            },
          },
          required: ["categoryLabel", "tagline", "about", "services", "badges"],
        },
        stubValue: {
          categoryLabel: draft.categoryLabel,
          primaryService: draft.primaryService,
          tagline: draft.tagline,
          about: draft.about,
          services: draft.services.map((s) => ({ name: s.name, description: s.description, price: s.price })),
          badges: draft.badges,
          faqs: draft.faqs,
        },
      }));
        // Cache the generated profile so a re-build of this prospect is free.
        if (value?.categoryLabel) await setAiCache(ctx.orgId, cacheKey, value, "smart");
      }
      if (value?.categoryLabel) draft.categoryLabel = value.categoryLabel;
      if (value?.primaryService) draft.primaryService = value.primaryService;
      if (value?.tagline) draft.tagline = value.tagline;
      if (value?.about && value.about.split(/\s+/).length >= 30) draft.about = value.about;
      if (value?.services?.length && value.services.length >= 3) {
        const icons = ["star", "sparkles", "shield", "leaf"] as const;
        draft.services = value.services.slice(0, 6).map((s, i) => ({
          name: s.name,
          description: s.description,
          price: s.price,
          icon: icons[i % icons.length],
        }));
      }
      if (value?.badges?.length && value.badges.length >= 2) draft.badges = value.badges.slice(0, 4);
      // Industry-specific sections (#4) — only set when the model returned them.
      if (value?.highlights?.items?.length) {
        draft.highlights = {
          heading: value.highlights.heading,
          items: value.highlights.items.slice(0, 6),
        };
      }
      if (value?.faqs?.length) draft.faqs = value.faqs.slice(0, 6);
      if (value?.menu?.sections?.length) {
        draft.menu = {
          heading: value.menu.heading,
          sections: value.menu.sections
            .filter((s) => s.items?.length)
            .slice(0, 6)
            .map((s) => ({ name: s.name, items: s.items.slice(0, 12) })),
        };
      }

      // Learning loop A (write-back): accrue what this industry needs. Structure
      // only (names/topics) — never the bespoke copy — so it guides, not clones.
      await recordIndustryProfile(ctx.orgId, {
        industry,
        categoryLabel: draft.categoryLabel,
        services: draft.services.map((s) => s.name),
        highlights: draft.highlights?.items.map((h) => h.title) ?? [],
        faqs: draft.faqs?.map((f) => f.question) ?? [],
        personality: dna.personality,
        needsMenu: Boolean(draft.menu),
      });
    }

    // QA gate (deterministic; no siblings — a sales preview isn't org-deduped).
    const qa = scoreSite(draft, dna);

    const applied = ctx.autonomy === "auto";
    let preview: SitePreview | null = null;
    if (applied) {
      const token = generatePreviewToken();
      preview = await createSitePreview({
        orgId: ctx.orgId,
        prospectId: p.id,
        businessDraft: draft,
        designDna: dna,
        qaScore: qa.overall,
        qaReport: qa,
        token,
        expiresAt: defaultPreviewExpiry(),
      });
      // Advance the pipeline (never regress a deal already further along).
      if (p.status === "discovered" || p.status === "analysed") {
        await updateProspectStatus(p.id, "previewed");
      }
    }

    const url = preview ? `${SITE_URL}/preview/${preview.token}` : undefined;
    return {
      output: {
        applied,
        qaScore: qa.overall,
        qaPass: qa.pass,
        previewId: preview?.id,
        token: preview?.token,
        url,
      },
      summary: applied
        ? `Built a demo for ${p.name} (QA ${qa.overall}/100${qa.pass ? "" : ", below threshold"}${
            profileFromCache ? ", reused cached profile — £0" : ""
          }).`
        : `Proposed demo for ${p.name} (QA ${qa.overall}/100).`,
      // Approval payload: rebuilding is deterministic, so the draft/DNA carry it.
      action: { prospectId: p.id, draft: draft as Business, qaScore: qa.overall },
    };
  },
};
