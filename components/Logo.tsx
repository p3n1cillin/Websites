import Image from "next/image";
import type { Business } from "@/lib/types";
import { monogram } from "@/lib/utils";

/**
 * Brand mark. Uses the supplied logo if present, otherwise renders a clean
 * monogram badge in the business's brand colour — so every site has a logo with
 * zero design work.
 */
export default function Logo({
  business,
  className = "",
}: {
  business: Business;
  className?: string;
}) {
  if (business.brand?.logoUrl) {
    return (
      <span className={`relative inline-flex h-9 w-9 overflow-hidden rounded-lg ${className}`}>
        <Image
          src={business.brand.logoUrl}
          alt={`${business.name} logo`}
          fill
          sizes="36px"
          className="object-contain"
        />
      </span>
    );
  }

  return (
    <span
      className={`inline-flex h-9 w-9 items-center justify-center rounded-lg bg-brand text-sm font-bold text-brand-fg ${className}`}
      aria-hidden="true"
    >
      {monogram(business.name)}
    </span>
  );
}
