import type { Metadata } from "next";
import { brand, hasBrandEmail, hasBrandPhone } from "@/lib/brand";

export const metadata: Metadata = { title: "Contact" };

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-20">
      <h1 className="text-3xl font-semibold tracking-tight">Contact us</h1>
      <p className="mt-3 text-slate-600">
        Tell us about your business and we&apos;ll send a free audit plus a real demo of your new
        website — no obligation.
      </p>

      <div className="mt-10 grid gap-6 sm:grid-cols-2">
        {hasBrandEmail && (
          <div className="rounded-2xl border border-slate-200 p-6">
            <div className="text-sm font-medium text-slate-500">Email</div>
            <a href={`mailto:${brand.email}`} className="mt-1 block text-lg font-semibold text-slate-900 hover:underline">
              {brand.email}
            </a>
          </div>
        )}
        {hasBrandPhone && (
          <div className="rounded-2xl border border-slate-200 p-6">
            <div className="text-sm font-medium text-slate-500">Phone</div>
            <a href={`tel:${brand.phone.replace(/\s+/g, "")}`} className="mt-1 block text-lg font-semibold text-slate-900 hover:underline">
              {brand.phone}
            </a>
          </div>
        )}
        <div className="rounded-2xl border border-slate-200 p-6">
          <div className="text-sm font-medium text-slate-500">Business</div>
          <div className="mt-1 text-lg font-semibold text-slate-900">{brand.legalName}</div>
          <div className="text-sm text-slate-500">{brand.location}</div>
        </div>
      </div>

      {!hasBrandEmail && !hasBrandPhone && (
        <p className="mt-8 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Contact details aren&apos;t configured yet. Set <code className="font-mono">NEXT_PUBLIC_BRAND_EMAIL</code>{" "}
          (and optionally <code className="font-mono">NEXT_PUBLIC_BRAND_PHONE</code>) in your environment.
        </p>
      )}
    </div>
  );
}
