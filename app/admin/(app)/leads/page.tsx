import { requireOrg } from "@/lib/auth";
import { getLeadsForOrg } from "@/lib/leads";
import { LEAD_STATUSES, type Lead } from "@/lib/types";
import { updateLeadStatusAction } from "./actions";

export const dynamic = "force-dynamic";

const STATUS_STYLE: Record<string, string> = {
  new: "bg-blue-100 text-blue-700",
  contacted: "bg-amber-100 text-amber-700",
  won: "bg-emerald-100 text-emerald-700",
  lost: "bg-slate-200 text-slate-600",
};

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function LeadsPage() {
  const org = await requireOrg();
  const leads = await getLeadsForOrg(org.id);

  const counts = LEAD_STATUSES.map((s) => ({
    status: s,
    count: leads.filter((l) => l.status === s).length,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Leads</h1>
        <div className="flex gap-2 text-xs">
          {counts.map((c) => (
            <span
              key={c.status}
              className={`rounded-full px-2.5 py-1 font-medium capitalize ${STATUS_STYLE[c.status]}`}
            >
              {c.count} {c.status}
            </span>
          ))}
        </div>
      </div>

      {leads.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center text-slate-500">
          No leads yet. They&apos;ll appear here as visitors submit your contact and booking forms.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Received</th>
                <th className="px-4 py-3 font-medium">Contact</th>
                <th className="px-4 py-3 font-medium">Business</th>
                <th className="px-4 py-3 font-medium">Details</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead: Lead) => (
                <tr key={lead.id} className="border-b border-slate-100 align-top last:border-0">
                  <td className="whitespace-nowrap px-4 py-3 text-slate-500">
                    {fmtDate(lead.createdAt)}
                    <div className="text-xs capitalize text-slate-400">{lead.type}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{lead.name}</div>
                    <a href={`tel:${lead.phone}`} className="block text-slate-600 hover:underline">
                      {lead.phone}
                    </a>
                    {lead.email && (
                      <a
                        href={`mailto:${lead.email}`}
                        className="block text-xs text-slate-400 hover:underline"
                      >
                        {lead.email}
                      </a>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{lead.businessName ?? "—"}</td>
                  <td className="max-w-xs px-4 py-3 text-slate-600">
                    {lead.service && <div className="font-medium">{lead.service}</div>}
                    {lead.preferredDate && (
                      <div className="text-xs text-slate-400">Preferred: {lead.preferredDate}</div>
                    )}
                    {lead.message && <p className="mt-1 text-xs text-slate-500">{lead.message}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <form action={updateLeadStatusAction} className="flex items-center gap-2">
                      <input type="hidden" name="id" value={lead.id} />
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_STYLE[lead.status]}`}
                      >
                        {lead.status}
                      </span>
                      <select
                        name="status"
                        defaultValue={lead.status}
                        className="rounded-md border border-slate-300 px-2 py-1 text-xs"
                      >
                        {LEAD_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                      <button className="rounded-md bg-slate-900 px-2 py-1 text-xs font-medium text-white hover:bg-slate-700">
                        Set
                      </button>
                    </form>
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
