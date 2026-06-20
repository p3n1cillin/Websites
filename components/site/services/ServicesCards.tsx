import type { Business } from "@/lib/types";
import type { DesignDNA } from "@/lib/design/types";
import ServicesGrid from "@/components/ServicesGrid";
import { offerCopy } from "@/lib/site-copy";

/** Services variant: the classic icon-card grid (wraps the shared ServicesGrid). */
export default function ServicesCards({ business }: { business: Business; dna: DesignDNA }) {
  const copy = offerCopy(business);
  return (
    <ServicesGrid
      business={business}
      limit={6}
      heading={copy.heading}
      subheading={copy.subheading}
      viewAllLabel={copy.viewAll}
      showViewAll
    />
  );
}
