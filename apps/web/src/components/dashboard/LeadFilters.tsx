import { Lead, ScrapeBatch, downloadCsv } from "@/lib/scraper";

type LeadFiltersProps = {
  batches: ScrapeBatch[];
  hasWebsite: string;
  leads: Lead[];
  ratingLt: string;
  search: string;
  selectedBatchId: string;
  isClearingAllTabs: boolean;
  onHasWebsiteChange: (value: string) => void;
  onRatingLtChange: (value: string) => void;
  onRefresh: () => void;
  onClearAllTabs: () => void;
  onSearchChange: (value: string) => void;
  onSelectedBatchChange: (value: string) => void;
};

export function LeadFilters({
  batches,
  hasWebsite,
  leads,
  ratingLt,
  search,
  selectedBatchId,
  isClearingAllTabs,
  onHasWebsiteChange,
  onRatingLtChange,
  onRefresh,
  onClearAllTabs,
  onSearchChange,
  onSelectedBatchChange,
}: LeadFiltersProps) {
  return (
    <div className="space-y-4 rounded-lg border border-[#d8ddd4] bg-white p-4 shadow-sm">
      {batches.length > 0 ? (
        <div>
          <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-semibold text-[#405149]">
              Search tabs
            </p>
            <div className="flex items-center gap-3">
              <p className="text-xs text-[#66746c]">
                Clearing tabs keeps contacts saved.
              </p>
              <button
                type="button"
                onClick={onClearAllTabs}
                disabled={isClearingAllTabs}
                className="rounded-lg border border-[#e4c0b7] px-3 py-1.5 text-xs font-semibold text-[#9b341e] transition hover:bg-[#fff2ed] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isClearingAllTabs ? "Clearing..." : "Clear all tabs"}
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {batches.map((batch) => (
              <button
                key={batch.id}
                type="button"
                onClick={() => onSelectedBatchChange(batch.id)}
                className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition ${
                  selectedBatchId === batch.id
                    ? "border-[#164c3b] bg-[#164c3b] text-white"
                    : "border-[#cbd5ca] bg-[#fbfcf9] text-[#405149] hover:bg-[#eef2ea]"
                }`}
              >
                {batch.keyword}
                <span className="ml-2 opacity-75">{batch.leadCount}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-[1fr_150px_170px_auto_auto]">
      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium text-[#405149]">Search leads</span>
        <input
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          className="h-11 rounded-lg border border-[#cad1c6] px-3 outline-none transition focus:border-[#256b55] focus:ring-4 focus:ring-[#256b55]/10"
          placeholder="name, category, address"
        />
      </label>
      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium text-[#405149]">Rating below</span>
        <input
          value={ratingLt}
          onChange={(event) => onRatingLtChange(event.target.value)}
          className="h-11 rounded-lg border border-[#cad1c6] px-3 outline-none transition focus:border-[#256b55] focus:ring-4 focus:ring-[#256b55]/10"
          inputMode="decimal"
          placeholder="4"
        />
      </label>
      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium text-[#405149]">Website</span>
        <select
          value={hasWebsite}
          onChange={(event) => onHasWebsiteChange(event.target.value)}
          className="h-11 rounded-lg border border-[#cad1c6] px-3 outline-none transition focus:border-[#256b55] focus:ring-4 focus:ring-[#256b55]/10"
        >
          <option value="all">All</option>
          <option value="true">Has website</option>
          <option value="false">No website</option>
        </select>
      </label>
      <button
        onClick={onRefresh}
        className="h-11 self-end rounded-lg border border-[#b8c3b7] px-4 font-semibold text-[#24372f] transition hover:bg-[#eef2ea]"
      >
        Refresh
      </button>
      <button
        onClick={() => downloadCsv(leads)}
        disabled={leads.length === 0}
        className="h-11 self-end rounded-lg bg-[#23332d] px-4 font-semibold text-white transition hover:bg-[#17241f] disabled:cursor-not-allowed disabled:bg-[#9aa59f]"
      >
        Download CSV
      </button>
      </div>
    </div>
  );
}
