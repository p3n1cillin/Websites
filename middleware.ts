import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getSlugByDomain, isPlatformHost } from "@/lib/domains";

/**
 * Two responsibilities, split by host:
 *
 *  1. CUSTOM DOMAINS — when a request arrives on a tenant's own domain (not the
 *     platform host), rewrite it to that tenant's `/[business]` path so the
 *     existing per-tenant pages render under a bare domain. API and asset paths
 *     are left alone so forms (/api/enquiry) and `_next` assets keep working.
 *
 *  2. ADMIN AUTH — on the platform host, refresh the Supabase session and gate
 *     /admin/*: unauthenticated users are redirected to /admin/login.
 *
 * The public platform host pays only a cheap string check (isPlatformHost) and
 * an early return — no database hit — so tenant SSG pages stay fast.
 */
export async function middleware(request: NextRequest) {
  const host = request.headers.get("host") ?? "";

  // --- 1. Custom-domain rewrite -------------------------------------------
  if (!isPlatformHost(host)) {
    return handleCustomDomain(request, host);
  }

  // --- 2. Admin auth (platform host only) ---------------------------------
  return handleAdminAuth(request);
}

async function handleCustomDomain(request: NextRequest, host: string) {
  const { pathname } = request.nextUrl;

  // Don't rewrite API routes (enquiry form posts here), Next internals, or the
  // admin area — those resolve the same on any host.
  if (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/preview/") || // tokenised prospect demos resolve on any host
    pathname.startsWith("/portal/") || // tokenised customer portals resolve on any host
    pathname.startsWith("/proposal/") // tokenised sales proposals resolve on any host
  ) {
    return NextResponse.next();
  }

  const slug = await getSlugByDomain(host);
  // Unmapped domain → let it fall through (renders the platform 404).
  if (!slug) return NextResponse.next();

  // Already serving this tenant's subtree (e.g. an internal link kept the
  // prefix) — don't double-prefix.
  if (pathname === `/${slug}` || pathname.startsWith(`/${slug}/`)) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = `/${slug}${pathname === "/" ? "" : pathname}`;
  return NextResponse.rewrite(url);
}

async function handleAdminAuth(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only the admin area + auth callback need a session; everything else is public.
  const isAdminScope = pathname.startsWith("/admin") || pathname.startsWith("/auth/");
  if (!isAdminScope) return NextResponse.next();

  // Public auth routes — never gate these.
  const isPublicAdminRoute =
    pathname === "/admin/login" || pathname.startsWith("/auth/");

  const response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Without Supabase configured there is no session to refresh; let the admin
  // layout render its "setup required" screen instead of redirect-looping.
  if (!url || !anon) return response;

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !isPublicAdminRoute) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/admin/login";
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  /**
   * Run on everything except Next internals and static files. Custom-domain
   * rewriting must see public page requests, so the matcher can no longer be
   * limited to /admin. The platform host short-circuits cheaply (see above).
   */
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)"],
};
