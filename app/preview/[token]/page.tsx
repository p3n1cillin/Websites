import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { getActivePreviewByToken, recordPreviewView } from "@/lib/previews";
import { getPreviewPassword } from "@/lib/preview-analytics";
import { getProspectRecord } from "@/lib/prospects";
import { buildSiteComparison } from "@/lib/comparison";
import ThemeProvider from "@/components/site/ThemeProvider";
import HomeSections from "@/components/site/HomeSections";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import StickyCallBar from "@/components/StickyCallBar";
import ComparisonBanner from "./ComparisonBanner";
import PreviewAnalytics from "./PreviewAnalytics";
import PreviewGate from "./PreviewGate";
import { gateCookie } from "./gate-cookie";

/**
 * Public, tokenised prospect demo — the sales asset (Phase E). A prospect opens
 * this without any login; the opaque token in the URL is the only authorization.
 *
 * It lives OUTSIDE the admin shell and is read server-side with the service role
 * filtered by the exact token (see lib/previews — capability-by-token, not an anon
 * RLS policy). Revoked or expired tokens 404. It renders the real site stack
 * (ThemeProvider + Navbar/Footer + HomeSections) from the stored draft + DNA, with
 * a small banner framing it as a free demo. Never indexed.
 */
export const dynamic = "force-dynamic";

export const metadata = { robots: { index: false, follow: false } };

export default async function PreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ bad?: string }>;
}) {
  const { token } = await params;
  const sp = await searchParams;
  const preview = await getActivePreviewByToken(token);
  if (!preview) notFound();

  // Optional private-share gate (migration 0010). Best-effort: if no password is
  // set (or the column isn't migrated) this is a no-op and the demo shows openly.
  const password = await getPreviewPassword(token);
  if (password) {
    const cookieStore = await cookies();
    const cleared = cookieStore.get(gateCookie(token))?.value === "ok";
    if (!cleared) return <PreviewGate token={token} bad={sp?.bad === "1"} />;
  }

  // Best-effort open counter (a buying signal); never blocks or breaks the demo.
  void recordPreviewView(preview.id, preview.views);

  const business = preview.businessDraft;
  const dna = preview.designDna;

  // Before/after: pull the audit of their current site (run by the Market agent)
  // and compare it to this demo's QA score. Best-effort — no comparison if absent.
  const prospect = await getProspectRecord(preview.prospectId).catch(() => null);
  const audit = prospect?.analysis?.audit ?? null;
  const comparison = audit ? buildSiteComparison(audit, preview.qaScore) : null;

  return (
    <ThemeProvider business={business} dna={dna} className="flex min-h-screen flex-col">
      {/* Sales framing — clearly a free demo built for them, not their live site. */}
      <div className="bg-slate-900 px-4 py-2 text-center text-xs text-white sm:text-sm">
        ✨ This is a free demo website we designed for <strong>{business.name}</strong> — like it?
        Get in touch and we'll get it live for you.
      </div>
      {comparison && <ComparisonBanner businessName={business.name} comparison={comparison} />}
      <Navbar business={business} showBlog={false} />
      <div className="flex-1">
        <HomeSections business={business} dna={dna} />
      </div>
      <Footer business={business} showBlog={false} />
      <StickyCallBar business={business} />
      <PreviewAnalytics token={token} />
    </ThemeProvider>
  );
}
