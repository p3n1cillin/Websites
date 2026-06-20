import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { CATALOGUE_TAG, tenantTag } from "@/lib/cache-tags";

export const runtime = "nodejs";

/**
 * On-demand revalidation endpoint.
 *
 * The data-layer write functions (lib/businesses.ts) already revalidate after
 * admin edits. This route covers the other case: a business row changed outside
 * the app (a Supabase DB webhook, a manual fix, a bulk import). It refreshes the
 * catalogue and, if given a slug, that single tenant's pages.
 *
 *   POST /api/revalidate
 *   { "secret": "<REVALIDATE_SECRET>", "slug": "elite-plumbing-warrington" }
 *
 * `slug` is optional — omit it to refresh just the catalogue/directory.
 */
export async function POST(request: Request) {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "REVALIDATE_SECRET is not configured." },
      { status: 500 }
    );
  }

  let body: { secret?: string; slug?: string };
  try {
    body = (await request.json()) as { secret?: string; slug?: string };
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (body.secret !== secret) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  revalidateTag(CATALOGUE_TAG);
  if (body.slug) revalidateTag(tenantTag(body.slug));

  return NextResponse.json({
    revalidated: true,
    tags: body.slug ? [CATALOGUE_TAG, tenantTag(body.slug)] : [CATALOGUE_TAG],
  });
}
