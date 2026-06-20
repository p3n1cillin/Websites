import type { ReactNode } from "react";
import type { Business } from "@/lib/types";
import type { DesignDNA } from "@/lib/design/types";
import { designTokens } from "@/lib/design/tokens";

/**
 * Emits a business's DesignDNA as CSS custom properties on a wrapper element.
 * Everything rendered inside inherits the brand/surface/radius/density/type tokens,
 * so the entire site re-skins from data with no per-site code.
 *
 * Server component — no client JS. Drop it at the top of the [business] layout.
 */
export default function ThemeProvider({
  business,
  dna,
  className,
  children,
}: {
  business: Business;
  dna: DesignDNA;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div style={designTokens(business, dna)} className={className}>
      {children}
    </div>
  );
}
