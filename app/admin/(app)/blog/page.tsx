import Link from "next/link";
import { requireOrg } from "@/lib/auth";
import { orgEntitlement } from "@/lib/plans";
import { getBusinessesForOrg } from "@/lib/businesses";
import { getPostsForBusiness, POSTS_PER_RUN } from "@/lib/blog";
import { supabaseWritable } from "@/lib/supabase/client";
import { generateArticlesAction } from "./actions";

export const dynamic = "force-dynamic";

const NOTICES: Record<string, { tone: "ok" | "err"; text: string }> = {
  config: { tone: "err", text: "Connect Supabase (service role key) to enable SEO automation." },
  inactive: { tone: "err", text: "Your trial or subscription isn't active. Visit Billing to upgrade." },
  nobusinesses: { tone: "err", text: "Publish a business first — articles are generated per live site." },
  failed: { tone: "err", text: "Generation failed. Check the server logs and try again." },
};

export default async function AdminBlogPage({
  searchParams,
}: {
  searchParams: { created?: string; error?: string };
}) {
  const org = await requireOrg();
  const businesses = await getBusinessesForOrg(org.id);
  const published = businesses.filter((b) => b.status === "published");

  // Post counts + recent articles per business.
  const withPosts = await Promise.all(
    businesses.map(async (b) => ({ business: b, posts: await getPostsForBusiness(b.id) }))
  );
  const totalPosts = withPosts.reduce((n, w) => n + w.posts.length, 0);

  const entitlement = orgEntitlement(org);
  const canGenerate = supabaseWritable && entitlement.active && published.length > 0;

  const notice = searchParams.error ? NOTICES[searchParams.error] : undefined;
  const created = searchParams.created ? Number(searchParams.created) : undefined;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">SEO &amp; Blog</h1>
          <p className="mt-1 text-sm text-slate-500">
            Auto-generated, locally-targeted articles that help your sites rank for nearby areas.
          </p>
        </div>
        <form action={generateArticlesAction}>
          <button
            type="submit"
            disabled={!canGenerate}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Generate articles
          </button>
        </form>
      </div>

      {created !== undefined && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {created > 0
            ? `Generated ${created} new article${created === 1 ? "" : "s"}. They're live on your published sites now.`
            : "No new articles to add — your published sites are already fully covered for now."}
        </div>
      )}
      {notice && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            notice.tone === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-amber-200 bg-amber-50 text-amber-800"
          }`}
        >
          {notice.text}
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <p className="text-sm text-slate-600">
          Each run publishes up to <span className="font-medium">{POSTS_PER_RUN}</span> fresh articles
          per live site (skipping any that already exist), targeting phrases like{" "}
          <span className="font-medium">&ldquo;your service in a nearby area&rdquo;</span>. The nightly
          cron does this automatically; use <span className="font-medium">Generate articles</span> to run
          it now. <span className="font-medium">{totalPosts}</span> article
          {totalPosts === 1 ? "" : "s"} published so far.
        </p>
        {!entitlement.active && (
          <p className="mt-3 text-sm text-amber-700">
            {entitlement.reason} <Link href="/admin/billing" className="font-medium underline">Manage billing →</Link>
          </p>
        )}
      </div>

      {withPosts.length === 0 ? (
        <p className="text-sm text-slate-500">No businesses yet. Create and publish one to get started.</p>
      ) : (
        <div className="space-y-4">
          {withPosts.map(({ business, posts }) => (
            <div key={business.id} className="rounded-2xl border border-slate-200 bg-white p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="font-medium">{business.data.name}</h2>
                  <p className="text-xs text-slate-500">
                    <span className="capitalize">{business.status}</span> · {posts.length} article
                    {posts.length === 1 ? "" : "s"}
                  </p>
                </div>
                {business.status === "published" && posts.length > 0 && (
                  <Link
                    href={`/${business.slug}/blog`}
                    target="_blank"
                    className="text-sm font-medium text-slate-600 hover:text-slate-900"
                  >
                    View blog →
                  </Link>
                )}
              </div>

              {posts.length > 0 && (
                <ul className="mt-4 divide-y divide-slate-100 text-sm">
                  {posts.slice(0, 8).map((post) => (
                    <li key={post.id} className="flex items-center justify-between gap-3 py-2">
                      <span className="truncate text-slate-700">{post.title}</span>
                      {business.status === "published" ? (
                        <Link
                          href={`/${business.slug}/blog/${post.slug}`}
                          target="_blank"
                          className="shrink-0 text-slate-500 hover:text-slate-900"
                        >
                          View
                        </Link>
                      ) : (
                        <span className="shrink-0 text-xs text-slate-400">draft site</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
