"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { Business } from "@/lib/types";
import { telHref, hasPhone } from "@/lib/utils";
import Logo from "./Logo";
import OpenNow from "./OpenNow";
import { PhoneIcon } from "./Icons";

export default function Navbar({
  business,
  showBlog = false,
}: {
  business: Business;
  showBlog?: boolean;
}) {
  const base = `/${business.slug}`;
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close the mobile menu whenever the route changes.
  useEffect(() => setOpen(false), [pathname]);

  const links = [
    { href: base, label: "Home" },
    { href: `${base}/services`, label: "Services" },
    { href: `${base}/about`, label: "About" },
    { href: `${base}/contact`, label: "Contact" },
  ];
  if (showBlog) {
    links.splice(3, 0, { href: `${base}/blog`, label: "Guides" });
  }
  if (business.enableBooking) {
    links.push({ href: `${base}/book`, label: "Book Online" });
  }

  const isActive = (href: string) =>
    href === base ? pathname === base : pathname.startsWith(href);

  return (
    <header
      className={`sticky top-0 z-50 transition-colors duration-300 ${
        scrolled
          ? "bg-white/90 shadow-sm backdrop-blur"
          : "bg-white/0 backdrop-blur-0"
      }`}
    >
      <nav className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href={base} className="flex items-center gap-2.5">
          <Logo business={business} />
          <span className="text-base font-bold tracking-tight text-gray-900">
            {business.name}
          </span>
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                isActive(link.href)
                  ? "text-brand"
                  : "text-gray-700 hover:text-brand"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <OpenNow business={business} className="hidden lg:inline-flex" />
          {hasPhone(business) ? (
            <a
              href={telHref(business.phone)}
              className="hidden items-center gap-2 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-brand-fg shadow-sm transition-transform hover:scale-[1.03] sm:inline-flex"
            >
              <PhoneIcon className="h-4 w-4" />
              {business.phone}
            </a>
          ) : (
            <Link
              href={business.enableBooking ? `${base}/book` : `${base}/contact`}
              className="hidden items-center gap-2 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-brand-fg shadow-sm transition-transform hover:scale-[1.03] sm:inline-flex"
            >
              {business.enableBooking ? "Book Online" : "Get a Quote"}
            </Link>
          )}

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-md text-gray-800 md:hidden"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              {open ? (
                <path d="M6 6l12 12M18 6L6 18" />
              ) : (
                <path d="M4 7h16M4 12h16M4 17h16" />
              )}
            </svg>
          </button>
        </div>
      </nav>

      {open && (
        <div className="border-t border-gray-100 bg-white md:hidden">
          <div className="space-y-1 px-4 py-3">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`block rounded-md px-3 py-2.5 text-base font-medium ${
                  isActive(link.href)
                    ? "bg-brand-light/40 text-brand"
                    : "text-gray-800 hover:bg-gray-50"
                }`}
              >
                {link.label}
              </Link>
            ))}
            {hasPhone(business) ? (
              <a
                href={telHref(business.phone)}
                className="mt-2 flex items-center justify-center gap-2 rounded-full bg-brand px-4 py-3 text-base font-semibold text-brand-fg"
              >
                <PhoneIcon className="h-5 w-5" />
                Call {business.phone}
              </a>
            ) : (
              <Link
                href={business.enableBooking ? `${base}/book` : `${base}/contact`}
                className="mt-2 flex items-center justify-center gap-2 rounded-full bg-brand px-4 py-3 text-base font-semibold text-brand-fg"
              >
                {business.enableBooking ? "Book Online" : "Get a Quote"}
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
