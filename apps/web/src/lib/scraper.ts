export type Lead = {
  id?: string;
  userId?: string;
  name: string;
  category?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  bestDecisionMaker?: {
    id: string;
    name: string | null;
    title: string | null;
    email: string | null;
    emailType: string;
    confidence: number;
    sourceUrl: string | null;
  } | null;
  preferredEmail?: string | null;
  preferredEmailType?: string | null;
  rating?: number | null;
  reviewsCount?: number | null;
  optIn?: boolean;
  warmUpStatus?: "PENDING" | "LINK_SENT" | "ENGAGED" | "BLOCKED";
  source?: "MANUAL" | "CSV" | "GOOGLE_MAPS";
  sourceKeyword?: string | null;
  createdAt?: string;
};

export type ScrapeBatch = {
  id: string;
  userId: string;
  keyword: string;
  maxRecords?: number | null;
  discovered: number;
  saved: number;
  leadCount: number;
  createdAt: string;
  updatedAt: string;
};

export type ScrapeStatus = {
  jobId: string;
  keyword?: string;
  maxRecords?: number;
  findDecisionMakers?: boolean;
  progress?: number | ScrapeProgress;
  status: string;
  failedReason?: string;
  result?: {
    batchId?: string;
    keyword: string;
    discovered: number;
    saved: number;
    leads: Lead[];
    decisionMakers?: {
      processed: number;
      found: number;
    };
  };
};

export type ScrapeQueueResponse = {
  jobs: ScrapeStatus[];
  keyword: string;
  maxRecords?: number;
  findDecisionMakers?: boolean;
  status: string;
  totalJobs: number;
};

export type ScrapeProgress = {
  percent: number;
  phase: string;
  totalListings?: number;
  processedListings?: number;
  discoveredLeads?: number;
  savedLeads?: number;
};

export const statusLabels: Record<string, string> = {
  completed: "Completed",
  failed: "Failed",
  active: "Scraping",
  waiting: "Queued",
  delayed: "Queued",
  prioritized: "Queued",
  paused: "Paused",
  queued: "Queued",
  not_found: "Not found",
};

export function getProgressValue(progress: ScrapeStatus["progress"]) {
  const value = typeof progress === "number" ? progress : progress?.percent;

  return typeof value === "number" ? Math.min(Math.max(value, 0), 100) : 0;
}

export function getProgressDetails(status: ScrapeStatus | null) {
  if (!status) {
    return null;
  }

  if (typeof status.progress === "object") {
    return status.progress;
  }

  if (status.result) {
    return {
      percent: 100,
      phase: "Completed",
      totalListings: status.result.discovered,
      processedListings: status.result.discovered,
      discoveredLeads: status.result.discovered,
      savedLeads: status.result.saved,
    };
  }

  return null;
}

function csvCell(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }

  const text = String(value);

  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

export function downloadCsv(leads: Lead[], filename = "gmb-leads.csv") {
  const headers = [
    "Name",
    "Category",
    "Address",
    "Phone",
    "Email",
    "Decision Maker",
    "Decision Maker Title",
    "Preferred Email",
    "Website",
    "Rating",
    "Reviews",
    "Created At",
  ];
  const rows = leads.map((lead) => [
    lead.name,
    lead.category,
    lead.address,
    lead.phone,
    lead.email,
    lead.bestDecisionMaker?.name,
    lead.bestDecisionMaker?.title,
    lead.preferredEmail ?? lead.email,
    lead.website,
    lead.rating,
    lead.reviewsCount,
    lead.createdAt,
  ]);
  const csv = [headers, ...rows]
    .map((row) => row.map(csvCell).join(","))
    .join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
