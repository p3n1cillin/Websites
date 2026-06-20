import { redirect } from "next/navigation";

/**
 * Root is the agency app, not a public directory. Send "/" straight to the admin
 * Command Center (which itself bounces to /admin/login when there's no session).
 * On a custom tenant domain, middleware rewrites "/" to the tenant site before
 * this runs, so this redirect only applies to the primary app domain.
 */
export default function RootPage() {
  redirect("/admin");
}
