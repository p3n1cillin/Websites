import Link from "next/link";
import type { Business } from "@/lib/types";
import { telHref, hasPhone } from "@/lib/utils";
import { PhoneIcon, ArrowRightIcon } from "./Icons";

/**
 * Mobile-only sticky bar pinned to the bottom of the viewport. Puts a
 * click-to-call action and a primary conversion CTA one thumb-tap away on
 * every page — the single biggest mobile lead-gen lever.
 */
export default function StickyCallBar({ business }: { business: Business }) {
  const ctaHref = business.enableBooking
    ? `/${business.slug}/book`
    : `/${business.slug}/contact`;
  const ctaLabel = business.enableBooking ? "Book" : "Enquire";

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-gray-200 bg-white/95 px-3 py-2.5 shadow-[0_-4px_20px_-8px_rgba(0,0,0,0.25)] backdrop-blur md:hidden">
      <div className="flex items-center gap-2.5">
        {/* No verified phone → enquiry CTA takes the full bar (never a fake number). */}
        {hasPhone(business) && (
          <a
            href={telHref(business.phone)}
            className="flex flex-1 items-center justify-center gap-2 rounded-full bg-brand px-4 py-3 text-sm font-semibold text-brand-fg"
          >
            <PhoneIcon className="h-4 w-4" />
            Call Now
          </a>
        )}
        <Link
          href={ctaHref}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-full px-4 py-3 text-sm font-semibold ${
            hasPhone(business)
              ? "border-2 border-brand text-brand"
              : "bg-brand text-brand-fg"
          }`}
        >
          {ctaLabel}
          <ArrowRightIcon className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
