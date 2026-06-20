import type { Business } from "@/lib/types";
import type { DesignDNA } from "@/lib/design/types";
import Testimonials from "@/components/Testimonials";

/** Testimonials variant: the three-up review card grid (wraps the shared component). */
export default function TestimonialsGrid({ business }: { business: Business; dna: DesignDNA }) {
  return <Testimonials business={business} />;
}
