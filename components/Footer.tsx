import Link from "next/link";
import type { Business } from "@/lib/types";
import {
  fullAddress,
  mapDirectionsHref,
  telHref,
  hasPhone,
  hasEmail,
  hasAddress,
} from "@/lib/utils";
import Logo from "./Logo";
import { PhoneIcon, MailIcon, MapPinIcon } from "./Icons";

export default function Footer({
  business,
  showBlog = false,
}: {
  business: Business;
  showBlog?: boolean;
}) {
  const base = `/${business.slug}`;
  const year = new Date().getFullYear();

  return (
    <footer className="mt-20 bg-gray-900 text-gray-300">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-4">
        <div className="md:col-span-2">
          <div className="flex items-center gap-2.5">
            <Logo business={business} />
            <span className="text-lg font-bold text-white">{business.name}</span>
          </div>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-gray-400">
            {business.tagline}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {business.badges.map((badge) => (
              <span
                key={badge}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-gray-300"
              >
                {badge}
              </span>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-white">
            Quick Links
          </h3>
          <ul className="mt-4 space-y-2 text-sm">
            <li><Link href={base} className="hover:text-white">Home</Link></li>
            <li><Link href={`${base}/services`} className="hover:text-white">Services</Link></li>
            <li><Link href={`${base}/about`} className="hover:text-white">About</Link></li>
            {showBlog && (
              <li><Link href={`${base}/blog`} className="hover:text-white">Guides</Link></li>
            )}
            <li><Link href={`${base}/contact`} className="hover:text-white">Contact</Link></li>
            {business.enableBooking && (
              <li><Link href={`${base}/book`} className="hover:text-white">Book Online</Link></li>
            )}
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-white">
            Get in Touch
          </h3>
          <ul className="mt-4 space-y-3 text-sm">
            {/* Contact rows render only for verified facts — never a fake number/email. */}
            {hasPhone(business) && (
              <li>
                <a href={telHref(business.phone)} className="flex items-center gap-2 hover:text-white">
                  <PhoneIcon className="h-4 w-4 text-brand-light" />
                  {business.phone}
                </a>
              </li>
            )}
            {hasEmail(business) && (
              <li>
                <a href={`mailto:${business.email}`} className="flex items-center gap-2 hover:text-white">
                  <MailIcon className="h-4 w-4 text-brand-light" />
                  {business.email}
                </a>
              </li>
            )}
            {hasAddress(business) ? (
              <li>
                <a
                  href={mapDirectionsHref(business)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-2 hover:text-white"
                >
                  <MapPinIcon className="mt-0.5 h-4 w-4 shrink-0 text-brand-light" />
                  <span>{fullAddress(business)}</span>
                </a>
              </li>
            ) : (
              business.address.city && (
                <li className="flex items-start gap-2">
                  <MapPinIcon className="mt-0.5 h-4 w-4 shrink-0 text-brand-light" />
                  <span>{business.address.city} &amp; surrounding areas</span>
                </li>
              )
            )}
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-5 text-xs text-gray-500 sm:flex-row sm:px-6">
          <p>
            © {year} {business.name}. Serving {business.address.city} &amp; surrounding areas.
          </p>
          <p>
            {business.serviceAreas.slice(0, 4).join(" · ")}
          </p>
        </div>
      </div>
    </footer>
  );
}
