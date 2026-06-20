"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getPreviewPassword } from "@/lib/preview-analytics";
import { gateCookie } from "./gate-cookie";

/**
 * Verify a submitted password for a password-gated demo. On success, sets a
 * scoped cookie so the visitor isn't re-prompted, then redirects back to the demo.
 * On failure, redirects back with ?bad=1 so the form can show an error.
 */
export async function submitPreviewPassword(formData: FormData): Promise<void> {
  const token = String(formData.get("token") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!token) redirect("/");

  const expected = await getPreviewPassword(token);
  // No gate (or column not migrated) → just proceed.
  if (!expected) redirect(`/preview/${token}`);

  if (password === expected) {
    cookies().set(gateCookie(token), "ok", {
      httpOnly: true,
      sameSite: "lax",
      path: `/preview/${token}`,
      maxAge: 60 * 60 * 24 * 30,
    });
    redirect(`/preview/${token}`);
  }
  redirect(`/preview/${token}?bad=1`);
}
