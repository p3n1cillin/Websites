"use client";

import { useState } from "react";
import Link from "next/link";
import type { FreeSample } from "@/lib/kit/content";

export default function FreeToolClient() {
  const [businessName, setBusinessName] = useState("");
  const [trade, setTrade] = useState("");
  const [town, setTown] = useState("");
  const [services, setServices] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<FreeSample | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/free-tools/gbp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessName, trade, town, services, email }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Generation failed. Please try again.");
      } else {
        setResult(data.result);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const copy = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className="space-y-10">
      {/* Input Form Card */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-900/5 sm:p-10">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Business Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="e.g. Apex Electrical Services"
                className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Trade / Industry <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={trade}
                onChange={(e) => setTrade(e.target.value)}
                placeholder="e.g. Electrician"
                className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Base Town / City <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={town}
                onChange={(e) => setTown(e.target.value)}
                placeholder="e.g. Warrington"
                className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Main Services Offered <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={services}
                onChange={(e) => setServices(e.target.value)}
                placeholder="e.g. Fuse boards, EV chargers, rewires, lighting"
                className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700">
              Email Address <span className="text-slate-400 font-normal">(optional — to email your permanent copy)</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. info@apex-electrical.co.uk"
              className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
            />
          </div>

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-800">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-slate-900 py-3.5 text-center text-sm font-bold text-white shadow-lg transition hover:bg-slate-800 active:scale-[0.99] disabled:opacity-50"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="h-4 w-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Writing your description &amp; sample posts...
              </span>
            ) : (
              "Generate Free Description & 3 Posts (Instant)"
            )}
          </button>
        </form>
      </div>

      {/* Generated Result Output */}
      {result && (
        <div className="space-y-8 animate-fadeIn">
          {/* Description Block */}
          <div className="rounded-3xl border border-emerald-200 bg-white p-6 shadow-lg sm:p-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
                  Ready to Paste into Google
                </span>
                <h3 className="font-display mt-2 text-xl font-bold text-slate-900">
                  Optimised Business Description
                </h3>
              </div>
              <button
                onClick={() => copy("desc", result.description)}
                className="rounded-lg bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
              >
                {copiedKey === "desc" ? "Copied!" : "Copy Description"}
              </button>
            </div>

            <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm leading-relaxed text-slate-700 whitespace-pre-wrap border border-slate-100">
              {result.description}
            </p>

            <div className="mt-3 text-xs text-slate-500 flex items-center justify-between">
              <span>{result.description.length} / 750 characters</span>
              <span className="text-emerald-700 font-semibold">✓ Local area &amp; services included</span>
            </div>
          </div>

          {/* 3 Sample Posts */}
          <div className="space-y-4">
            <h3 className="font-display text-xl font-bold text-slate-900">
              3 Example Google Posts
            </h3>
            {result.posts.map((post, i) => (
              <div key={i} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <span className="font-bold text-slate-900 text-sm">Post #{i + 1}: {post.title}</span>
                  <button
                    onClick={() => copy(`p-${i}`, `${post.title}\n\n${post.body}`)}
                    className="rounded border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    {copiedKey === `p-${i}` ? "Copied!" : "Copy Post"}
                  </button>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-slate-700 whitespace-pre-wrap">{post.body}</p>
              </div>
            ))}
          </div>

          {/* Upsell to Full Kit Banner */}
          <div className="rounded-3xl border border-indigo-200 bg-gradient-to-br from-indigo-900 to-slate-900 p-8 sm:p-10 text-white shadow-xl">
            <span className="inline-block rounded-full bg-indigo-500/30 px-3 py-1 text-xs font-semibold text-indigo-200">
              Full Year Content Automation
            </span>
            <h3 className="font-display mt-3 text-2xl font-bold sm:text-3xl">
              Get All 52 Weekly Posts + The Complete Review Toolkit
            </h3>
            <p className="mt-3 text-sm text-slate-300 max-w-xl leading-relaxed">
              Don&apos;t stop at 3 posts. Get a complete, dated calendar for all 52 weeks of the year, SMS &amp; WhatsApp review scripts, 15 review replies, and Q&amp;As tailored for {businessName || "your business"}.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-4">
              <Link
                href={`/map-pack-kit?businessName=${encodeURIComponent(businessName)}&trade=${encodeURIComponent(trade)}&town=${encodeURIComponent(town)}&services=${encodeURIComponent(services)}#order`}
                className="rounded-xl bg-white px-6 py-3.5 text-sm font-bold text-slate-900 shadow hover:bg-slate-100 active:scale-95 transition"
              >
                Order Complete Kit for £29 →
              </Link>
              <Link
                href="/kit/sample"
                className="text-xs font-semibold text-slate-300 hover:text-white underline"
              >
                Inspect full sample kit first
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
