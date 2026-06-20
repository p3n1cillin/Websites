import type { Business } from "@/lib/types";
import type { DesignDNA } from "@/lib/design/types";
import CTASection from "@/components/CTASection";

/** CTA variant: the rounded high-contrast brand band (wraps the shared component). */
export default function CtaGradient({ business }: { business: Business; dna: DesignDNA }) {
  return <CTASection business={business} />;
}
