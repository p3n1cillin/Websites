"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "../auth-actions";
import { brand } from "@/lib/brand";

/**
 * Admin navigation — a grouped sidebar on desktop, a condensed scrolling bar on
 * mobile. Driven by one `GROUPS` list with active state from the live pathname.
 * Monochrome, one locked accent (slate-900 = active/primary), single radius scale.
 */

interface NavItem {
  href: string;
  label: string;
}
interface NavGroup {
  label: string;
  items: NavItem[];
}

const GROUPS: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { href: "/admin", label: "Nexus" },
      { href: "/admin/briefing", label: "Briefing" },
      { href: "/admin/empire", label: "Empire" },
    ],
  },
  {
    label: "Acquire",
    items: [
      { href: "/admin/prospects", label: "Prospects" },
      { href: "/admin/factory", label: "Factory" },
    ],
  },
  {
    label: "Deliver",
    items: [
      { href: "/admin/businesses", label: "Businesses" },
      { href: "/admin/customers", label: "Customers" },
      { href: "/admin/leads", label: "Leads" },
    ],
  },
  {
    label: "Digital Products",
    items: [
      { href: "/map-pack-kit", label: "Map Pack Kit ↗" },
      { href: "/kit/sample", label: "Sample Kit ↗" },
      { href: "/free-tools/google-business-description", label: "Free GBP Tool ↗" },
    ],
  },
  {
    label: "Grow",
    items: [
      { href: "/admin/growth", label: "Growth" },
      { href: "/admin/workflows", label: "Workflows" },
      { href: "/admin/agents", label: "Agents" },
      { href: "/admin/knowledge", label: "Knowledge" },
      { href: "/admin/blog", label: "SEO & Blog" },
    ],
  },
  { label: "Account", items: [{ href: "/admin/billing", label: "Billing" }] },
];

/** Dashboard matches exactly; section roots match themselves + their children. */
function useIsActive(pathname: string) {
  return (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(`${href}/`);
}

export default function AdminNav({
  orgName,
  plan,
  trialLeft,
  initialTheme = "light",
}: {
  orgName: string;
  plan: string;
  trialLeft: number | null;
  initialTheme?: "light" | "dark";
}) {
  const pathname = usePathname();
  const isActive = useIsActive(pathname);
  const [theme, setTheme] = useState<"light" | "dark">(initialTheme);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.querySelector(".admin-root")?.classList.toggle("dark", next === "dark");
    document.cookie = `admin-theme=${next}; path=/; max-age=31536000; samesite=lax`;
  }

  const ThemeButton = (
    <button
      onClick={toggleTheme}
      title={theme === "dark" ? "Switch to light" : "Switch to dark"}
      aria-label="Toggle theme"
      className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 active:translate-y-px"
    >
      {theme === "dark" ? "☀" : "☾"}
    </button>
  );

  const linkClass = (active: boolean) =>
    `block rounded-lg px-3 py-2 text-sm font-medium transition-colors active:translate-y-px ${
      active
        ? "bg-slate-900 text-white"
        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
    }`;

  const Wordmark = (
    <Link href="/admin" className="flex items-center gap-2.5">
      <span className="grid h-7 w-7 place-items-center rounded-lg bg-slate-900 text-xs font-bold text-white">
        {brand.name.charAt(0)}
      </span>
      <span className="text-sm font-semibold tracking-tight text-slate-900">{brand.name}</span>
    </Link>
  );

  const PlanBadge = (
    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium capitalize text-slate-700">
      {plan}
      {plan === "trial" && trialLeft !== null ? ` · ${trialLeft}d left` : ""}
    </span>
  );

  return (
    <>
      {/* Mobile: sticky top bar + horizontal scrolling links. */}
      <div className="sticky top-0 z-30 border-b border-slate-200 bg-white/85 backdrop-blur lg:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          {Wordmark}
          <div className="flex items-center gap-3">
            {PlanBadge}
            {ThemeButton}
            <form action={signOut}>
              <button className="text-sm text-slate-500 hover:text-slate-900">Sign out</button>
            </form>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-2">
          {GROUPS.flatMap((g) => g.items).map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                isActive(item.href)
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>

      {/* Desktop: grouped sidebar. */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-slate-200 bg-white lg:flex">
        <div className="px-5 py-5">{Wordmark}</div>

        <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-2">
          {GROUPS.map((group) => (
            <div key={group.label} className="space-y-1">
              <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                {group.label}
              </p>
              {group.items.map((item) => (
                <Link key={item.href} href={item.href} className={linkClass(isActive(item.href))}>
                  {item.label}
                </Link>
              ))}
            </div>
          ))}
        </nav>

        <div className="space-y-3 border-t border-slate-200 px-4 py-4">
          <div className="flex items-center justify-between gap-2">
            {PlanBadge}
            <span className="truncate text-xs text-slate-500" title={orgName}>
              {orgName}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {ThemeButton}
            <form action={signOut} className="flex-1">
              <button className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 active:translate-y-px">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </aside>
    </>
  );
}
