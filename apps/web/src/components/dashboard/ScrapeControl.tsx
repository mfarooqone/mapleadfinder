import { FormEvent } from "react";
import Link from "next/link";
import {
  getProgressDetails,
  getProgressValue,
  ScrapeStatus,
  statusLabels,
} from "@/lib/scraper";

type ScrapeControlProps = {
  activeJobId: string | null;
  error: string | null;
  hasLeads: boolean;
  isStarting: boolean;
  isStopping: boolean;
  findDecisionMakers: boolean;
  keyword: string;
  maxRecords: string;
  onDownload: () => void;
  onFindDecisionMakersChange: (enabled: boolean) => void;
  onKeywordChange: (keyword: string) => void;
  onMaxRecordsChange: (maxRecords: string) => void;
  onStartScrape: (event: FormEvent<HTMLFormElement>) => void;
  onStopScrape: () => void;
  status: ScrapeStatus | null;
  statuses: ScrapeStatus[];
};

export function ScrapeControl({
  activeJobId,
  error,
  hasLeads,
  isStarting,
  isStopping,
  findDecisionMakers,
  keyword,
  maxRecords,
  onDownload,
  onFindDecisionMakersChange,
  onKeywordChange,
  onMaxRecordsChange,
  onStartScrape,
  onStopScrape,
  status,
  statuses,
}: ScrapeControlProps) {
  const isScraping = isStarting || Boolean(activeJobId);
  const visibleStatuses = statuses.length
    ? statuses
    : status
      ? [status]
      : [];
  const statusText = status
    ? statusLabels[status.status] ?? status.status
    : "Ready";
  const progress =
    status?.status === "completed" ? 100 : getProgressValue(status?.progress);
  const progressDetails = getProgressDetails(status);
  const processedListings = progressDetails?.processedListings ?? 0;
  const totalListings = progressDetails?.totalListings;
  const discoveredLeads =
    progressDetails?.discoveredLeads ?? status?.result?.discovered ?? 0;
  const savedLeads = progressDetails?.savedLeads ?? status?.result?.saved ?? 0;

  return (
    <>
      <form
        onSubmit={onStartScrape}
        className="grid gap-3 rounded-lg border border-[#d8ddd4] bg-white p-4 shadow-sm lg:grid-cols-[1fr_180px_auto]"
      >
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium text-[#405149]">Keyword</span>
          <input
            value={keyword}
            onChange={(event) => onKeywordChange(event.target.value)}
            className="h-12 rounded-lg border border-[#cad1c6] px-4 text-base outline-none transition focus:border-[#256b55] focus:ring-4 focus:ring-[#256b55]/10"
            placeholder="restaurants in Multan"
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium text-[#405149]">Records to scrape</span>
          <input
            type="number"
            min={1}
            max={500}
            value={maxRecords}
            onChange={(event) => onMaxRecordsChange(event.target.value)}
            className="h-12 rounded-lg border border-[#cad1c6] px-4 text-base outline-none transition focus:border-[#256b55] focus:ring-4 focus:ring-[#256b55]/10"
            placeholder="120"
          />
        </label>
        <div className="flex items-end gap-2">
          <button
            type="submit"
            disabled={isScraping}
            className="h-12 rounded-lg bg-[#164c3b] px-6 font-semibold text-white transition hover:bg-[#0f3d2e] disabled:cursor-not-allowed disabled:bg-[#91a197]"
          >
            {isScraping ? "Scraping..." : "Start scrape"}
          </button>
          {isScraping && (
            <button
              type="button"
              onClick={onStopScrape}
              disabled={isStopping}
              className="h-12 rounded-lg border border-[#c0392b] bg-white px-5 font-semibold text-[#c0392b] transition hover:bg-[#fff2f0] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isStopping ? "Stopping..." : "Stop"}
            </button>
          )}
          {hasLeads && !isScraping && (
            <button
              type="button"
              onClick={onDownload}
              className="h-12 rounded-lg border border-[#256b55] bg-white px-5 font-semibold text-[#256b55] transition hover:bg-[#f0faf5]"
            >
              Download CSV
            </button>
          )}
        </div>
        <label className="flex items-center gap-3 lg:col-span-3">
          <input
            type="checkbox"
            checked={findDecisionMakers}
            onChange={(event) =>
              onFindDecisionMakersChange(event.target.checked)
            }
            className="h-5 w-5 rounded border-[#cad1c6] accent-[#164c3b]"
          />
          <span className="text-sm font-medium text-[#405149]">
            Find decision makers after scrape
          </span>
        </label>
      </form>

      <div className="rounded-lg border border-[#d8ddd4] bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-[#5e6c64]">Job status</p>
            <p className="mt-1 text-lg font-semibold">{statusText}</p>
            {progressDetails?.phase ? (
              <p className="mt-1 text-sm text-[#5e6c64]">
                {progressDetails.phase}
              </p>
            ) : null}
          </div>
          <div className="flex items-center gap-4">
            {status?.result ? (
              <div className="text-sm text-[#5e6c64]">
                <p>
                  Discovered {status.result.discovered} and saved{" "}
                  {status.result.saved} to Contacts.
                </p>
                {status.result.decisionMakers ? (
                  <p>
                    Decision makers found:{" "}
                    {status.result.decisionMakers.found} /{" "}
                    {status.result.decisionMakers.processed}.
                  </p>
                ) : null}
              </div>
            ) : null}
            {status?.status === "completed" && status.result?.leads?.length ? (
              <div className="flex flex-wrap items-center justify-end gap-2">
                <Link
                  href="/dashboard/contacts"
                  className="rounded-lg bg-[#164c3b] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#0f3d2e]"
                >
                  Open Contacts
                </Link>
                <button
                  type="button"
                  onClick={onDownload}
                  className="rounded-lg border border-[#256b55] bg-white px-4 py-2 text-sm font-semibold text-[#256b55] transition hover:bg-[#f0faf5]"
                >
                  Download CSV
                </button>
              </div>
            ) : null}
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          <div className="rounded-lg border border-[#e1e5dd] bg-[#fbfcf9] px-3 py-2">
            <p className="text-xs font-medium uppercase text-[#66746c]">
              Progress
            </p>
            <p className="mt-1 text-lg font-semibold">{progress}%</p>
          </div>
          <div className="rounded-lg border border-[#e1e5dd] bg-[#fbfcf9] px-3 py-2">
            <p className="text-xs font-medium uppercase text-[#66746c]">
              Records done
            </p>
            <p className="mt-1 text-lg font-semibold">
              {totalListings !== undefined
                ? `${processedListings} / ${totalListings}`
                : processedListings}
            </p>
          </div>
          <div className="rounded-lg border border-[#e1e5dd] bg-[#fbfcf9] px-3 py-2">
            <p className="text-xs font-medium uppercase text-[#66746c]">
              Leads found
            </p>
            <p className="mt-1 text-lg font-semibold">{discoveredLeads}</p>
          </div>
          <div className="rounded-lg border border-[#e1e5dd] bg-[#fbfcf9] px-3 py-2">
            <p className="text-xs font-medium uppercase text-[#66746c]">
              Saved
            </p>
            <p className="mt-1 text-lg font-semibold">{savedLeads}</p>
          </div>
        </div>
        <div className="mt-4 h-3 overflow-hidden rounded-full bg-[#e5e9e1]">
          <div
            className="h-full rounded-full bg-[#2f8065] transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        {visibleStatuses.length > 1 ? (
          <div className="mt-4 space-y-3">
            {visibleStatuses.map((item, index) => (
              <ScrapeJobProgress
                key={item.jobId ?? `${item.keyword ?? "scrape"}-${index}`}
                status={item}
              />
            ))}
          </div>
        ) : null}
        {isScraping && (
          <p className="mt-2 text-xs text-[#5e6c64]">
            Scrolling through all results. Decision-maker search may add extra time.
          </p>
        )}
        {error ? (
          <p className="mt-3 rounded-lg bg-[#fff2ed] px-3 py-2 text-sm text-[#9b341e]">
            {error}
          </p>
        ) : null}
      </div>
    </>
  );
}

function ScrapeJobProgress({ status }: { status: ScrapeStatus }) {
  const progress =
    status.status === "completed" ? 100 : getProgressValue(status.progress);
  const progressDetails = getProgressDetails(status);
  const processedListings = progressDetails?.processedListings ?? 0;
  const totalListings = progressDetails?.totalListings;
  const discoveredLeads =
    progressDetails?.discoveredLeads ?? status.result?.discovered ?? 0;
  const savedLeads = progressDetails?.savedLeads ?? status.result?.saved ?? 0;
  const label = statusLabels[status.status] ?? status.status;

  return (
    <div className="rounded-lg border border-[#e1e5dd] bg-[#fbfcf9] p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-[#14211b]">
            {status.keyword ?? "Scrape job"}
          </p>
          <p className="mt-0.5 text-xs text-[#66746c]">
            {label}
            {progressDetails?.phase ? ` · ${progressDetails.phase}` : ""}
          </p>
        </div>
        <div className="text-xs text-[#5e6c64] sm:text-right">
          <p>{progress}% complete</p>
          <p>
            Saved {savedLeads}
            {totalListings !== undefined
              ? ` · ${processedListings}/${totalListings} records`
              : ""}
          </p>
        </div>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#e5e9e1]">
        <div
          className="h-full rounded-full bg-[#2f8065] transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>
      {status.result ? (
        <p className="mt-2 text-xs text-[#5e6c64]">
          Discovered {status.result.discovered}, saved {status.result.saved}
          {status.result.decisionMakers
            ? `, decision makers ${status.result.decisionMakers.found}/${status.result.decisionMakers.processed}`
            : ""}
          .
        </p>
      ) : (
        <p className="mt-2 text-xs text-[#5e6c64]">
          Leads found so far: {discoveredLeads}
        </p>
      )}
      {status.failedReason ? (
        <p className="mt-2 text-xs text-[#9b341e]">{status.failedReason}</p>
      ) : null}
    </div>
  );
}
