import Link from "next/link";
import { requireOrg } from "@/lib/auth";
import { BusinessForm } from "../_form";
import { createBusinessAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewBusinessPage() {
  await requireOrg();

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/businesses" className="text-sm text-slate-500 hover:text-slate-900">
          ← Businesses
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">New business</h1>
        <p className="text-sm text-slate-500">
          Saved as a draft — publish it when you&apos;re ready to go live.
        </p>
      </div>
      <BusinessForm action={createBusinessAction} submitLabel="Create draft" />
    </div>
  );
}
