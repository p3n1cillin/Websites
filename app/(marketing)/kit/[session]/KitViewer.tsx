"use client";

import { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import {
  type SectionId,
  SECTION_LABELS,
  TIERS,
  type KitTier,
  type KitInput,
} from "@/lib/kit/catalog";
import type {
  StoredSection,
  ProfileSection,
  PostsSection,
  ReviewsSection,
  QaSection,
  SocialSection,
  WebsiteSection,
  KitPost,
} from "@/lib/kit/content";

interface Props {
  sessionId: string;
  tier: KitTier;
  input: KitInput;
  initialSections: Partial<Record<SectionId, StoredSection>>;
  requiredSections: SectionId[];
}

export default function KitViewer({
  sessionId,
  tier,
  input,
  initialSections,
  requiredSections,
}: Props) {
  const [sections, setSections] = useState<Partial<Record<SectionId, StoredSection>>>(initialSections);
  const [activeTab, setActiveTab] = useState<string>("profile");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [generatingSection, setGeneratingSection] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Find any missing sections that need generation
  const missingSections = requiredSections.filter((s) => !sections[s]);

  // Automatically trigger generation for missing sections in sequence
  useEffect(() => {
    let cancelled = false;

    async function generateMissing() {
      for (const sec of missingSections) {
        if (cancelled) break;
        setGeneratingSection(sec);
        try {
          const res = await fetch(`/api/kit/${encodeURIComponent(sessionId)}/${encodeURIComponent(sec)}`, {
            method: "POST",
          });
          const data = await res.json();
          if (data.status === "ready" && data.section) {
            setSections((prev) => ({ ...prev, [sec]: data.section }));
          } else if (data.status === "error") {
            setErrorMessage(data.message || `Failed to generate ${SECTION_LABELS[sec] || sec}`);
          }
        } catch (err) {
          console.error("Section generation error:", err);
          setErrorMessage("Network issue generating section. You can retry below.");
        }
      }
      setGeneratingSection(null);
    }

    if (missingSections.length > 0 && !generatingSection) {
      generateMissing();
    }

    return () => {
      cancelled = true;
    };
  }, [missingSections.length, sessionId]);

  const copyText = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleRegenerate = async (sectionId: SectionId) => {
    setGeneratingSection(sectionId);
    setErrorMessage(null);
    try {
      const res = await fetch(
        `/api/kit/${encodeURIComponent(sessionId)}/${encodeURIComponent(sectionId)}?regenerate=1`,
        { method: "POST" }
      );
      const data = await res.json();
      if (data.status === "ready" && data.section) {
        setSections((prev) => ({ ...prev, [sectionId]: data.section }));
      } else {
        setErrorMessage(data.message || "Could not regenerate this section.");
      }
    } catch {
      setErrorMessage("Network error during regeneration.");
    } finally {
      setGeneratingSection(null);
    }
  };

  // Compile all posts across quarters or monthly
  const allPosts: KitPost[] = [];
  if (sections.posts_monthly?.content) {
    allPosts.push(...(sections.posts_monthly.content as PostsSection).posts);
  }
  (["posts_q1", "posts_q2", "posts_q3", "posts_q4"] as SectionId[]).forEach((q) => {
    if (sections[q]?.content) {
      allPosts.push(...(sections[q]!.content as PostsSection).posts);
    }
  });

  const downloadAllTxt = () => {
    let out = `========================================================\n`;
    out += `MAP PACK KIT - ${input.businessName.toUpperCase()}\n`;
    out += `Trade: ${input.trade} | Town: ${input.town}\n`;
    out += `========================================================\n\n`;

    if (sections.profile?.content) {
      const p = sections.profile.content as ProfileSection;
      out += `--- 1. GOOGLE BUSINESS PROFILE OPTIMISATION ---\n\n`;
      out += `Primary Category: ${p.primaryCategory}\n`;
      out += `Secondary Categories: ${p.secondaryCategories?.join(", ")}\n\n`;
      out += `Business Description:\n${p.description}\n\n`;
      out += `Opening Line: ${p.openingLine}\n\n`;
      out += `Recommended Services:\n`;
      p.services?.forEach((s) => {
        out += `• ${s.name}: ${s.description}\n`;
      });
      out += `\nLocal Search Keywords:\n${p.keywords?.join(", ")}\n\n`;
      out += `Optimisation Checklist:\n`;
      p.checklist?.forEach((c, idx) => {
        out += `${idx + 1}. ${c}\n`;
      });
      out += `\n\n`;
    }

    if (allPosts.length > 0) {
      out += `--- 2. POST SCHEDULE (${allPosts.length} POSTS) ---\n\n`;
      allPosts.forEach((post, i) => {
        out += `[Post #${i + 1} - ${post.date}] (${post.type})\n`;
        out += `Headline: ${post.title}\n`;
        out += `${post.body}\n`;
        out += `Call to action: ${post.cta}\n`;
        out += `Photo prompt: ${post.photoIdea}\n\n`;
        out += `--------------------------------------------------------\n\n`;
      });
    }

    if (sections.reviews?.content) {
      const r = sections.reviews.content as ReviewsSection;
      out += `--- 3. REVIEW TOOLKIT ---\n\n`;
      out += `Request Message Templates:\n\n`;
      r.requests?.forEach((req) => {
        out += `[${req.channel} - ${req.label}]\n${req.text}\n\n`;
      });
      out += `Review Reply Templates:\n\n`;
      r.replies?.forEach((rep) => {
        out += `[${rep.stars} Stars: ${rep.scenario}]\n${rep.text}\n\n`;
      });
    }

    if (sections.qa?.content) {
      const q = sections.qa.content as QaSection;
      out += `--- 4. PROFILE QUESTIONS & ANSWERS ---\n\n`;
      q.items?.forEach((item, i) => {
        out += `Q${i + 1}: ${item.q}\nA: ${item.a}\n\n`;
      });
    }

    if (sections.social?.content) {
      const s = sections.social.content as SocialSection;
      out += `--- 5. SOCIAL MEDIA PACK ---\n\n`;
      out += `Facebook Bio:\n${s.facebookBio}\n\n`;
      out += `Instagram Bio:\n${s.instagramBio}\n\n`;
      out += `Nextdoor Introduction:\n${s.nextdoorIntro}\n\n`;
      out += `Captions:\n\n`;
      s.captions?.forEach((c, i) => {
        out += `[${c.platform} Caption #${i + 1}]\n${c.text}\n${c.hashtags?.join(" ")}\n\n`;
      });
    }

    if (sections.website?.content) {
      const w = sections.website.content as WebsiteSection;
      out += `--- 6. WEBSITE COPY & SEO TAGS ---\n\n`;
      out += `SEO Title: ${w.metaTitle}\n`;
      out += `Meta Description: ${w.metaDescription}\n\n`;
      out += `Hero Headline: ${w.heroHeadline}\n`;
      out += `Hero Subheading: ${w.heroSubheading}\n\n`;
      out += `About Us:\n${w.about?.join("\n\n")}\n\n`;
      out += `Areas Covered:\n${w.areaParagraph}\n\n`;
    }

    const blob = new Blob([out], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `MapPackKit-${input.businessName.replace(/[^a-zA-Z0-9]/g, "-")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadPostsCsv = () => {
    if (allPosts.length === 0) return;
    const header = ["Date", "Title", "Type", "Content", "Call To Action", "Photo Idea"];
    const rows = allPosts.map((p) => [
      p.date,
      `"${(p.title || "").replace(/"/g, '""')}"`,
      `"${(p.type || "").replace(/"/g, '""')}"`,
      `"${(p.body || "").replace(/"/g, '""')}"`,
      `"${(p.cta || "").replace(/"/g, '""')}"`,
      `"${(p.photoIdea || "").replace(/"/g, '""')}"`,
    ]);
    const csvContent = [header.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `GooglePosts-${input.businessName.replace(/[^a-zA-Z0-9]/g, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadPostsIcs = () => {
    if (allPosts.length === 0) return;
    const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
    const formatIcsDate = (d: Date) =>
      `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T090000Z`;

    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Empire Agencies//Map Pack Kit//EN",
      `X-WR-CALNAME:Google Posts - ${input.businessName.replace(/,/g, "")}`,
    ];

    allPosts.forEach((post, i) => {
      const postDate = new Date(`${post.date}T09:00:00Z`);
      const endDate = new Date(`${post.date}T09:30:00Z`);
      const dtStart = formatIcsDate(postDate);
      const dtEnd = formatIcsDate(endDate);
      const rawDesc = `Post on Google Maps today:\\n\\n${post.body.replace(/\n/g, "\\n")}\\n\\nCall to action: ${post.cta}\\nPhoto idea: ${post.photoIdea}`;
      const summary = `Google Post: ${post.title.replace(/,/g, "\\,")}`;

      lines.push(
        "BEGIN:VEVENT",
        `UID:mpk-${i}-${orderDateSafe.getTime()}@empireagencies`,
        `DTSTAMP:${dtStart}`,
        `DTSTART:${dtStart}`,
        `DTEND:${dtEnd}`,
        `SUMMARY:${summary}`,
        `DESCRIPTION:${rawDesc}`,
        "END:VEVENT"
      );
    });

    lines.push("END:VCALENDAR");

    const blob = new Blob([lines.join("\r\n")], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `GooglePosts-${input.businessName.replace(/[^a-zA-Z0-9]/g, "-")}.ics`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const completedCount = requiredSections.filter((s) => sections[s]).length;
  const progressPct = Math.round((completedCount / requiredSections.length) * 100);
  const orderDateSafe = new Date();

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      {/* Top Header Card */}
      <div className="mb-8 overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              Permanent Access Link
            </div>
            <h1 className="font-display mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Map Pack Kit: {input.businessName}
            </h1>
            <p className="mt-2 text-slate-600">
              Tailored for <span className="font-medium text-slate-900">{input.trade}</span> in{" "}
              <span className="font-medium text-slate-900">{input.town}</span>
              {input.areas ? ` & ${input.areas}` : ""}.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {allPosts.length > 0 && (
              <>
                <button
                  onClick={downloadPostsIcs}
                  title="Import all 52 weekly reminders directly into Google Calendar, Apple Calendar, or Outlook"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-95"
                >
                  <svg className="h-4 w-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Add to Calendar (.ics)
                </button>
                <button
                  onClick={downloadPostsCsv}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-95"
                >
                  <svg className="h-4 w-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Export CSV
                </button>
              </>
            )}
            <button
              onClick={downloadAllTxt}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow transition-all hover:bg-slate-800 active:scale-95"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download Full Kit (.txt)
            </button>
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Print
            </button>
          </div>
        </div>

        {/* Live Generation Progress Indicator */}
        {missingSections.length > 0 && (
          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50/70 p-4">
            <div className="flex items-center justify-between text-sm font-medium text-amber-900">
              <span className="flex items-center gap-2">
                <svg className="h-4 w-4 animate-spin text-amber-600" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                {generatingSection
                  ? `Writing ${SECTION_LABELS[generatingSection as SectionId] || generatingSection}...`
                  : "Finalising your kit sections..."}
              </span>
              <span>{progressPct}% complete</span>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-amber-200">
              <div
                className="h-full bg-emerald-600 transition-all duration-500 ease-out"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-amber-700">
              Sections are generated independently in real-time. Once finished, they stay permanently saved.
            </p>
          </div>
        )}

        {errorMessage && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {errorMessage}
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="grid gap-8 lg:grid-cols-[260px_1fr]">
        {/* Navigation Sidebar */}
        <aside className="space-y-1">
          <button
            onClick={() => setActiveTab("profile")}
            className={`flex w-full items-center justify-between rounded-xl px-4 py-3 text-left text-sm font-medium transition ${
              activeTab === "profile"
                ? "bg-slate-900 text-white shadow-sm"
                : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
            }`}
          >
            <span>📍 Google Profile</span>
            {sections.profile && <span className="text-xs text-emerald-400">Ready</span>}
          </button>

          <button
            onClick={() => setActiveTab("posts")}
            className={`flex w-full items-center justify-between rounded-xl px-4 py-3 text-left text-sm font-medium transition ${
              activeTab === "posts"
                ? "bg-slate-900 text-white shadow-sm"
                : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
            }`}
          >
            <span>📅 {tier === "complete" ? "52 Weekly Posts" : "12 Monthly Posts"}</span>
            {allPosts.length > 0 && <span className="text-xs text-emerald-400">{allPosts.length} posts</span>}
          </button>

          <button
            onClick={() => setActiveTab("reviews")}
            className={`flex w-full items-center justify-between rounded-xl px-4 py-3 text-left text-sm font-medium transition ${
              activeTab === "reviews"
                ? "bg-slate-900 text-white shadow-sm"
                : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
            }`}
          >
            <span>⭐ Review Toolkit</span>
            {sections.reviews && <span className="text-xs text-emerald-400">Ready</span>}
          </button>

          {tier === "complete" && (
            <>
              <button
                onClick={() => setActiveTab("qa")}
                className={`flex w-full items-center justify-between rounded-xl px-4 py-3 text-left text-sm font-medium transition ${
                  activeTab === "qa"
                    ? "bg-slate-900 text-white shadow-sm"
                    : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
                }`}
              >
                <span>💬 Profile Q&A</span>
                {sections.qa && <span className="text-xs text-emerald-400">Ready</span>}
              </button>

              <button
                onClick={() => setActiveTab("social")}
                className={`flex w-full items-center justify-between rounded-xl px-4 py-3 text-left text-sm font-medium transition ${
                  activeTab === "social"
                    ? "bg-slate-900 text-white shadow-sm"
                    : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
                }`}
              >
                <span>📱 Social Pack</span>
                {sections.social && <span className="text-xs text-emerald-400">Ready</span>}
              </button>

              <button
                onClick={() => setActiveTab("website")}
                className={`flex w-full items-center justify-between rounded-xl px-4 py-3 text-left text-sm font-medium transition ${
                  activeTab === "website"
                    ? "bg-slate-900 text-white shadow-sm"
                    : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
                }`}
              >
                <span>🌐 Website & SEO Copy</span>
                {sections.website && <span className="text-xs text-emerald-400">Ready</span>}
              </button>
            </>
          )}

          {/* Upsell Banner in Sidebar */}
          <div className="mt-6 rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-purple-50 p-4 text-slate-900">
            <div className="text-xs font-semibold uppercase tracking-wider text-indigo-700">Need a Website?</div>
            <p className="mt-1 text-xs text-slate-600 leading-relaxed">
              We turn local Google searches into direct calls with high-converting websites.
            </p>
            <div className="mt-2 text-xs font-semibold text-slate-900">
              £29 kit fee credited off your build.
            </div>
            <Link
              href="/contact"
              className="mt-3 block rounded-lg bg-indigo-600 px-3 py-1.5 text-center text-xs font-semibold text-white shadow-sm hover:bg-indigo-700"
            >
              Get Free Demo
            </Link>
          </div>
        </aside>

        {/* Tab Content Display */}
        <main className="space-y-6">
          {/* PROFILE TAB */}
          {activeTab === "profile" && (
            <div className="space-y-6">
              {sections.profile?.content ? (
                (() => {
                  const p = sections.profile.content as ProfileSection;
                  return (
                    <>
                      {/* Description Card */}
                      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                        <div className="flex items-center justify-between">
                          <h2 className="font-display text-xl font-semibold text-slate-900">
                            Optimised Google Business Description
                          </h2>
                          <button
                            onClick={() => copyText("desc", p.description)}
                            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            {copiedKey === "desc" ? "Copied!" : "Copy Description"}
                          </button>
                        </div>
                        <p className="mt-3 text-sm leading-relaxed text-slate-700 bg-slate-50 p-4 rounded-xl border border-slate-100 whitespace-pre-wrap font-sans">
                          {p.description}
                        </p>
                        <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                          <span>{p.description.length} characters (Google limit: 750)</span>
                          <span className="text-emerald-600 font-medium">✓ Keywords & areas woven in naturally</span>
                        </div>
                      </div>

                      {/* Categories & Attributes Card */}
                      <div className="grid gap-6 sm:grid-cols-2">
                        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                          <h3 className="font-semibold text-slate-900">Categories</h3>
                          <div className="mt-3">
                            <span className="text-xs text-slate-500">Primary category:</span>
                            <div className="mt-1 inline-block rounded-md bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                              {p.primaryCategory}
                            </div>
                          </div>
                          <div className="mt-4">
                            <span className="text-xs text-slate-500">Secondary categories:</span>
                            <div className="mt-1 flex flex-wrap gap-1.5">
                              {p.secondaryCategories?.map((c) => (
                                <span key={c} className="rounded-md bg-slate-100 px-2.5 py-1 text-xs text-slate-700">
                                  {c}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                          <h3 className="font-semibold text-slate-900">Recommended Attributes</h3>
                          <p className="mt-1 text-xs text-slate-500">Tick these in your Google Business Profile settings:</p>
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {p.attributes?.map((attr) => (
                              <span key={attr} className="rounded-md bg-slate-100 px-2.5 py-1 text-xs text-slate-700">
                                ✓ {attr}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Services to Add */}
                      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                        <h3 className="font-display text-lg font-semibold text-slate-900">
                          Services with Custom Descriptions
                        </h3>
                        <p className="mt-1 text-xs text-slate-500">
                          Paste these into the &ldquo;Services&rdquo; tab of your Google profile. Google uses these to match local search queries.
                        </p>
                        <div className="mt-4 divide-y divide-slate-100">
                          {p.services?.map((svc, i) => (
                            <div key={i} className="py-3 flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                              <div>
                                <h4 className="text-sm font-semibold text-slate-900">{svc.name}</h4>
                                <p className="mt-1 text-xs text-slate-600">{svc.description}</p>
                              </div>
                              <button
                                onClick={() => copyText(`svc-${i}`, `${svc.name}\n${svc.description}`)}
                                className="self-start rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 whitespace-nowrap"
                              >
                                {copiedKey === `svc-${i}` ? "Copied!" : "Copy"}
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Keywords & Checklist */}
                      <div className="grid gap-6 sm:grid-cols-2">
                        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                          <h3 className="font-semibold text-slate-900">Target Search Keywords</h3>
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {p.keywords?.map((kw) => (
                              <span key={kw} className="rounded-md bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                                {kw}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                          <h3 className="font-semibold text-slate-900">This Week&apos;s Action Checklist</h3>
                          <ul className="mt-3 space-y-2">
                            {p.checklist?.map((item, i) => (
                              <li key={i} className="flex items-start gap-2 text-xs text-slate-700">
                                <span className="font-bold text-emerald-600">{i + 1}.</span>
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </>
                  );
                })()
              ) : (
                <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-500">
                  <div className="inline-block animate-spin h-6 w-6 border-2 border-slate-400 border-t-transparent rounded-full mb-3" />
                  <p>Generating your Google Profile Optimisation pack...</p>
                </div>
              )}
            </div>
          )}

          {/* POSTS TAB */}
          {activeTab === "posts" && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="font-display text-xl font-semibold text-slate-900">
                      {tier === "complete" ? "52 Weekly Google Posts Calendar" : "12 Monthly Google Posts"}
                    </h2>
                    <p className="mt-1 text-xs text-slate-500">
                      Scheduled with seasonal hooks, local area mentions, photo recommendations, and conversion CTAs.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={downloadPostsCsv}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-95"
                    >
                      <svg className="h-3.5 w-3.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Export Posts (.csv)
                    </button>
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                      {allPosts.length} posts ready
                    </span>
                  </div>
                </div>
              </div>

              {allPosts.length > 0 ? (
                <div className="space-y-4">
                  {allPosts.map((post, i) => (
                    <div key={i} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-2">
                          <span className="rounded-md bg-slate-900 px-2 py-0.5 text-xs font-bold text-white">
                            Post #{i + 1}
                          </span>
                          <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                            {post.date}
                          </span>
                          <span className="text-xs text-slate-500 font-medium">({post.type})</span>
                        </div>
                        <button
                          onClick={() => copyText(`post-${i}`, `${post.title}\n\n${post.body}`)}
                          className="self-start rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          {copiedKey === `post-${i}` ? "Copied!" : "Copy Post"}
                        </button>
                      </div>

                      <h3 className="mt-4 font-semibold text-slate-900 text-base">{post.title}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-slate-700 whitespace-pre-wrap">{post.body}</p>

                      <div className="mt-4 grid gap-3 sm:grid-cols-2 rounded-xl bg-slate-50 p-3 text-xs border border-slate-100">
                        <div>
                          <span className="font-semibold text-slate-600">Button CTA:</span>{" "}
                          <span className="font-medium text-slate-900">{post.cta}</span>
                        </div>
                        <div>
                          <span className="font-semibold text-slate-600">Photo Idea:</span>{" "}
                          <span className="text-slate-700">{post.photoIdea}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-500">
                  <div className="inline-block animate-spin h-6 w-6 border-2 border-slate-400 border-t-transparent rounded-full mb-3" />
                  <p>Writing your dated post calendar...</p>
                </div>
              )}
            </div>
          )}

          {/* REVIEWS TAB */}
          {activeTab === "reviews" && (
            <div className="space-y-6">
              {sections.reviews?.content ? (
                (() => {
                  const r = sections.reviews.content as ReviewsSection;
                  return (
                    <>
                      {/* Review Request Scripts */}
                      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                        <h2 className="font-display text-xl font-semibold text-slate-900">
                          Review Request Message Scripts
                        </h2>
                        <p className="mt-1 text-xs text-slate-500">
                          Send these after finishing a job. Replace [Review link] with your Google review shortlink.
                        </p>
                        <div className="mt-6 space-y-4">
                          {r.requests?.map((req, i) => (
                            <div key={i} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                              <div className="flex items-center justify-between">
                                <span className="inline-block rounded bg-slate-900 px-2 py-0.5 text-xs font-semibold text-white">
                                  {req.channel} — {req.label}
                                </span>
                                <button
                                  onClick={() => copyText(`req-${i}`, req.text)}
                                  className="rounded border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                >
                                  {copiedKey === `req-${i}` ? "Copied!" : "Copy"}
                                </button>
                              </div>
                              <p className="mt-2 text-sm text-slate-700 whitespace-pre-wrap">{req.text}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Review Reply Templates */}
                      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                        <h2 className="font-display text-xl font-semibold text-slate-900">
                          15 Ready-to-Use Review Replies
                        </h2>
                        <p className="mt-1 text-xs text-slate-500">
                          Replying to every review signals to Google that your business is active and responsive.
                        </p>
                        <div className="mt-6 space-y-4">
                          {r.replies?.map((rep, i) => (
                            <div key={i} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="text-amber-500 font-bold text-xs">
                                    {"★".repeat(rep.stars)}{"☆".repeat(5 - rep.stars)}
                                  </span>
                                  <span className="text-xs font-medium text-slate-700">({rep.scenario})</span>
                                </div>
                                <button
                                  onClick={() => copyText(`rep-${i}`, rep.text)}
                                  className="rounded border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                >
                                  {copiedKey === `rep-${i}` ? "Copied!" : "Copy"}
                                </button>
                              </div>
                              <p className="mt-2 text-sm text-slate-700">{rep.text}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Review Policy Tips */}
                      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                        <h3 className="font-semibold text-slate-900">Google-Compliant Review Growth Tips</h3>
                        <ul className="mt-3 space-y-2">
                          {r.tips?.map((tip, i) => (
                            <li key={i} className="flex items-start gap-2 text-xs text-slate-700">
                              <span className="font-bold text-emerald-600">✓</span>
                              <span>{tip}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </>
                  );
                })()
              ) : (
                <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-500">
                  <div className="inline-block animate-spin h-6 w-6 border-2 border-slate-400 border-t-transparent rounded-full mb-3" />
                  <p>Building your review scripts and replies...</p>
                </div>
              )}
            </div>
          )}

          {/* QA TAB */}
          {activeTab === "qa" && (
            <div className="space-y-6">
              {sections.qa?.content ? (
                (() => {
                  const q = sections.qa.content as QaSection;
                  return (
                    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                      <h2 className="font-display text-xl font-semibold text-slate-900">
                        15 Google Profile Questions &amp; Answers
                      </h2>
                      <p className="mt-1 text-xs text-slate-500">
                        Pre-load these in your Google Business Profile &ldquo;Q&amp;A&rdquo; section so customers get instant clarity before calling.
                      </p>
                      <div className="mt-6 space-y-4">
                        {q.items?.map((item, i) => (
                          <div key={i} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                            <div className="flex items-center justify-between">
                              <h3 className="text-sm font-semibold text-slate-900">Q: {item.q}</h3>
                              <button
                                onClick={() => copyText(`qa-${i}`, `Q: ${item.q}\n\nA: ${item.a}`)}
                                className="rounded border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                              >
                                {copiedKey === `qa-${i}` ? "Copied!" : "Copy"}
                              </button>
                            </div>
                            <p className="mt-2 text-sm text-slate-700 leading-relaxed">{item.a}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()
              ) : (
                <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-500">
                  <div className="inline-block animate-spin h-6 w-6 border-2 border-slate-400 border-t-transparent rounded-full mb-3" />
                  <p>Writing your profile Q&amp;As...</p>
                </div>
              )}
            </div>
          )}

          {/* SOCIAL TAB */}
          {activeTab === "social" && (
            <div className="space-y-6">
              {sections.social?.content ? (
                (() => {
                  const s = sections.social.content as SocialSection;
                  return (
                    <>
                      <div className="grid gap-6 sm:grid-cols-2">
                        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                          <div className="flex items-center justify-between">
                            <h3 className="font-semibold text-slate-900">Facebook Bio</h3>
                            <button
                              onClick={() => copyText("fbbio", s.facebookBio)}
                              className="rounded border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              {copiedKey === "fbbio" ? "Copied!" : "Copy"}
                            </button>
                          </div>
                          <p className="mt-3 text-sm text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-100">
                            {s.facebookBio}
                          </p>
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                          <div className="flex items-center justify-between">
                            <h3 className="font-semibold text-slate-900">Instagram Bio</h3>
                            <button
                              onClick={() => copyText("igbio", s.instagramBio)}
                              className="rounded border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              {copiedKey === "igbio" ? "Copied!" : "Copy"}
                            </button>
                          </div>
                          <p className="mt-3 text-sm text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-100 whitespace-pre-wrap">
                            {s.instagramBio}
                          </p>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                        <div className="flex items-center justify-between">
                          <h3 className="font-semibold text-slate-900">Nextdoor Introduction Post</h3>
                          <button
                            onClick={() => copyText("ndintro", s.nextdoorIntro)}
                            className="rounded border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            {copiedKey === "ndintro" ? "Copied!" : "Copy"}
                          </button>
                        </div>
                        <p className="mt-3 text-sm text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-100 leading-relaxed">
                          {s.nextdoorIntro}
                        </p>
                      </div>

                      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                        <h3 className="font-display text-lg font-semibold text-slate-900">10 Social Media Captions</h3>
                        <div className="mt-4 space-y-4">
                          {s.captions?.map((cap, i) => (
                            <div key={i} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                              <div className="flex items-center justify-between">
                                <span className="rounded bg-slate-900 px-2 py-0.5 text-xs font-semibold text-white">
                                  {cap.platform}
                                </span>
                                <button
                                  onClick={() => copyText(`cap-${i}`, `${cap.text}\n\n${cap.hashtags?.join(" ")}`)}
                                  className="rounded border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                >
                                  {copiedKey === `cap-${i}` ? "Copied!" : "Copy"}
                                </button>
                              </div>
                              <p className="mt-2 text-sm text-slate-700 leading-relaxed">{cap.text}</p>
                              <div className="mt-2 text-xs font-medium text-blue-600">{cap.hashtags?.join(" ")}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  );
                })()
              ) : (
                <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-500">
                  <div className="inline-block animate-spin h-6 w-6 border-2 border-slate-400 border-t-transparent rounded-full mb-3" />
                  <p>Crafting your social media bios and captions...</p>
                </div>
              )}
            </div>
          )}

          {/* WEBSITE TAB */}
          {activeTab === "website" && (
            <div className="space-y-6">
              {sections.website?.content ? (
                (() => {
                  const w = sections.website.content as WebsiteSection;
                  return (
                    <>
                      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                        <h2 className="font-display text-xl font-semibold text-slate-900">Website SEO Tags</h2>
                        <div className="mt-4 space-y-3">
                          <div>
                            <span className="text-xs font-semibold text-slate-500">Page Title:</span>
                            <div className="mt-1 flex items-center justify-between rounded-lg bg-slate-50 p-3 border border-slate-100 text-sm font-medium text-slate-900">
                              <span>{w.metaTitle}</span>
                              <button
                                onClick={() => copyText("metaTitle", w.metaTitle)}
                                className="text-xs text-slate-600 hover:text-slate-900 font-semibold"
                              >
                                {copiedKey === "metaTitle" ? "Copied!" : "Copy"}
                              </button>
                            </div>
                          </div>
                          <div>
                            <span className="text-xs font-semibold text-slate-500">Meta Description:</span>
                            <div className="mt-1 flex items-center justify-between rounded-lg bg-slate-50 p-3 border border-slate-100 text-sm text-slate-700">
                              <span>{w.metaDescription}</span>
                              <button
                                onClick={() => copyText("metaDesc", w.metaDescription)}
                                className="text-xs text-slate-600 hover:text-slate-900 font-semibold"
                              >
                                {copiedKey === "metaDesc" ? "Copied!" : "Copy"}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                        <h2 className="font-display text-xl font-semibold text-slate-900">Hero Section Copy</h2>
                        <div className="mt-4 rounded-xl bg-slate-50 p-5 border border-slate-100">
                          <h3 className="font-display text-2xl font-bold text-slate-900">{w.heroHeadline}</h3>
                          <p className="mt-2 text-base text-slate-600">{w.heroSubheading}</p>
                          <div className="mt-4 flex flex-wrap gap-2">
                            {w.ctas?.map((cta, i) => (
                              <span key={i} className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white">
                                {cta}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                        <div className="flex items-center justify-between">
                          <h2 className="font-display text-xl font-semibold text-slate-900">&ldquo;About Us&rdquo; Copy</h2>
                          <button
                            onClick={() => copyText("about", w.about?.join("\n\n"))}
                            className="rounded border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            {copiedKey === "about" ? "Copied!" : "Copy All"}
                          </button>
                        </div>
                        <div className="mt-4 space-y-3 text-sm text-slate-700 leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-100">
                          {w.about?.map((para, i) => (
                            <p key={i}>{para}</p>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                        <h2 className="font-display text-xl font-semibold text-slate-900">&ldquo;Areas We Cover&rdquo; Section</h2>
                        <p className="mt-3 text-sm text-slate-700 bg-slate-50 p-4 rounded-xl border border-slate-100 leading-relaxed">
                          {w.areaParagraph}
                        </p>
                      </div>
                    </>
                  );
                })()
              ) : (
                <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-500">
                  <div className="inline-block animate-spin h-6 w-6 border-2 border-slate-400 border-t-transparent rounded-full mb-3" />
                  <p>Writing your website copy and SEO tags...</p>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
