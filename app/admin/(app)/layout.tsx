import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { requireOrg } from "@/lib/auth";
import AdminNav from "./AdminNav";

/**
 * Authed admin shell (route group — adds no URL segment). Everything under here
 * requires a resolved org; `requireOrg` redirects to /admin/login otherwise.
 * The login page lives outside this group, so it renders without the shell.
 *
 * Layout: a grouped sidebar (AdminNav) on the left, scrolling content on the right
 * (a condensed top bar replaces the sidebar on mobile).
 */
export default async function AdminAppLayout({ children }: { children: ReactNode }) {
  const org = await requireOrg();

  const trialLeft = org.trialEndsAt
    ? Math.max(
        0,
        Math.ceil((new Date(org.trialEndsAt).getTime() - Date.now()) / 86_400_000)
      )
    : null;

  // Theme is persisted in a cookie so the server can render the right class on the
  // first paint (no flash). The toggle (AdminNav) updates the cookie + DOM class.
  const theme = cookies().get("admin-theme")?.value === "dark" ? "dark" : "light";

  return (
    <div className={`admin-root min-h-screen bg-slate-50/40 lg:flex ${theme === "dark" ? "dark" : ""}`}>
      <AdminNav orgName={org.name} plan={org.plan} trialLeft={trialLeft} initialTheme={theme} />
      <main className="admin-shell mx-auto w-full min-w-0 max-w-6xl flex-1 px-6 py-8 lg:px-10">
        {children}
      </main>
    </div>
  );
}
