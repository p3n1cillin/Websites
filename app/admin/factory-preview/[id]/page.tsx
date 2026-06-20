import { notFound, redirect } from "next/navigation";
import { requireOrg } from "@/lib/auth";
import { getBusinessRecord } from "@/lib/businesses";
import { buildDna, specFromParams } from "@/lib/design/dna";
import ThemeProvider from "@/components/site/ThemeProvider";
import HomeSections from "@/components/site/HomeSections";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import StickyCallBar from "@/components/StickyCallBar";

/**
 * Standalone, owner-only preview of a candidate design — what the Website Factory
 * loads in its desktop/mobile iframes. It lives OUTSIDE the admin (app) route group
 * so it renders without the dashboard chrome: just the real site (ThemeProvider +
 * Navbar/Footer + the home section stack) at the DNA encoded in the query string.
 *
 * The candidate is described by the URL (seed + one key per layout slot) so previews
 * are stateless and shareable; nothing is persisted until "Use this design".
 */
export const dynamic = "force-dynamic";

export const metadata = { robots: { index: false, follow: false } };

export default async function FactoryPreviewPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const org = await requireOrg();
  const record = await getBusinessRecord(params.id);
  if (!record) notFound();
  if (record.orgId !== org.id) redirect("/admin/factory");

  const business = record.data;
  const spec = specFromParams(searchParams);
  const dna = buildDna(business, { seed: spec.seed || business.slug, overrides: spec.overrides });

  return (
    <ThemeProvider business={business} dna={dna} className="flex min-h-screen flex-col">
      <Navbar business={business} showBlog={false} />
      <div className="flex-1">
        <HomeSections business={business} dna={dna} />
      </div>
      <Footer business={business} showBlog={false} />
      <StickyCallBar business={business} />
    </ThemeProvider>
  );
}
