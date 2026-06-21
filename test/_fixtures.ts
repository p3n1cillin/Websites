import type { ClientRetainer, Prospect, WebsiteAudit } from "@/lib/types";
import type { ClusterStat } from "@/lib/discovery-graph";

/** Fully-typed test factories so unit tests stay readable + tsc-clean. */

export function makeProspect(overrides: Partial<Prospect> = {}): Prospect {
  return {
    id: "p1",
    orgId: "org1",
    name: "Test Plumbing",
    category: "plumber",
    city: "Warrington",
    phone: null,
    email: null,
    websiteUrl: null,
    presenceScore: 20,
    opportunityScore: 70,
    valueEstimate: 500_000,
    status: "discovered",
    source: null,
    analysis: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

export function makeRetainer(overrides: Partial<ClientRetainer> = {}): ClientRetainer {
  return {
    id: "r1",
    orgId: "org1",
    prospectId: "p1",
    businessId: null,
    name: "Client A",
    monthlyPence: 3900,
    status: "active",
    note: null,
    startedAt: new Date().toISOString(),
    cancelledAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

export function makeCluster(overrides: Partial<ClusterStat> = {}): ClusterStat {
  return {
    key: "plumber|warrington",
    category: "plumber",
    city: "Warrington",
    size: 6,
    noWebsite: 3,
    whitespacePct: 60,
    avgOpportunity: 72,
    avgPresence: 25,
    addressableValuePence: 3_000_000,
    dominationScore: 80,
    topProspectIds: ["p1", "p2"],
    ...overrides,
  };
}

export function makeAudit(overrides: Partial<WebsiteAudit> = {}): WebsiteAudit {
  return {
    url: "https://example-biz.co.uk",
    reachable: true,
    statusCode: 200,
    https: true,
    overall: 45,
    signals: {
      hasTitle: true,
      titleLength: 30,
      hasMetaDescription: false,
      hasViewport: false,
      hasH1: true,
      hasStructuredData: false,
      hasOpenGraph: false,
      hasFavicon: true,
      hasPhoneLink: false,
      hasCtaSignal: false,
      imageCount: 4,
      imagesWithoutAlt: 3,
      wordCount: 120,
      htmlBytes: 50_000,
      builder: "Wix",
      socials: [],
    },
    reputation: { platforms: [], onPageRating: null, testimonialCount: 0 },
    contactEmail: null,
    issues: ["Not mobile-friendly", "No clear call-to-action"],
    at: new Date().toISOString(),
  };
}
