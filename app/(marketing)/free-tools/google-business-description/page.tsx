import type { Metadata } from "next";
import FreeToolClient from "./FreeToolClient";

export const metadata: Metadata = {
  title: "Free Google Business Profile Description Generator for UK Trades",
  description:
    "Generate a 750-character SEO description and 3 sample Google posts for your UK trade business in 10 seconds. Free, instant, no signup required.",
  alternates: { canonical: "/free-tools/google-business-description" },
};

export default function FreeGbpToolPage() {
  return (
    <div className="bg-slate-50 min-h-screen py-16 lg:py-24">
      <div className="mx-auto max-w-3xl px-6">
        <div className="text-center mb-10">
          <span className="inline-block rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
            Free UK Trade Tool
          </span>
          <h1 className="font-display mt-3 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl lg:text-5xl">
            Google Business Profile Description Generator
          </h1>
          <p className="mt-3 text-base text-slate-600 max-w-xl mx-auto">
            Stop staring at a blank screen. Get an optimised 750-character description and 3 ready-to-use posts tailored to your trade and town.
          </p>
        </div>

        <FreeToolClient />
      </div>
    </div>
  );
}
