import type { ReactNode } from "react";
import { supabaseConfigured, supabaseWritable } from "@/lib/supabase/client";

export const metadata = {
  title: "Admin — Site Generator",
  robots: { index: false, follow: false },
};

/**
 * Top-level admin guard. The admin needs the Supabase backend (auth + writes),
 * so when it isn't configured we render a clear setup screen instead of
 * crashing. The public tenant sites still run with zero configuration.
 */
export default function AdminRootLayout({ children }: { children: ReactNode }) {
  if (!supabaseConfigured || !supabaseWritable) {
    return (
      <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-8">
          <h1 className="text-xl font-semibold text-amber-900">Admin setup required</h1>
          <p className="mt-2 text-sm text-amber-800">
            The admin dashboard needs Supabase. Set these environment variables and reload:
          </p>
          <ul className="mt-4 space-y-1 text-sm text-amber-900">
            <li>
              <code>NEXT_PUBLIC_SUPABASE_URL</code>
            </li>
            <li>
              <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>
            </li>
            <li>
              <code>SUPABASE_SERVICE_ROLE_KEY</code> {supabaseWritable ? "✓" : "(missing)"}
            </li>
          </ul>
          <p className="mt-4 text-sm text-amber-800">
            Then apply <code>supabase/migrations/0001_init.sql</code> in your project.
          </p>
        </div>
      </main>
    );
  }

  return <div className="min-h-screen bg-slate-50 text-slate-900">{children}</div>;
}
