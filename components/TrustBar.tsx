import type { Business } from "@/lib/types";
import { hasRating } from "@/lib/utils";
import StarRating from "./StarRating";

/**
 * A compact strip of social-proof stats directly beneath the hero — keeps trust
 * signals above the fold on most screens.
 */
export default function TrustBar({ business }: { business: Business }) {
  const yearsTrading = business.established
    ? new Date().getFullYear() - business.established
    : null;

  const stats: { value: string; label: string; rating?: boolean }[] = [
    // Rating-derived stats appear only with real reviews (never a fabricated score).
    ...(hasRating(business)
      ? [
          { value: `${business.rating!.value}/5`, label: "Average rating", rating: true },
          { value: `${business.rating!.count}+`, label: "Happy customers" },
        ]
      : []),
    ...(yearsTrading
      ? [{ value: `${yearsTrading}+`, label: "Years in " + business.address.city }]
      : []),
    { value: `${business.badges.length}+`, label: "Trust signals" },
    { value: `${business.serviceAreas.length}+`, label: "Areas covered" },
  ];

  return (
    <section className="border-b border-gray-100 bg-white">
      <div className="mx-auto grid max-w-6xl grid-cols-2 divide-x divide-gray-100 px-4 sm:px-6 md:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="px-3 py-6 text-center">
            <div className="flex items-center justify-center gap-2">
              <span className="text-2xl font-extrabold text-gray-900 sm:text-3xl">
                {stat.value}
              </span>
              {stat.rating && <StarRating value={business.rating!.value} size="h-4 w-4" />}
            </div>
            <div className="mt-1 text-xs font-medium uppercase tracking-wide text-gray-500 sm:text-sm">
              {stat.label}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
