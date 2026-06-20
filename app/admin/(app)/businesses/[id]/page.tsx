import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireOrg } from "@/lib/auth";
import { getBusinessRecord } from "@/lib/businesses";
import { customDomainsAllowed } from "@/lib/plans";
import { CUSTOM_DOMAIN_A_RECORD, CUSTOM_DOMAIN_CNAME } from "@/lib/domains";
import { BusinessForm } from "../_form";
import {
  updateBusinessAction,
  publishAction,
  deleteBusinessAction,
  setCustomDomainAction,
} from "../actions";

export const dynamic = "force-dynamic";

const DOMAIN_NOTICES: Record<string, { ok: boolean; text: string }> = {
  saved: { ok: true, text: "Custom domain saved. Add the DNS records below, then publish." },
  cleared: { ok: true, text: "Custom domain removed." },
  invalid: { ok: false, text: "That doesn't look like a valid domain." },
  taken: { ok: false, text: "That domain is already connected to another site." },
  plan: { ok: false, text: "Custom domains are available on the Pro and Premium plans." },
  error: { ok: false, text: "Couldn't update the domain. Please try again." },
};

export default async function EditBusinessPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { created?: string; domain?: string };
}) {
  const org = await requireOrg();
  const record = await getBusinessRecord(params.id);
  if (!record) notFound();
  if (record.orgId !== org.id) redirect("/admin/businesses");

  const isPublished = record.status === "published";
  const canUseDomains = customDomainsAllowed(org.plan);
  const domainNotice = searchParams.domain ? DOMAIN_NOTICES[searchParams.domain] : undefined;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <Link href="/admin/businesses" className="text-sm text-slate-500 hover:text-slate-900">
            ← Businesses
          </Link>
          <h1 className="mt-1 text-2xl font-semibold">{record.data.name}</h1>
          <p className="text-sm text-slate-500">
            /{record.slug} · <span className="capitalize">{record.status}</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isPublished && (
            <a
              href={`/${record.slug}`}
              target="_blank"
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-100"
            >
              View live
            </a>
          )}
          <form action={publishAction}>
            <input type="hidden" name="id" value={record.id} />
            <input type="hidden" name="status" value={record.status} />
            <button className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-100">
              {isPublished ? "Unpublish" : "Publish"}
            </button>
          </form>
        </div>
      </div>

      {searchParams.created && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          Draft created. Review the details, then publish.
        </p>
      )}

      <BusinessForm
        action={updateBusinessAction}
        business={record.data}
        id={record.id}
        submitLabel="Save changes"
      />

      {/* Custom domain (Pro+). */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-medium text-slate-900">Custom domain</h2>
          {!canUseDomains && (
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
              Pro &amp; Premium
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-slate-500">
          Serve this site on the client&apos;s own domain instead of a{" "}
          <code className="rounded bg-slate-100 px-1">/{record.slug}</code> path.
        </p>

        {domainNotice && (
          <p
            className={`mt-4 rounded-lg px-3 py-2 text-sm ${
              domainNotice.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
            }`}
          >
            {domainNotice.text}
          </p>
        )}

        {canUseDomains ? (
          <>
            <form action={setCustomDomainAction} className="mt-4 flex flex-wrap items-center gap-3">
              <input type="hidden" name="id" value={record.id} />
              <input
                type="text"
                name="customDomain"
                defaultValue={record.customDomain ?? ""}
                placeholder="www.example.com"
                className="min-w-[16rem] flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <button className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700">
                {record.customDomain ? "Update" : "Connect"}
              </button>
            </form>

            <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              <p className="font-medium text-slate-800">DNS setup</p>
              <p className="mt-1">
                At the domain&apos;s registrar, add <strong>one</strong> of these records, then come
                back and connect the domain:
              </p>
              <ul className="mt-2 space-y-1">
                <li>
                  Subdomain (e.g. www) — <strong>CNAME</strong> →{" "}
                  <code className="rounded bg-white px-1">{CUSTOM_DOMAIN_CNAME}</code>
                </li>
                <li>
                  Root domain — <strong>A</strong> record →{" "}
                  <code className="rounded bg-white px-1">{CUSTOM_DOMAIN_A_RECORD}</code>
                </li>
              </ul>
              <p className="mt-2 text-xs text-slate-500">
                Also add the domain in your Vercel project so TLS is issued. DNS can take up to 48h
                to propagate.
              </p>
            </div>
          </>
        ) : (
          <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
            Upgrade to Pro on the{" "}
            <Link href="/admin/billing" className="font-medium underline">
              Billing page
            </Link>{" "}
            to connect a custom domain.
          </p>
        )}
      </div>

      <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
        <h2 className="font-medium text-red-900">Delete business</h2>
        <p className="mt-1 text-sm text-red-800">
          Permanently removes this website and its data. This cannot be undone.
        </p>
        <form action={deleteBusinessAction} className="mt-4">
          <input type="hidden" name="id" value={record.id} />
          <button className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700">
            Delete permanently
          </button>
        </form>
      </div>
    </div>
  );
}
