import type { Business } from "@/lib/types";
import type { DesignDNA } from "@/lib/design/types";
import ServicesGrid from "@/components/ServicesGrid";

/** Services variant: the classic icon-card grid (wraps the shared ServicesGrid). */
export default function ServicesCards({ business }: { business: Business; dna: DesignDNA }) {
  return (
    <ServicesGrid
      business={business}
      limit={6}
      heading={`Our ${business.primaryService.toLowerCase()} services`}
      subheading={`Trusted ${business.categoryLabel.toLowerCase()} services for homes and businesses across ${business.address.city}.`}
      showViewAll
    />
  );
}
