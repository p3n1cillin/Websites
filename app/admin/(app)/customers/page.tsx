import { requireOrg } from "@/lib/auth";
import { getPortalsForOrg } from "@/lib/customers";
import { getBusinessesForOrg } from "@/lib/businesses";
import { getChangeRequestsForOrg } from "@/lib/change-requests";
import { getRetainersForOrg } from "@/lib/retainers";
import { SITE_URL } from "@/lib/seo";
import type { ChangeRequest } from "@/lib/types";
import Customers, { type CustomerView } from "./Customers";
import Retainers from "./Retainers";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const org = await requireOrg();
  const [portals, businesses, requests, retainers] = await Promise.all([
    getPortalsForOrg(org.id),
    getBusinessesForOrg(org.id),
    getChangeRequestsForOrg(org.id),
    getRetainersForOrg(org.id),
  ]);

  const bizById = new Map(businesses.map((b) => [b.id, b]));
  const reqByBusiness: Record<string, ChangeRequest[]> = {};
  for (const r of requests) (reqByBusiness[r.businessId] ??= []).push(r);

  const customers: CustomerView[] = portals
    .map((portal) => {
      const biz = bizById.get(portal.businessId);
      if (!biz) return null;
      return {
        portalId: portal.id,
        portalUrl: `${SITE_URL}/portal/${portal.token}`,
        portalStatus: portal.status,
        businessId: biz.id,
        name: biz.data.name,
        published: biz.status === "published",
        liveUrl: biz.customDomain ? `https://${biz.customDomain}` : `${SITE_URL}/${biz.slug}`,
        requests: reqByBusiness[biz.id] ?? [],
      } satisfies CustomerView;
    })
    .filter((c): c is CustomerView => c !== null);

  const openRequests = requests.filter((r) => r.status === "open").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Customers</h1>
          <p className="mt-1 text-sm text-slate-500">
            Onboarded clients — their portal, site health and change requests.
          </p>
        </div>
        <div className="flex gap-2 text-xs">
          <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-600">
            {customers.length} customer{customers.length === 1 ? "" : "s"}
          </span>
          <span className="rounded-full bg-amber-100 px-2.5 py-1 font-medium text-amber-700">
            {openRequests} open request{openRequests === 1 ? "" : "s"}
          </span>
        </div>
      </div>

      <Retainers retainers={retainers} />

      {customers.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center text-slate-500">
          No customers yet. Win a prospect and onboard it from the Prospects board to create a site
          and open its portal.
        </div>
      ) : (
        <Customers customers={customers} />
      )}
    </div>
  );
}
