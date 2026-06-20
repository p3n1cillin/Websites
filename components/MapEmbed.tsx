import type { Business } from "@/lib/types";
import { mapEmbedSrc, mapDirectionsHref, fullAddress } from "@/lib/utils";
import { MapPinIcon, ArrowRightIcon } from "./Icons";

/**
 * Google Maps embed. Uses the keyless `output=embed` endpoint so it works out
 * of the box with no API key or billing setup.
 */
export default function MapEmbed({
  business,
  className = "",
}: {
  business: Business;
  className?: string;
}) {
  return (
    <div className={`overflow-hidden rounded-2xl border border-gray-100 shadow-sm ${className}`}>
      <iframe
        title={`Map showing ${business.name} in ${business.address.city}`}
        src={mapEmbedSrc(business)}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        className="h-72 w-full border-0"
      />
      <div className="flex items-center justify-between gap-3 bg-white px-5 py-4">
        <p className="flex items-start gap-2 text-sm text-gray-700">
          <MapPinIcon className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
          {fullAddress(business)}
        </p>
        <a
          href={mapDirectionsHref(business)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-brand hover:underline"
        >
          Directions
          <ArrowRightIcon className="h-4 w-4" />
        </a>
      </div>
    </div>
  );
}
