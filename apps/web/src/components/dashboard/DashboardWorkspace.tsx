"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import AppShell from "@/app/components/AppShell";
import PageHeader from "@/app/components/PageHeader";
import { deleteJson, enrichDecisionMakers, getJson, postJson } from "@/lib/backend";
import {
  Lead,
  ScrapeBatch,
  ScrapeQueueResponse,
  ScrapeStatus,
  downloadCsv,
} from "@/lib/scraper";
import { DashboardHero } from "./DashboardHero";
import { LeadFilters } from "./LeadFilters";
import { LeadsTable } from "./LeadsTable";
import { ScrapeControl } from "./ScrapeControl";

const ACTIVE_SCRAPE_STORAGE_KEY = "gmb_scraper_active_job";
const DECISION_FINDER_BATCH_SIZE = 50;

type ActiveScrapeQueue = {
  jobIds: string[];
  status?: ScrapeStatus | null;
  statuses?: ScrapeStatus[];
  pending?: PendingScrapeKeyword[];
};

type PendingScrapeKeyword = {
  keyword: string;
  maxRecords: number;
  findDecisionMakers: boolean;
  placeholderId: string;
};

export function DashboardWorkspace() {
  const [activeTool, setActiveTool] = useState<"scraper" | "finder">("scraper");
  const [keyword, setKeyword] = useState("restaurants in Multan");
  const [maxRecords, setMaxRecords] = useState("120");
  const [finderKeyword, setFinderKeyword] = useState("gym london uk");
  const [finderMaxRecords, setFinderMaxRecords] = useState("120");
  const [findDecisionMakers, setFindDecisionMakers] = useState(false);
  const [search, setSearch] = useState("");
  const [ratingLt, setRatingLt] = useState("");
  const [hasWebsite, setHasWebsite] = useState("all");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [batches, setBatches] = useState<ScrapeBatch[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string>("");
  const [status, setStatus] = useState<ScrapeStatus | null>(null);
  const [scrapeStatuses, setScrapeStatuses] = useState<ScrapeStatus[]>([]);
  const [activeJobIds, setActiveJobIds] = useState<string[]>([]);
  const [pendingScrapeKeywords, setPendingScrapeKeywords] = useState<
    PendingScrapeKeyword[]
  >([]);
  const [autoDownloadedJobIds, setAutoDownloadedJobIds] = useState<string[]>([]);
  const [isStarting, setIsStarting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [isLoadingLeads, setIsLoadingLeads] = useState(false);
  const [isClearingLeads, setIsClearingLeads] = useState(false);
  const [isClearingAllTabs, setIsClearingAllTabs] = useState(false);
  const [isFindingPublicDecisionMakers, setIsFindingPublicDecisionMakers] =
    useState(false);
  const [finderProgress, setFinderProgress] = useState<{
    processed: number;
    total: number;
    found: number;
  }>({ processed: 0, total: 0, found: 0 });
  const [error, setError] = useState<string | null>(null);
  const activeJobId = activeJobIds[0] ?? null;

  function rememberActiveJobs(
    jobIds: string[],
    statuses: ScrapeStatus[],
    pending = pendingScrapeKeywords,
  ) {
    const payload: ActiveScrapeQueue = { jobIds, statuses, pending };
    localStorage.setItem(ACTIVE_SCRAPE_STORAGE_KEY, JSON.stringify(payload));
  }

  function forgetActiveJob() {
    localStorage.removeItem(ACTIVE_SCRAPE_STORAGE_KEY);
  }

  function chunkIds(ids: string[], size: number) {
    const chunks: string[][] = [];

    for (let index = 0; index < ids.length; index += size) {
      chunks.push(ids.slice(index, index + size));
    }

    return chunks;
  }

  const leadStats = useMemo(() => {
    const withWebsite = leads.filter((lead) => Boolean(lead.website)).length;
    const withPhone = leads.filter((lead) => Boolean(lead.phone)).length;
    const withEmail = leads.filter((lead) => Boolean(lead.email)).length;

    return {
      total: leads.length,
      withWebsite,
      withPhone,
      withEmail,
    };
  }, [leads]);

  const selectedBatch = useMemo(
    () => batches.find((batch) => batch.id === selectedBatchId) ?? null,
    [batches, selectedBatchId],
  );

  const fetchBatches = useCallback(async () => {
    const nextBatches = await getJson<ScrapeBatch[]>("/scrape/batches");
    setBatches(nextBatches);
    setSelectedBatchId((current) => {
      if (current && nextBatches.some((batch) => batch.id === current)) {
        return current;
      }

      return nextBatches[0]?.id ?? "";
    });
    return nextBatches;
  }, []);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    try {
      const savedStatus = localStorage.getItem(ACTIVE_SCRAPE_STORAGE_KEY);

      timeout = setTimeout(() => {
        if (savedStatus) {
          const restored = JSON.parse(savedStatus) as
            | ActiveScrapeQueue
            | ScrapeStatus;
          const restoredJobIds =
            "jobIds" in restored
              ? restored.jobIds
              : restored.jobId
                ? [restored.jobId]
                : [];
          const restoredStatus =
            "jobIds" in restored ? restored.status : restored;
          const restoredStatuses =
            "jobIds" in restored
              ? (restored.statuses ?? (restored.status ? [restored.status] : []))
              : restored
                ? [restored]
                : [];

          if (
            restoredJobIds.length &&
            restoredStatuses.some(
              (item) => !["completed", "failed", "not_found"].includes(item.status),
            )
          ) {
            setStatus(restoredStatus ?? restoredStatuses[0] ?? null);
            setScrapeStatuses(restoredStatuses);
            setActiveJobIds(restoredJobIds);
            if ("jobIds" in restored) {
              setPendingScrapeKeywords(restored.pending ?? []);
            }
          } else {
            forgetActiveJob();
          }
        }
      }, 0);
    } catch {
      timeout = setTimeout(() => undefined, 0);
    }

    return () => clearTimeout(timeout);
  }, []);

  const fetchLeads = useCallback(async () => {
    setIsLoadingLeads(true);

    try {
      const params = new URLSearchParams();

      if (search.trim()) {
        params.set("search", search.trim());
      }

      if (ratingLt.trim()) {
        params.set("ratingLt", ratingLt.trim());
      }

      if (hasWebsite !== "all") {
        params.set("hasWebsite", hasWebsite);
      }

      if (selectedBatchId) {
        setLeads(
          await getJson<Lead[]>(
            `/scrape/batches/${encodeURIComponent(selectedBatchId)}/leads${
              params.size ? `?${params.toString()}` : ""
            }`,
          ),
        );
        return;
      }

      setLeads([]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load leads");
    } finally {
      setIsLoadingLeads(false);
    }
  }, [hasWebsite, ratingLt, search, selectedBatchId]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      void fetchBatches();
    }, 0);

    return () => clearTimeout(timeout);
  }, [fetchBatches]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      void fetchLeads();
    }, 0);

    return () => clearTimeout(timeout);
  }, [fetchLeads]);

  function parseKeywordList(value: string) {
    return Array.from(
      new Set(
        value
          .split(",")
          .map((item) => item.trim())
          .filter((item) => item.length >= 2),
      ),
    ).slice(0, 20);
  }

  function pendingToStatus(pending: PendingScrapeKeyword): ScrapeStatus {
    return {
      jobId: pending.placeholderId,
      keyword: pending.keyword,
      maxRecords: pending.maxRecords,
      findDecisionMakers: pending.findDecisionMakers,
      status: "queued",
      progress: {
        percent: 0,
        phase: "Waiting for previous keyword to finish",
        totalListings: pending.maxRecords,
        processedListings: 0,
        discoveredLeads: 0,
        savedLeads: 0,
      },
    };
  }

  async function enqueueSingleKeyword(input: PendingScrapeKeyword) {
    const queued = await postJson<
      ScrapeQueueResponse,
      {
        keyword: string;
        maxRecords: number;
        findDecisionMakers: boolean;
      }
    >("/scrape", {
      keyword: input.keyword,
      maxRecords: input.maxRecords,
      findDecisionMakers: input.findDecisionMakers,
    });
    const queuedJob = queued.jobs.find((job) => Boolean(job.jobId));

    if (!queuedJob?.jobId) {
      throw new Error(`Could not queue scrape for "${input.keyword}".`);
    }

    return queuedJob;
  }

  useEffect(() => {
    if (!activeJobIds.length) {
      return;
    }

    let cancelled = false;
    let timeout: ReturnType<typeof setTimeout>;

    const poll = async () => {
      try {
        const nextStatuses = await Promise.all(
          activeJobIds.map((jobId) => getJson<ScrapeStatus>(`/scrape/${jobId}`)),
        );

        if (cancelled) {
          return;
        }

        const completedOrStoppedStatuses = scrapeStatuses.filter(
          (item) =>
            ["completed", "failed", "not_found"].includes(item.status) &&
            !nextStatuses.some((nextStatus) => nextStatus.jobId === item.jobId),
        );
        const pendingStatuses = pendingScrapeKeywords.map(pendingToStatus);
        const displayStatuses = [
          ...completedOrStoppedStatuses,
          ...nextStatuses,
          ...pendingStatuses,
        ];

        setScrapeStatuses(displayStatuses);
        setStatus(
          nextStatuses.find(
            (nextStatus) =>
              !["completed", "failed", "not_found"].includes(nextStatus.status),
          ) ??
            nextStatuses[0] ??
            null,
        );

        const completedStatuses = nextStatuses.filter(
          (nextStatus) => nextStatus.status === "completed",
        );
        const failedStatus = nextStatuses.find(
          (nextStatus) => nextStatus.status === "failed",
        );
        const activeStatuses = nextStatuses.filter(
          (nextStatus) =>
            !["completed", "failed", "not_found"].includes(nextStatus.status),
        );
        const activeIds = activeStatuses
          .map((nextStatus) => nextStatus.jobId)
          .filter((jobId): jobId is string => Boolean(jobId));

        if (completedStatuses.length) {
          const nextBatches = await fetchBatches();
          const completedBatchId =
            completedStatuses[completedStatuses.length - 1]?.result?.batchId;
          if (
            completedBatchId &&
            nextBatches.some((batch) => batch.id === completedBatchId)
          ) {
            setSelectedBatchId(completedBatchId);
          }
          await fetchLeads();

          const completedDownloads = completedStatuses.filter(
            (nextStatus) =>
              nextStatus.jobId &&
              nextStatus.result?.leads?.length &&
              !autoDownloadedJobIds.includes(nextStatus.jobId),
          );

          for (const nextStatus of completedDownloads) {
            downloadCsv(
              nextStatus.result!.leads,
              `${nextStatus.result!.keyword.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-leads.csv`,
            );
          }

          if (completedDownloads.length) {
            setAutoDownloadedJobIds((current) => [
              ...current,
              ...completedDownloads
                .map((nextStatus) => nextStatus.jobId)
                .filter((jobId): jobId is string => Boolean(jobId)),
            ]);
          }
        }

        if (failedStatus) {
          setError(failedStatus.failedReason ?? "Scrape failed");
        }

        if (!activeIds.length && !failedStatus && pendingScrapeKeywords.length) {
          const [nextPending, ...remainingPending] = pendingScrapeKeywords;
          const queuedJob = await enqueueSingleKeyword(nextPending);
          const nextDisplayStatuses = [
            ...displayStatuses.filter(
              (item) => item.jobId !== nextPending.placeholderId,
            ),
            queuedJob,
            ...remainingPending.map(pendingToStatus),
          ];

          setPendingScrapeKeywords(remainingPending);
          setScrapeStatuses(nextDisplayStatuses);
          setStatus(queuedJob);
          setActiveJobIds([queuedJob.jobId]);
          rememberActiveJobs([queuedJob.jobId], nextDisplayStatuses, remainingPending);
          timeout = setTimeout(poll, 3000);
          return;
        }

        if (!activeIds.length) {
          setActiveJobIds([]);
          setPendingScrapeKeywords([]);
          forgetActiveJob();
          return;
        }

        setActiveJobIds(activeIds);
        rememberActiveJobs(activeIds, displayStatuses, pendingScrapeKeywords);

        timeout = setTimeout(poll, 3000);
      } catch (caught) {
        if (!cancelled) {
          setError(
            caught instanceof Error ? caught.message : "Could not read scrape status",
          );
          timeout = setTimeout(poll, 5000);
        }
      }
    };

    void poll();

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [
    activeJobIds,
    autoDownloadedJobIds,
    fetchBatches,
    fetchLeads,
    pendingScrapeKeywords,
    scrapeStatuses,
  ]);

  async function startSequentialScrape(
    keywordValue: string,
    maxRecordsValue: string,
    shouldFindDecisionMakers: boolean,
  ) {
    if (keywordValue.trim().length < 2) {
      setError("Enter at least two characters for the search keyword.");
      return;
    }

    const parsedMaxRecords = Number(maxRecordsValue);
    if (
      !Number.isInteger(parsedMaxRecords) ||
      parsedMaxRecords < 1 ||
      parsedMaxRecords > 500
    ) {
      setError("Records to scrape must be a whole number from 1 to 500.");
      return;
    }

    setError(null);
    setIsStarting(true);
    setStatus(null);
    setScrapeStatuses([]);
    setPendingScrapeKeywords([]);

    try {
      const keywordList = parseKeywordList(keywordValue);

      if (!keywordList.length) {
        throw new Error("Enter at least one search keyword.");
      }

      const pendingKeywords = keywordList.map((searchKeyword, index) => ({
        keyword: searchKeyword,
        maxRecords: parsedMaxRecords,
        findDecisionMakers: shouldFindDecisionMakers,
        placeholderId: `pending-${Date.now()}-${index}`,
      }));
      const [firstKeyword, ...remainingKeywords] = pendingKeywords;
      const firstJob = await enqueueSingleKeyword(firstKeyword);

      if (!firstJob.jobId) {
        throw new Error("Could not queue scrape jobs.");
      }

      const nextStatuses = [
        firstJob,
        ...remainingKeywords.map(pendingToStatus),
      ];

      setStatus(firstJob);
      setScrapeStatuses(nextStatuses);
      setPendingScrapeKeywords(remainingKeywords);
      setActiveJobIds([firstJob.jobId]);
      rememberActiveJobs([firstJob.jobId], nextStatuses, remainingKeywords);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not start scrape");
    } finally {
      setIsStarting(false);
    }
  }

  async function startScrape(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await startSequentialScrape(keyword, maxRecords, findDecisionMakers);
  }

  async function startFinderScrape(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await startSequentialScrape(finderKeyword, finderMaxRecords, true);
  }

  async function stopScrape() {
    if (!activeJobIds.length) return;

    setIsStopping(true);

    try {
      await Promise.allSettled(
        activeJobIds.map((jobId) => deleteJson(`/scrape/${jobId}`)),
      );
      setActiveJobIds([]);
      setStatus(null);
      setScrapeStatuses([]);
      setPendingScrapeKeywords([]);
      forgetActiveJob();
      window.setTimeout(() => {
        void fetchBatches().then(() => fetchLeads());
      }, 3500);
    } catch {
      // silently clear — job may already be gone
      setActiveJobIds([]);
      setStatus(null);
      setScrapeStatuses([]);
      setPendingScrapeKeywords([]);
      forgetActiveJob();
    } finally {
      setIsStopping(false);
    }
  }

  function downloadLeads() {
    if (!leads.length) return;
    downloadCsv(leads, "gmb-leads.csv");
  }

  async function deleteLead(id: string) {
    if (!selectedBatchId) return;
    setError(null);

    try {
      await deleteJson(
        `/scrape/batches/${encodeURIComponent(selectedBatchId)}/leads/${encodeURIComponent(id)}`,
      );
      setLeads((current) => current.filter((lead) => lead.id !== id));
      void fetchBatches();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not remove lead from this scrape tab",
      );
    }
  }

  async function clearLeads() {
    if (!selectedBatchId || !leads.length || isClearingLeads) return;

    const confirmed = window.confirm(
      selectedBatch
        ? `Clear the "${selectedBatch.keyword}" scraper tab? Contacts will remain saved.`
        : `Clear these scraper results? Contacts will remain saved.`,
    );

    if (!confirmed) return;

    setError(null);
    setIsClearingLeads(true);

    try {
      if (selectedBatchId) {
        await deleteJson(
          `/scrape/batches/${encodeURIComponent(selectedBatchId)}`,
        );
      }
      const nextBatches = await fetchBatches();
      setSelectedBatchId(nextBatches[0]?.id ?? "");
      setLeads([]);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not clear scraper results",
      );
    } finally {
      setIsClearingLeads(false);
    }
  }

  async function clearAllTabs() {
    if (!batches.length || isClearingAllTabs) return;

    const confirmed = window.confirm(
      `Clear all ${batches.length} scraper tab(s)? Contacts will remain saved.`,
    );

    if (!confirmed) return;

    setError(null);
    setIsClearingAllTabs(true);

    try {
      await Promise.all(
        batches.map((batch) =>
          deleteJson(`/scrape/batches/${encodeURIComponent(batch.id)}`),
        ),
      );
      setBatches([]);
      setSelectedBatchId("");
      setLeads([]);
      await fetchBatches();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not clear all scraper tabs",
      );
    } finally {
      setIsClearingAllTabs(false);
    }
  }

  async function runPublicDecisionMakerFinder() {
    const leadIds = leads
      .map((lead) => lead.id)
      .filter((id): id is string => Boolean(id));

    if (!leadIds.length || isFindingPublicDecisionMakers) return;

    setError(null);
    setIsFindingPublicDecisionMakers(true);
    setFinderProgress({ processed: 0, total: leadIds.length, found: 0 });

    try {
      let processed = 0;
      let found = 0;

      for (const chunk of chunkIds(leadIds, DECISION_FINDER_BATCH_SIZE)) {
        const response = await enrichDecisionMakers(chunk);
        processed += response.processed;
        found += response.found;
        setFinderProgress({ processed, total: leadIds.length, found });
      }

      await fetchLeads();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not find public decision makers.",
      );
    } finally {
      setIsFindingPublicDecisionMakers(false);
    }
  }

  return (
    <AppShell onRefresh={() => void fetchLeads()} refreshing={isLoadingLeads} contentClassName="max-w-7xl">
      <PageHeader
        title="Lead Scraper"
        description="Find Google Maps businesses and save them into the same lead database used for WhatsApp outreach."
      />
      <div className="flex flex-wrap gap-2">
        {[
          { id: "scraper", label: "Business scraper" },
          { id: "finder", label: "Public decision maker finder" },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTool(tab.id as "scraper" | "finder")}
            className={`rounded-lg border px-4 py-2 text-sm font-semibold transition ${
              activeTool === tab.id
                ? "border-[#164c3b] bg-[#164c3b] text-white"
                : "border-[#cbd5ca] bg-white text-[#405149] hover:bg-[#eef2ea]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {activeTool === "scraper" ? (
      <section className="space-y-6">
        <div className="flex flex-col gap-6">
          <DashboardHero {...leadStats} />
          <ScrapeControl
            activeJobId={activeJobId}
            error={error}
            hasLeads={leads.length > 0}
            isStarting={isStarting}
            isStopping={isStopping}
            keyword={keyword}
            findDecisionMakers={findDecisionMakers}
            maxRecords={maxRecords}
            onDownload={downloadLeads}
            onFindDecisionMakersChange={setFindDecisionMakers}
            onKeywordChange={setKeyword}
            onMaxRecordsChange={setMaxRecords}
            onStartScrape={startScrape}
            onStopScrape={() => void stopScrape()}
            status={status}
            statuses={scrapeStatuses}
          />
        </div>
      </section>
      ) : (
        <PublicDecisionMakerFinderPanel
          activeJobId={activeJobId}
          keyword={finderKeyword}
          maxRecords={finderMaxRecords}
          selectedBatchName={selectedBatch?.keyword ?? null}
          statuses={scrapeStatuses}
          leads={leads}
          isStarting={isStarting}
          isStopping={isStopping}
          isFinding={isFindingPublicDecisionMakers}
          isLoading={isLoadingLeads}
          progress={finderProgress}
          onKeywordChange={setFinderKeyword}
          onMaxRecordsChange={setFinderMaxRecords}
          onRefresh={() => void fetchLeads()}
          onRun={() => void runPublicDecisionMakerFinder()}
          onStartScrape={(event) => void startFinderScrape(event)}
          onStopScrape={() => void stopScrape()}
        />
      )}
      {activeTool === "scraper" ? (
      <section className="flex flex-col gap-4">
        <LeadFilters
          batches={batches}
          hasWebsite={hasWebsite}
          leads={leads}
          ratingLt={ratingLt}
          search={search}
          selectedBatchId={selectedBatchId}
          isClearingAllTabs={isClearingAllTabs}
          onClearAllTabs={() => void clearAllTabs()}
          onHasWebsiteChange={setHasWebsite}
          onRatingLtChange={setRatingLt}
          onRefresh={() => void fetchLeads()}
          onSearchChange={setSearch}
          onSelectedBatchChange={setSelectedBatchId}
        />
        <LeadsTable
          isClearing={isClearingLeads}
          isLoading={isLoadingLeads}
          leads={leads}
          selectedBatchName={selectedBatch?.keyword ?? null}
          onClearLeads={() => void clearLeads()}
          onDeleteLead={(id) => void deleteLead(id)}
        />
      </section>
      ) : null}
    </AppShell>
  );
}

function PublicDecisionMakerFinderPanel({
  activeJobId,
  keyword,
  maxRecords,
  selectedBatchName,
  statuses,
  leads,
  isStarting,
  isStopping,
  isFinding,
  isLoading,
  progress,
  onKeywordChange,
  onMaxRecordsChange,
  onRefresh,
  onRun,
  onStartScrape,
  onStopScrape,
}: {
  activeJobId: string | null;
  keyword: string;
  maxRecords: string;
  selectedBatchName: string | null;
  statuses: ScrapeStatus[];
  leads: Lead[];
  isStarting: boolean;
  isStopping: boolean;
  isFinding: boolean;
  isLoading: boolean;
  progress: { processed: number; total: number; found: number };
  onKeywordChange: (keyword: string) => void;
  onMaxRecordsChange: (maxRecords: string) => void;
  onRefresh: () => void;
  onRun: () => void;
  onStartScrape: (event: FormEvent<HTMLFormElement>) => void;
  onStopScrape: () => void;
}) {
  const isScraping = isStarting || Boolean(activeJobId);
  const leadsWithWebsites = leads.filter((lead) => Boolean(lead.website)).length;
  const leadsWithDecisionMakers = leads.filter((lead) =>
    Boolean(lead.bestDecisionMaker),
  ).length;
  const progressPercent = progress.total
    ? Math.round((progress.processed / progress.total) * 100)
    : 0;

  return (
    <section className="space-y-4">
      <div className="rounded-lg border border-[#d8ddd4] bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-4">
          <form
            onSubmit={onStartScrape}
            className="grid gap-3 lg:grid-cols-[1fr_180px_auto]"
          >
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-[#405149]">
                Keyword
              </span>
              <input
                value={keyword}
                onChange={(event) => onKeywordChange(event.target.value)}
                className="h-11 rounded-lg border border-[#cad1c6] px-3 outline-none transition focus:border-[#256b55] focus:ring-4 focus:ring-[#256b55]/10"
                placeholder="gym london uk, fitness center london uk"
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-[#405149]">
                Records
              </span>
              <input
                type="number"
                min={1}
                max={500}
                value={maxRecords}
                onChange={(event) => onMaxRecordsChange(event.target.value)}
                className="h-11 rounded-lg border border-[#cad1c6] px-3 outline-none transition focus:border-[#256b55] focus:ring-4 focus:ring-[#256b55]/10"
                placeholder="120"
              />
            </label>
            <div className="flex items-end gap-2">
              <button
                type="submit"
                disabled={isScraping}
                className="h-11 rounded-lg bg-[#164c3b] px-4 font-semibold text-white transition hover:bg-[#0f3d2e] disabled:cursor-not-allowed disabled:bg-[#91a197]"
              >
                {isScraping ? "Scraping..." : "Start finder scrape"}
              </button>
              {isScraping ? (
                <button
                  type="button"
                  onClick={onStopScrape}
                  disabled={isStopping}
                  className="h-11 rounded-lg border border-[#c0392b] bg-white px-4 font-semibold text-[#c0392b] transition hover:bg-[#fff2f0] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isStopping ? "Stopping..." : "Stop"}
                </button>
              ) : null}
              <button
                type="button"
                onClick={onRun}
                disabled={!leads.length || isFinding || isScraping}
                className="h-11 rounded-lg border border-[#256b55] bg-white px-4 font-semibold text-[#256b55] transition hover:bg-[#f0faf5] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isFinding ? "Finding..." : "Run on shown leads"}
              </button>
            </div>
          </form>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <button
              type="button"
              onClick={onRefresh}
              className="h-10 rounded-lg border border-[#b8c3b7] px-4 text-sm font-semibold text-[#24372f] transition hover:bg-[#eef2ea]"
            >
              Refresh results
            </button>
            <div className="grid gap-3 text-sm sm:grid-cols-3">
              <FinderStat label="Leads" value={leads.length} />
              <FinderStat label="Websites" value={leadsWithWebsites} />
              <FinderStat label="Found" value={leadsWithDecisionMakers} />
            </div>
          </div>
        </div>
        {statuses.length ? (
          <div className="mt-4 space-y-3">
            {statuses.map((item, index) => (
              <FinderScrapeProgress
                key={item.jobId ?? `${item.keyword ?? "finder"}-${index}`}
                status={item}
              />
            ))}
          </div>
        ) : null}
        {isFinding ? (
          <div className="mt-4">
            <div className="flex justify-between text-sm text-[#5e6c64]">
              <span>{selectedBatchName ?? "Selected tab"}</span>
              <span>
                {progress.processed}/{progress.total} checked · {progress.found} found
              </span>
            </div>
            <div className="mt-2 h-3 overflow-hidden rounded-full bg-[#e5e9e1]">
              <div
                className="h-full rounded-full bg-[#2f8065] transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-lg border border-[#d8ddd4] bg-white shadow-sm">
        <div className="flex flex-col gap-1 border-b border-[#e1e5dd] px-4 py-3">
          <h2 className="text-lg font-semibold">
            {selectedBatchName ?? "Public decision maker finder"}
          </h2>
          <p className="text-xs text-[#66746c]">
            Website results and manual public search links.
          </p>
        </div>
        <div className="divide-y divide-[#edf0ea]">
          {isLoading ? (
            <p className="px-4 py-10 text-center text-[#66746c]">Loading...</p>
          ) : leads.length ? (
            leads.map((lead) => (
              <PublicDecisionMakerLeadRow key={lead.id ?? lead.name} lead={lead} />
            ))
          ) : (
            <p className="px-4 py-10 text-center text-[#66746c]">
              No leads in this scraper tab.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

function FinderStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-[#e1e5dd] bg-[#fbfcf9] px-3 py-2">
      <p className="text-xs font-medium uppercase text-[#66746c]">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}

function FinderScrapeProgress({ status }: { status: ScrapeStatus }) {
  const value =
    typeof status.progress === "number"
      ? status.progress
      : status.progress?.percent ?? (status.status === "completed" ? 100 : 0);
  const progress = Math.min(Math.max(value, 0), 100);
  const details = typeof status.progress === "object" ? status.progress : null;
  const label =
    status.status === "active"
      ? "Scraping"
      : status.status === "waiting"
        ? "Queued"
        : status.status === "completed"
          ? "Completed"
          : status.status;

  return (
    <div className="rounded-lg border border-[#e1e5dd] bg-[#fbfcf9] p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-[#14211b]">
            {status.keyword ?? "Finder scrape"}
          </p>
          <p className="mt-0.5 text-xs text-[#66746c]">
            {label}
            {details?.phase ? ` · ${details.phase}` : ""}
          </p>
        </div>
        <p className="text-xs text-[#5e6c64] sm:text-right">
          {progress}% complete
          {details?.totalListings !== undefined
            ? ` · ${details.processedListings ?? 0}/${details.totalListings} records`
            : ""}
        </p>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#e5e9e1]">
        <div
          className="h-full rounded-full bg-[#2f8065] transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>
      {status.result?.decisionMakers ? (
        <p className="mt-2 text-xs text-[#5e6c64]">
          Decision makers {status.result.decisionMakers.found}/
          {status.result.decisionMakers.processed}
        </p>
      ) : null}
    </div>
  );
}

function PublicDecisionMakerLeadRow({ lead }: { lead: Lead }) {
  const links = buildPublicSearchLinks(lead);

  return (
    <div className="grid gap-4 px-4 py-4 lg:grid-cols-[minmax(220px,1fr)_minmax(240px,1fr)_minmax(260px,1fr)]">
      <div>
        <p className="font-semibold text-[#14211b]">{lead.name}</p>
        <p className="mt-1 text-sm text-[#66746c]">
          {lead.category ?? "No category"}
        </p>
        {lead.website ? (
          <a
            href={lead.website}
            target="_blank"
            rel="noreferrer"
            className="mt-1 block max-w-[300px] truncate text-sm text-[#1d6f56] underline-offset-4 hover:underline"
          >
            {lead.website}
          </a>
        ) : (
          <p className="mt-1 text-sm text-[#66746c]">No website</p>
        )}
      </div>
      <div>
        {lead.bestDecisionMaker ? (
          <div className="rounded-lg border border-[#d7eadf] bg-[#f3fbf6] px-3 py-2">
            <p className="font-semibold text-[#164c3b]">
              {lead.bestDecisionMaker.name ?? "Decision maker"}
            </p>
            <p className="mt-0.5 text-sm text-[#405149]">
              {lead.bestDecisionMaker.title ?? "Best contact"}
            </p>
            {lead.bestDecisionMaker.email ? (
              <a
                href={`mailto:${lead.bestDecisionMaker.email}`}
                className="mt-1 block truncate text-sm text-[#1d6f56] underline-offset-4 hover:underline"
              >
                {lead.bestDecisionMaker.email}
              </a>
            ) : null}
            <p className="mt-1 text-xs text-[#66746c]">
              Confidence {lead.bestDecisionMaker.confidence}
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-[#e1e5dd] bg-[#fbfcf9] px-3 py-2 text-sm text-[#66746c]">
            No website decision maker found yet.
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-start gap-2">
        {links.map((link) => (
          <a
            key={link.label}
            href={link.href}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-[#cbd5ca] bg-white px-3 py-2 text-xs font-semibold text-[#405149] transition hover:bg-[#eef2ea]"
          >
            {link.label}
          </a>
        ))}
      </div>
    </div>
  );
}

function buildPublicSearchLinks(lead: Lead) {
  const location =
    lead.address
      ?.split(",")
      .map((part) => part.trim())
      .filter(Boolean)
      .slice(-2)
      .join(" ") ?? "";
  const business = lead.name;
  const searches = [
    {
      label: "LinkedIn founder",
      query: `site:linkedin.com/in "${business}" "founder" ${location}`,
    },
    {
      label: "LinkedIn director",
      query: `site:linkedin.com/in "${business}" "director" ${location}`,
    },
    {
      label: "LinkedIn manager",
      query: `site:linkedin.com/in "${business}" "manager" ${location}`,
    },
    {
      label: "Team page",
      query: `"${business}" "team" ${location}`,
    },
    {
      label: "Owner search",
      query: `"${business}" "owner" ${location}`,
    },
  ];

  return searches.map((search) => ({
    label: search.label,
    href: `https://www.google.com/search?q=${encodeURIComponent(search.query)}`,
  }));
}
