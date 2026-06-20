import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

/**
 * Authenticated, cookie-bound Supabase client for Server Components, Server
 * Actions and Route Handlers in the admin app.
 *
 * This is the *auth* client: it carries the signed-in admin's session (via
 * httpOnly cookies) so RLS scopes every query to that user's own org. It is
 * distinct from lib/supabase/client.ts, which is the zero-dependency PostgREST
 * layer the public sites use for published reads + service-role writes.
 */
export function createSupabaseServerClient() {
  const cookieStore = cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anon) {
    throw new Error(
      "Supabase auth requires NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
    );
  }

  return createServerClient(url, anon, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        // In a Server Component cookies are read-only; the middleware refreshes
        // the session, so swallow the write here. In Server Actions / Route
        // Handlers the write succeeds.
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          /* called from a Server Component render — safe to ignore */
        }
      },
    },
  });
}
