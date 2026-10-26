import Link from "next/link";
import type { Metadata } from "next";
import OrderForm from "./OrderForm";
import Reveal from "../Reveal";
import { TIERS, gbpPrice } from "@/lib/kit/catalog";

export const metadata: Metadata = {
  title: "Map Pack Kit — Google Business Profile Content & SEO Kit for UK Trades",
  description:
    "Instant, tailored Google Business Profile kit for UK local businesses: 52 weekly posts, 750-char profile description, review request scripts, review replies, and Q&As from £19.",
  alternates: { canonical: "/map-pack-kit" },
};

export default function MapPackKitPage() {
  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Product",
        name: "Map Pack Kit — Google Business Profile Kit for UK Trades",
        description:
          "Instant, tailored Google Business Profile kit for UK local businesses: 52 weekly posts, 750-char profile description, review request scripts, review replies, and Q&As from £19.",
        offers: [
          {
            "@type": "Offer",
            name: "Starter Kit",
            price: "19.00",
            priceCurrency: "GBP",
            availability: "https://schema.org/InStock",
          },
          {
            "@type": "Offer",
            name: "Complete Kit",
            price: "29.00",
            priceCurrency: "GBP",
            availability: "https://schema.org/InStock",
          },
        ],
      },
      {
        "@type": "FAQPage",
        mainEntity: [
          {
            "@type": "Question",
            name: "How do I receive the kit?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Instantly. As soon as your payment completes on Stripe, you are redirected to your private, permanent kit dashboard with copy buttons, print layout, and plain text download.",
            },
          },
          {
            "@type": "Question",
            name: "Is this just a generic template?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "No. Every kit is generated uniquely around your trade, town, surrounding coverage areas, and services.",
            },
          },
        ],
      },
    ],
  };

  return (
    <div className="bg-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-slate-200 bg-slate-50 py-16 lg:py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3.5 py-1 text-xs font-semibold text-emerald-800">
                <span className="h-2 w-2 rounded-full bg-emerald-600 animate-pulse" />
                Tailored for UK Trades &amp; Local Services
              </div>

              <h1 className="font-display mt-5 text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl lg:text-6xl leading-[1.08]">
                Rank Higher on Google Maps. Win More Local Calls.
              </h1>

              <p className="mt-5 text-lg leading-relaxed text-slate-600">
                A custom Google Business Profile content kit built specifically around your trade, town, and services. A full year of weekly posts, review request templates, reply scripts, and profile optimisation—ready in 60 seconds from £19.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-4">
                <a
                  href="#order"
                  className="rounded-xl bg-slate-900 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-slate-900/10 transition hover:bg-slate-800 active:scale-95"
                >
                  Create Your Kit from £19
                </a>
                <Link
                  href="/kit/sample"
                  className="rounded-xl border border-slate-300 bg-white px-6 py-3.5 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"
                >
                  Inspect Live Sample Kit →
                </Link>
              </div>

              <div className="mt-8 flex items-center gap-6 text-xs text-slate-500">
                <div className="flex items-center gap-1.5 font-medium text-slate-700">
                  <span className="text-emerald-600">✓</span> No generic templates
                </div>
                <div className="flex items-center gap-1.5 font-medium text-slate-700">
                  <span className="text-emerald-600">✓</span> Mentions your real towns
                </div>
                <div className="flex items-center gap-1.5 font-medium text-slate-700">
                  <span className="text-emerald-600">✓</span> Instant permanent link
                </div>
              </div>
            </div>

            {/* Interactive Sample Teaser Card */}
            <div className="relative">
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl shadow-slate-900/10 sm:p-8">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-2.5">
                    <span className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-600 text-xs font-bold text-white">
                      G
                    </span>
                    <div>
                      <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Sample Preview</div>
                      <div className="text-sm font-bold text-slate-900">Hartley Plumbing &amp; Heating</div>
                    </div>
                  </div>
                  <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                    52 Posts + Toolkit
                  </span>
                </div>

                <div className="mt-5 space-y-4 text-xs">
                  <div className="rounded-xl bg-slate-50 p-4 border border-slate-100">
                    <span className="font-bold text-slate-700">📍 Google Profile Description (Excerpt):</span>
                    <p className="mt-1 text-slate-600 leading-relaxed italic">
                      &ldquo;Family-run plumbing and heating engineers serving Warrington, Lymm, Stockton Heath, and Great Sankey. No call-out charge, fixed written quotes upfront, and we leave your home tidy...&rdquo;
                    </p>
                  </div>

                  <div className="rounded-xl bg-slate-50 p-4 border border-slate-100">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-700">📅 Example Post (Week 42 - Autumn/Winter):</span>
                      <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">Seasonal Tip</span>
                    </div>
                    <p className="mt-1 text-slate-600 leading-relaxed">
                      &ldquo;Cold radiators upstairs in Warrington? Sludge buildup could be pushing your boiler harder than it needs to. Here is how power flushing restores efficiency before winter...&rdquo;
                    </p>
                  </div>

                  <div className="rounded-xl bg-slate-50 p-4 border border-slate-100">
                    <span className="font-bold text-slate-700">⭐ WhatsApp Review Request Template:</span>
                    <p className="mt-1 text-slate-600 leading-relaxed">
                      &ldquo;Hi [Name], thanks for having us round today! If you were pleased with the work, a quick Google review really helps other local families find us: [Review link]&rdquo;
                    </p>
                  </div>
                </div>

                <div className="mt-6 text-center">
                  <Link
                    href="/kit/sample"
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:text-emerald-800"
                  >
                    Click to explore the full interactive sample kit →
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* The Market Problem Section */}
      <section className="py-20 lg:py-28">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Why Most Trade Profiles Sit on Page 2 of Google
            </h2>
            <p className="mt-4 text-slate-600">
              When a boiler breaks or a roof leaks, 84% of homeowners tap one of the top 3 results in the Google Map Pack. If your profile is quiet, you lose the call.
            </p>
          </div>

          <div className="mt-16 grid gap-8 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 p-6">
              <div className="font-display text-3xl font-bold text-slate-300">01</div>
              <h3 className="mt-3 font-bold text-slate-900 text-lg">No Regular Activity</h3>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                Google prioritises businesses that post consistently. A profile that hasn&apos;t posted in 6 months signals to the algorithm that the business may be inactive.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 p-6">
              <div className="font-display text-3xl font-bold text-slate-300">02</div>
              <h3 className="mt-3 font-bold text-slate-900 text-lg">Missing Key Services &amp; Areas</h3>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                Most trades leave their profile description brief and forget to add individual service items with descriptions. That leaves money on the table for high-value searches.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 p-6">
              <div className="font-display text-3xl font-bold text-slate-300">03</div>
              <h3 className="mt-3 font-bold text-slate-900 text-lg">No Review System</h3>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                Happy customers rarely review unless asked promptly with an easy link. Having ready-made SMS and WhatsApp scripts instantly doubles your review velocity.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* What's In The Kit (The 6 Pillars) */}
      <section className="border-y border-slate-200 bg-slate-50 py-20 lg:py-28">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">What You Get</span>
            <h2 className="font-display mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Everything Needed to Dominate Your Local Map Pack
            </h2>
            <p className="mt-4 text-slate-600">
              Delivered on your personal interactive dashboard with one-click copy buttons and printable templates.
            </p>
          </div>

          <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="text-2xl">📍</div>
              <h3 className="mt-3 font-bold text-slate-900 text-base">Google Profile Optimisation</h3>
              <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                750-character SEO description packed with your primary trade, base town, and service areas. Plus primary/secondary category picks and recommended attributes.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="text-2xl">📅</div>
              <h3 className="mt-3 font-bold text-slate-900 text-base">52 Dated Weekly Posts</h3>
              <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                A full year of ready-to-copy updates. Seasonal hooks (winter heating prep, spring gutter clean), project spotlights, helpful tips, and CTA buttons.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="text-2xl">⭐</div>
              <h3 className="mt-3 font-bold text-slate-900 text-base">Review Request Toolkit</h3>
              <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                Plug-and-play scripts for SMS, WhatsApp, email, and in-person requests. Crafted to make asking comfortable and seamless right after a job.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="text-2xl">💬</div>
              <h3 className="mt-3 font-bold text-slate-900 text-base">15 Review Reply Templates</h3>
              <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                Varied replies for 5-star praise, 4-star feedback, and calm, professional de-escalation for unfair reviews that protects your reputation.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="text-2xl">❓</div>
              <h3 className="mt-3 font-bold text-slate-900 text-base">15 Profile Q&amp;As</h3>
              <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                Pre-load your profile&apos;s Q&amp;A section with the exact questions homeowners search before booking (pricing policies, callouts, guarantees).
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="text-2xl">🌐</div>
              <h3 className="mt-3 font-bold text-slate-900 text-base">Social &amp; Website Launch Pack</h3>
              <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                Facebook &amp; Instagram bios, 10 captions with hashtags, Nextdoor announcement, plus website hero headline, meta tags, and local area copy.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Free Tool Banner */}
      <section className="mx-auto max-w-6xl px-6 py-12">
        <div className="rounded-3xl bg-slate-900 p-8 sm:p-12 text-white flex flex-col md:flex-row items-center justify-between gap-8">
          <div>
            <span className="inline-block rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-300">
              100% Free Tool
            </span>
            <h2 className="font-display mt-3 text-2xl sm:text-3xl font-bold tracking-tight">
              Want to Test It First? Try Our Free Description Generator
            </h2>
            <p className="mt-2 text-sm text-slate-300 max-w-xl">
              Generate an optimised Google Business Profile description and 3 sample posts for your trade in 10 seconds—no credit card required.
            </p>
          </div>
          <Link
            href="/free-tools/google-business-description"
            className="rounded-xl bg-white px-6 py-3.5 text-sm font-bold text-slate-900 shadow hover:bg-slate-100 whitespace-nowrap active:scale-95 transition"
          >
            Launch Free Tool →
          </Link>
        </div>
      </section>

      {/* Order Form Anchor Section */}
      <section className="py-16 lg:py-24 bg-slate-50 border-t border-slate-200">
        <div className="mx-auto max-w-4xl px-6">
          <OrderForm />
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 lg:py-28 mx-auto max-w-4xl px-6">
        <h2 className="font-display text-3xl font-bold tracking-tight text-slate-900 text-center">
          Frequently Asked Questions
        </h2>
        <div className="mt-12 divide-y divide-slate-200 border-y border-slate-200">
          <details className="group py-5 cursor-pointer">
            <summary className="flex items-center justify-between font-bold text-slate-900">
              How do I receive the kit?
              <span className="text-slate-400 group-open:rotate-45 transition-transform">+</span>
            </summary>
            <p className="mt-3 text-sm text-slate-600 leading-relaxed">
              Instantly! As soon as your payment completes on Stripe, you are redirected to your private, permanent kit dashboard. You can copy each post with one click, print the guide, or download the entire year of content as a plain text file. We also email you the access link immediately.
            </p>
          </details>

          <details className="group py-5 cursor-pointer">
            <summary className="flex items-center justify-between font-bold text-slate-900">
              Is this actually tailored to my business?
              <span className="text-slate-400 group-open:rotate-45 transition-transform">+</span>
            </summary>
            <p className="mt-3 text-sm text-slate-600 leading-relaxed">
              Yes. Unlike generic PDF bundles or Etsy templates that use placeholder text like &ldquo;insert service here&rdquo;, our generator specifically writes copy mentioning your town, your surrounding service areas, your real trades, and your unique selling points.
            </p>
          </details>

          <details className="group py-5 cursor-pointer">
            <summary className="flex items-center justify-between font-bold text-slate-900">
              How long does it take to post them on Google?
              <span className="text-slate-400 group-open:rotate-45 transition-transform">+</span>
            </summary>
            <p className="mt-3 text-sm text-slate-600 leading-relaxed">
              About 60 seconds once a week. Open your Google Maps app or Google Business Profile dashboard, tap &ldquo;Add update&rdquo;, paste in the week&apos;s post, snap a quick photo on your phone (we give you photo ideas for each post), and hit publish.
            </p>
          </details>

          <details className="group py-5 cursor-pointer">
            <summary className="flex items-center justify-between font-bold text-slate-900">
              Can I upgrade to a complete website later?
              <span className="text-slate-400 group-open:rotate-45 transition-transform">+</span>
            </summary>
            <p className="mt-3 text-sm text-slate-600 leading-relaxed">
              Yes! If you decide you want our agency to build you a high-converting, custom website with booking and tap-to-call, we will credit 100% of your kit purchase (£19 or £29) directly off your website build fee.
            </p>
          </details>
        </div>
      </section>
    </div>
  );
}
