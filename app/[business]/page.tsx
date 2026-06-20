import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getBusinessBySlug } from "@/lib/businesses";
import { buildMetadata } from "@/lib/seo";
import { getDesignDNA } from "@/lib/design/dna";
import HomeSections from "@/components/site/HomeSections";

// ISR: re-generate hourly so content edits + day-of-week roll over without a full
// rebuild (the live "Open now" badge is client-side; this keeps the rest fresh).
export const revalidate = 3600;

interface Props {
  params: { business: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const business = await getBusinessBySlug(params.business);
  if (!business) return {};
  return buildMetadata(business, "home");
}

export default async function BusinessHomePage({ params }: Props) {
  const business = await getBusinessBySlug(params.business);
  if (!business) notFound();

  // The DesignDNA decides which variant fills each section slot — so two
  // businesses (even in the same category) get structurally different homepages.
  const dna = getDesignDNA(business);
  return <HomeSections business={business} dna={dna} />;
}
