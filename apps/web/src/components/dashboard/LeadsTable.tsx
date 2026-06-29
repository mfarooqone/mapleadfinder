import { Lead } from "@/lib/scraper";

type LeadsTableProps = {
  isClearing: boolean;
  isLoading: boolean;
  leads: Lead[];
  selectedBatchName?: string | null;
  onClearLeads: () => void;
  onDeleteLead: (id: string) => void;
};

export function LeadsTable({
  isClearing,
  isLoading,
  leads,
  selectedBatchName,
  onClearLeads,
  onDeleteLead,
}: LeadsTableProps) {
  return (
    <div className="overflow-hidden rounded-lg border border-[#d8ddd4] bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-[#e1e5dd] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">
            {selectedBatchName ? selectedBatchName : "Scraped leads"}
          </h2>
          <p className="text-xs text-[#66746c]">
            Scraper rows are grouped by search. Contacts remain saved when a tab is cleared.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <p className="text-sm text-[#5e6c64]">
            {isLoading ? "Loading..." : `${leads.length} shown`}
          </p>
          {leads.length > 0 ? (
            <button
              type="button"
              onClick={onClearLeads}
              disabled={isClearing}
              className="rounded-lg border border-[#e4c0b7] px-3 py-2 text-sm font-semibold text-[#9b341e] transition hover:bg-[#fff2ed] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isClearing ? "Clearing..." : "Clear tab"}
            </button>
          ) : null}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-left text-sm">
          <thead className="bg-[#eef2ea] text-xs uppercase tracking-[0.12em] text-[#526257]">
            <tr>
              <th className="px-4 py-3 font-semibold">Business</th>
              <th className="px-4 py-3 font-semibold">Contact</th>
              <th className="px-4 py-3 font-semibold">Rating</th>
              <th className="px-4 py-3 font-semibold">Address</th>
              <th className="px-4 py-3 font-semibold">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#edf0ea]">
            {leads.map((lead) => (
              <tr key={lead.id ?? `${lead.name}-${lead.address}`}>
                <td className="max-w-[280px] px-4 py-4 align-top">
                  <p className="font-semibold text-[#14211b]">{lead.name}</p>
                  <p className="mt-1 text-[#66746c]">
                    {lead.category ?? "No category"}
                  </p>
                </td>
                <td className="px-4 py-4 align-top">
                  {lead.bestDecisionMaker ? (
                    <div className="mb-2 rounded-lg border border-[#d7eadf] bg-[#f3fbf6] px-3 py-2">
                      <p className="font-semibold text-[#164c3b]">
                        {lead.bestDecisionMaker.name ?? "Decision maker"}
                      </p>
                      <p className="text-xs text-[#5e6c64]">
                        {lead.bestDecisionMaker.title ?? "Best contact"} ·{" "}
                        {lead.bestDecisionMaker.emailType}
                      </p>
                    </div>
                  ) : null}
                  <p>{lead.phone ?? "No phone"}</p>
                  {lead.preferredEmail ?? lead.email ? (
                    <a
                      href={`mailto:${lead.preferredEmail ?? lead.email}`}
                      className="mt-1 block max-w-[220px] truncate text-[#1d6f56] underline-offset-4 hover:underline"
                    >
                      {lead.preferredEmail ?? lead.email}
                    </a>
                  ) : (
                    <p className="mt-1 text-[#66746c]">No email</p>
                  )}
                  {lead.preferredEmail && lead.email && lead.preferredEmail !== lead.email ? (
                    <p className="mt-1 max-w-[220px] truncate text-xs text-[#66746c]">
                      Business inbox: {lead.email}
                    </p>
                  ) : null}
                  {lead.website ? (
                    <a
                      href={lead.website}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 block max-w-[220px] truncate text-[#5e6c64] underline-offset-4 hover:underline"
                    >
                      {lead.website}
                    </a>
                  ) : (
                    <p className="mt-1 text-[#66746c]">No website</p>
                  )}
                </td>
                <td className="px-4 py-4 align-top">
                  <p className="font-semibold">{lead.rating ?? "-"}</p>
                  <p className="mt-1 text-[#66746c]">
                    {lead.reviewsCount ?? 0} reviews
                  </p>
                </td>
                <td className="max-w-[340px] px-4 py-4 align-top text-[#405149]">
                  {lead.address ?? "No address"}
                </td>
                <td className="px-4 py-4 align-top">
                  {lead.id ? (
                    <button
                      onClick={() => onDeleteLead(lead.id!)}
                      className="rounded-lg border border-[#e4c0b7] px-3 py-2 font-medium text-[#9b341e] transition hover:bg-[#fff2ed]"
                    >
                      Remove from tab
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
            {leads.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-[#66746c]">
                  No leads yet. Start a scrape to populate this table.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
