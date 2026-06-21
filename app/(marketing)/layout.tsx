import Link from "next/link";
import type { Metadata } from "next";
import { Bricolage_Grotesque } from "next/font/google";
import { brand, hasBrandEmail, organizationJsonLd, websiteJsonLd } from "@/lib/brand";

// Distinctive modern-agency display face (not Inter) — applied to headings only.
const display = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});

/**
 * Public marketing chrome for the agency's own site (the homepage Stripe + clients
 * see). Header with brand + nav + client login; footer with legal links + the real
 * business contact. Separate from the admin shell and tenant sites. Carries the
 * site-wide SEO: canonical, Open Graph/Twitter cards + Organization/WebSite JSON-LD.
 */
export const metadata: Metadata = {
  title: { default: `${brand.name} - ${brand.tagline}`, template: `%s | ${brand.name}` },
  description: brand.tagline,
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    url: brand.url,
    siteName: brand.name,
    title: `${brand.name} - ${brand.tagline}`,
    description: brand.tagline,
    locale: "en_GB",
  },
  twitter: {
    card: "summary_large_image",
    title: `${brand.name} - ${brand.tagline}`,
    description: brand.tagline,
  },
};

const NAV = [
  { href: "/#services", label: "Services" },
  { href: "/#process", label: "How it works" },
  { href: "/pricing", label: "Pricing" },
  { href: "/contact", label: "Contact" },
];

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${display.variable} flex min-h-screen flex-col bg-white text-slate-900`}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd()) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd()) }}
      />
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-slate-900 text-sm font-bold text-white">
              {brand.name.charAt(0)}
            </span>
            <span className="font-display text-base font-semibold tracking-tight">{brand.name}</span>
          </Link>
          <nav className="hidden items-center gap-7 text-sm font-medium text-slate-600 md:flex">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="hover:text-slate-900">
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/admin" className="hidden text-sm font-medium text-slate-600 hover:text-slate-900 sm:block">
              Client login
            </Link>
            <Link
              href="/contact"
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-700 active:translate-y-px"
            >
              Get a free audit
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-slate-200 bg-slate-50">
        <div className="mx-auto grid max-w-6xl gap-8 px-6 py-12 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-slate-900 text-xs font-bold text-white">
                {brand.name.charAt(0)}
              </span>
              <span className="font-semibold">{brand.name}</span>
            </div>
            <p className="mt-3 text-sm text-slate-500">{brand.tagline}</p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-700">Company</h3>
            <ul className="mt-3 space-y-2 text-sm text-slate-500">
              <li><Link href="/#services" className="hover:text-slate-900">Services</Link></li>
              <li><Link href="/websites" className="hover:text-slate-900">Industries</Link></li>
              <li><Link href="/pricing" className="hover:text-slate-900">Pricing</Link></li>
              <li><Link href="/contact" className="hover:text-slate-900">Contact</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-700">Legal</h3>
            <ul className="mt-3 space-y-2 text-sm text-slate-500">
              <li><Link href="/terms" className="hover:text-slate-900">Terms &amp; refunds</Link></li>
              <li><Link href="/privacy" className="hover:text-slate-900">Privacy policy</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-700">Contact</h3>
            <ul className="mt-3 space-y-2 text-sm text-slate-500">
              {hasBrandEmail && (
                <li><a href={`mailto:${brand.email}`} className="hover:text-slate-900">{brand.email}</a></li>
              )}
              <li>{brand.location}</li>
            </ul>
          </div>
        </div>
        <div className="border-t border-slate-200 px-6 py-5 text-center text-xs text-slate-400">
          © {new Date().getFullYear()} {brand.legalName}. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
