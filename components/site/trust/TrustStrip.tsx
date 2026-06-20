import type { Business } from "@/lib/types";
import type { DesignDNA } from "@/lib/design/types";
import TrustBar from "@/components/TrustBar";

/** Trust variant: the compact divided stat strip (wraps the shared TrustBar). */
export default function TrustStrip({ business }: { business: Business; dna: DesignDNA }) {
  return <TrustBar business={business} />;
}
