"use client";

import { useActionState, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { startKitCheckout, type OrderState } from "./actions";
import { TIERS, gbpPrice, type KitTier } from "@/lib/kit/catalog";

const INITIAL_STATE: OrderState = {};

export default function OrderForm({ defaultTrade }: { defaultTrade?: string }) {
  return (
    <Suspense fallback={<div className="rounded-3xl border border-slate-200 bg-white p-12 text-center text-slate-500">Loading order form...</div>}>
      <OrderFormInner defaultTrade={defaultTrade} />
    </Suspense>
  );
}

function OrderFormInner({ defaultTrade }: { defaultTrade?: string }) {
  const [state, formAction, isPending] = useActionState(startKitCheckout, INITIAL_STATE);
  const [selectedTier, setSelectedTier] = useState<KitTier>("complete");
  const searchParams = useSearchParams();

  const prefillBusinessName = searchParams?.get("businessName") || "";
  const prefillTrade = searchParams?.get("trade") || defaultTrade || "";
  const prefillTown = searchParams?.get("town") || "";
  const prefillServices = searchParams?.get("services") || "";

  return (
    <div id="order" className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-900/5 sm:p-10">
      <div className="text-center sm:text-left">
        <span className="inline-block rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
          Takes 2 minutes · Delivered in 60 seconds
        </span>
        <h2 className="font-display mt-3 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Order Your Custom Map Pack Kit
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Enter your business details below. We generate a tailored content pack specific to your trade, town, and real services.
        </p>
      </div>

      {state?.error && (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-800">
          {state.error}
        </div>
      )}

      <form action={formAction} className="mt-8 space-y-6">
        {/* Honeypot anti-spam */}
        <input type="text" name="company_site" className="hidden" tabIndex={-1} autoComplete="off" />

        {/* Tier Selector */}
        <div className="space-y-3">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
            Select Your Package
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Starter Tier */}
            <label
              className={`relative flex cursor-pointer flex-col rounded-2xl border p-5 transition ${
                selectedTier === "starter"
                  ? "border-emerald-600 bg-emerald-50/20 ring-2 ring-emerald-600"
                  : "border-slate-200 bg-slate-50/50 hover:border-slate-300"
              }`}
            >
              <input
                type="radio"
                name="tier"
                value="starter"
                checked={selectedTier === "starter"}
                onChange={() => setSelectedTier("starter")}
                className="sr-only"
              />
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 text-base">{TIERS.starter.name}</span>
                <span className="font-display text-2xl font-bold text-slate-900">
                  {gbpPrice(TIERS.starter.pricePence)}
                </span>
              </div>
              <p className="mt-2 text-xs text-slate-600 leading-relaxed">{TIERS.starter.blurb}</p>
              <ul className="mt-3 space-y-1.5 text-xs text-slate-600">
                <li>✓ Optimised 750-character profile description</li>
                <li>✓ 12 seasonal monthly Google posts</li>
                <li>✓ Review SMS/WhatsApp scripts &amp; 15 replies</li>
              </ul>
            </label>

            {/* Complete Tier */}
            <label
              className={`relative flex cursor-pointer flex-col rounded-2xl border p-5 transition ${
                selectedTier === "complete"
                  ? "border-emerald-600 bg-emerald-50/20 ring-2 ring-emerald-600 shadow-sm"
                  : "border-slate-200 bg-slate-50/50 hover:border-slate-300"
              }`}
            >
              <div className="absolute -top-3 right-4 rounded-full bg-emerald-600 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow-sm">
                Most Popular
              </div>
              <input
                type="radio"
                name="tier"
                value="complete"
                checked={selectedTier === "complete"}
                onChange={() => setSelectedTier("complete")}
                className="sr-only"
              />
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 text-base">{TIERS.complete.name}</span>
                <span className="font-display text-2xl font-bold text-slate-900">
                  {gbpPrice(TIERS.complete.pricePence)}
                </span>
              </div>
              <p className="mt-2 text-xs text-slate-600 leading-relaxed">{TIERS.complete.blurb}</p>
              <ul className="mt-3 space-y-1.5 text-xs text-slate-600">
                <li className="font-semibold text-slate-900">✓ 52 Weekly Google Posts (Full Year of Content)</li>
                <li>✓ Everything in Starter</li>
                <li>✓ 15 Profile Q&amp;As + Social pack</li>
                <li>✓ Website copy &amp; SEO meta tags</li>
              </ul>
            </label>
          </div>
        </div>

        {/* Business Basics */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-semibold text-slate-700">
              Business Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="businessName"
              required
              defaultValue={prefillBusinessName}
              placeholder="e.g. Apex Roofing Specialists"
              className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700">
              Trade / Business Type <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="trade"
              required
              defaultValue={prefillTrade}
              placeholder="e.g. Roofer, Plumber, Electrician"
              className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
            />
          </div>
        </div>

        {/* Location Details */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-semibold text-slate-700">
              Base Town / City <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="town"
              required
              defaultValue={prefillTown}
              placeholder="e.g. Warrington"
              className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700">
              Surrounding Towns &amp; Areas Covered
            </label>
            <input
              type="text"
              name="areas"
              placeholder="e.g. Lymm, Stockton Heath, Great Sankey"
              className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
            />
          </div>
        </div>

        {/* Services & USP */}
        <div>
          <label className="block text-xs font-semibold text-slate-700">
            Key Services Offered <span className="text-red-500">*</span>
          </label>
          <textarea
            name="services"
            required
            rows={2}
            defaultValue={prefillServices}
            placeholder="e.g. Slate roof repairs, flat roofing, chimney repointing, fascias & gutters, emergency leak callouts"
            className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700">
            What Makes You Different? (Real facts only)
          </label>
          <textarea
            name="usp"
            rows={2}
            placeholder="e.g. 15 years local experience, family-run, no call-out fee, fixed written quote before work starts, we leave homes clean"
            className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
          />
        </div>

        {/* Tone Selection */}
        <div>
          <label className="block text-xs font-semibold text-slate-700">Tone of Voice</label>
          <select
            name="tone"
            defaultValue="friendly"
            className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
          >
            <option value="friendly">Friendly &amp; Approachable (Warm, trusted neighbour)</option>
            <option value="professional">Professional &amp; Established (Direct, technical, reassuring)</option>
            <option value="premium">Premium &amp; High-End (Craftsmanship, quality, polished)</option>
          </select>
        </div>

        {/* Email & Consent */}
        <div className="border-t border-slate-200 pt-6">
          <label className="block text-xs font-semibold text-slate-700">
            Delivery Email <span className="text-red-500">*</span>
          </label>
          <input
            type="email"
            name="email"
            required
            placeholder="you@yourbusiness.co.uk"
            className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
          />
          <p className="mt-1 text-xs text-slate-500">
            Your permanent kit link is emailed here right after checkout.
          </p>
        </div>

        <div className="flex items-start gap-3">
          <input
            type="checkbox"
            id="consent"
            name="consent"
            required
            className="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-600"
          />
          <label htmlFor="consent" className="text-xs text-slate-600 leading-relaxed">
            I agree that digital generation and delivery starts immediately upon payment, and I will receive an instant link to view and copy my kit.
          </label>
        </div>

        {/* Submit Button */}
        <div>
          <button
            type="submit"
            disabled={isPending}
            className="w-full rounded-xl bg-slate-900 py-3.5 text-center text-sm font-bold text-white shadow-lg transition-all hover:bg-slate-800 active:scale-[0.99] disabled:opacity-50"
          >
            {isPending ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="h-4 w-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Redirecting to Secure Stripe Checkout...
              </span>
            ) : (
              `Get My Map Pack Kit — ${gbpPrice(TIERS[selectedTier].pricePence)} One-Off`
            )}
          </button>
          <div className="mt-3 flex items-center justify-center gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1">🔒 Stripe 256-bit encrypted</span>
            <span>·</span>
            <span>⚡ Instant generation</span>
            <span>·</span>
            <span>📄 Permanent access</span>
          </div>
        </div>
      </form>
    </div>
  );
}
