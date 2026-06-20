import Link from "next/link";
import { requireOrg } from "@/lib/auth";
import { getBusinessesForOrg } from "@/lib/businesses";
import { publishAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function BusinessesPage() {
  const org = await requireOrg();
  const businesses = await getBusinessesForOrg(org.id);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Businesses</h1>
        <Link
          href="/admin/businesses/new"
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          + New business
        </Link>
      </div>

      {businesses.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center text-slate-500">
          No businesses yet.{" "}
          <Link href="/admin/businesses/new" className="font-medium text-slate-900 underline">
            Create your first
          </Link>
          .
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">City</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {businesses.map((biz) => (
                <tr key={biz.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-3">
                    <div className="font-medium">{biz.data.name}</div>
                    <div className="text-xs text-slate-400">/{biz.slug}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{biz.city}</td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        biz.status === "published"
                          ? "rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700"
                          : "rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600"
                      }
                    >
                      {biz.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-3">
                      {biz.status === "published" && (
                        <a
                          href={`/${biz.slug}`}
                          target="_blank"
                          className="text-slate-500 hover:text-slate-900"
                        >
                          View
                        </a>
                      )}
                      <Link
                        href={`/admin/businesses/${biz.id}`}
                        className="text-slate-500 hover:text-slate-900"
                      >
                        Edit
                      </Link>
                      <form action={publishAction}>
                        <input type="hidden" name="id" value={biz.id} />
                        <input type="hidden" name="status" value={biz.status} />
                        <button className="text-slate-500 hover:text-slate-900">
                          {biz.status === "published" ? "Unpublish" : "Publish"}
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
