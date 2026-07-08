"use client";

import { useMemo, useState } from "react";
import {
  Check,
  CircleOff,
  MoreHorizontal,
  Search,
  UsersRound,
} from "lucide-react";
import type { LeadRecord } from "@/lib/backend";
import { getWarmUpLabel } from "./WahaContactPicker";

type LeadsTableProps = {
  leads: LeadRecord[];
};

function formatRelativeDate(value: string) {
  const date = new Date(value);
  const diff = Date.now() - date.getTime();
  const hours = Math.max(1, Math.round(diff / 3600000));

  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.round(hours / 24);
  if (days < 7) {
    return `${days}d ago`;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date);
}

function getInitials(name?: string | null) {
  if (!name) {
    return "NA";
  }

  return name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function getStatusTone(status: string) {
  const value = status.toLowerCase();

  if (value.includes("interested") || value.includes("hot")) {
    return "bg-rose-100 text-rose-600";
  }

  if (value.includes("closed")) {
    return "bg-slate-100 text-slate-600";
  }

  if (value.includes("warm")) {
    return "bg-amber-100 text-amber-700";
  }

  return "bg-sky-100 text-sky-700";
}

function getQualityTone(score = 0) {
  if (score >= 75) return "bg-emerald-100 text-emerald-700";
  if (score >= 50) return "bg-amber-100 text-amber-700";
  return "bg-red-100 text-red-700";
}

function getEmailTrackingLabel(lead: LeadRecord) {
  if (lead.emailDeliveryStatus === "REPLIED") return "Replied";
  if (lead.emailDeliveryStatus === "BOUNCED") return "Bounced";
  if (lead.emailDeliveryStatus === "SENT") return "Sent";
  return lead.email ? "Not sent" : "No email";
}

function getEmailTrackingTone(lead: LeadRecord) {
  if (lead.emailDeliveryStatus === "REPLIED") return "bg-emerald-100 text-emerald-700";
  if (lead.emailDeliveryStatus === "BOUNCED") return "bg-red-100 text-red-700";
  if (lead.emailDeliveryStatus === "SENT") return "bg-sky-100 text-sky-700";
  return "bg-slate-100 text-slate-500";
}

const tagTones = [
  "bg-emerald-100 text-emerald-700",
  "bg-sky-100 text-sky-700",
  "bg-amber-100 text-amber-700",
  "bg-teal-100 text-teal-700",
];

export default function LeadsTable({ leads }: LeadsTableProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "ALL" | "OPTED_IN" | "NEW" | "ENGAGED"
  >("ALL");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      const matchesSearch =
        search.trim().length === 0 ||
        (lead.name ?? "").toLowerCase().includes(search.toLowerCase()) ||
        lead.phone.includes(search.trim()) ||
        (lead.email ?? "").toLowerCase().includes(search.toLowerCase());

      const matchesFilter =
        statusFilter === "ALL" ||
        (statusFilter === "OPTED_IN" && lead.optIn) ||
        (statusFilter === "NEW" && lead.status.toLowerCase() === "new") ||
        (statusFilter === "ENGAGED" &&
          (lead.warmUpStatus === "ENGAGED" || lead.hasIncoming));

      return matchesSearch && matchesFilter;
    });
  }, [leads, search, statusFilter]);

  const selectedCount = selectedIds.filter((id) =>
    filteredLeads.some((lead) => lead.id === id),
  ).length;

  const allSelected =
    filteredLeads.length > 0 && selectedCount === filteredLeads.length;

  const toggleLead = (leadId: string) => {
    setSelectedIds((current) =>
      current.includes(leadId)
        ? current.filter((id) => id !== leadId)
        : [...current, leadId],
    );
  };

  const toggleAll = () => {
    setSelectedIds((current) =>
      allSelected
        ? current.filter(
            (id) => !filteredLeads.some((lead) => lead.id === id),
          )
        : Array.from(new Set([...current, ...filteredLeads.map((lead) => lead.id)])),
    );
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 bg-white px-4 py-3 sm:px-5">
        <label className="relative block min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name, phone, email, or tag"
            className="input bg-neutral-50 pl-9"
          />
        </label>

        <div className="segmented">
          {(["ALL", "OPTED_IN", "NEW", "ENGAGED"] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setStatusFilter(item)}
              className={`segmented-btn ${statusFilter === item ? "active" : ""}`}
            >
              {item === "ALL"
                ? "All"
                : item === "OPTED_IN"
                  ? "Opted in"
                  : item === "NEW"
                    ? "New"
                    : "Engaged"}
            </button>
          ))}
        </div>
      </div>

      {selectedCount > 0 ? (
        <div className="border-b border-emerald-100 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-800 sm:px-5">
          {selectedCount} selected for action
        </div>
      ) : null}

      {filteredLeads.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr>
                <th className="px-4 py-3 sm:px-5">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                </th>
                <th className="px-3 py-3 text-left">
                  Contact
                </th>
                <th className="px-3 py-3 text-left">
                  Phone
                </th>
                <th className="px-3 py-3 text-left">
                  Status
                </th>
                <th className="px-3 py-3 text-left">
                  Quality
                </th>
                <th className="px-3 py-3 text-left">
                  Email
                </th>
                <th className="px-3 py-3 text-left">
                  Warm-up
                </th>
                <th className="px-3 py-3 text-left">
                  Tags
                </th>
                <th className="px-3 py-3 text-left">
                  Consent
                </th>
                <th className="px-3 py-3 text-left">
                  Added
                </th>
                <th className="px-3 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {filteredLeads.map((lead) => (
                <tr
                  key={lead.id}
                  className={`transition ${
                    selectedIds.includes(lead.id) ? "bg-emerald-50/70" : "bg-white"
                  }`}
                >
                  <td className="px-4 py-3 sm:px-5">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(lead.id)}
                      onChange={() => toggleLead(lead.id)}
                      className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-emerald-600 text-xs font-bold text-white">
                        {getInitials(lead.name)}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900">
                          {lead.name ?? "Unnamed lead"}
                        </p>
                        <p className="truncate text-xs text-slate-500">
                          {lead.email ?? "No email attached"}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-sm font-semibold text-slate-600">
                    {lead.phone}
                  </td>
                  <td className="px-3 py-3">
                    <span
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold ${getStatusTone(lead.status)}`}
                    >
                      {lead.status}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <span
                      title={(lead.qualityReasons ?? []).join(", ")}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold ${getQualityTone(lead.qualityScore)}`}
                    >
                      {lead.qualityScore ?? 0}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <span
                      title={lead.emailLastError ?? undefined}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold ${getEmailTrackingTone(lead)}`}
                    >
                      {getEmailTrackingLabel(lead)}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-xs font-semibold text-slate-600">
                    {getWarmUpLabel(lead)}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-2">
                      {lead.tags.length > 0 ? (
                        lead.tags.map((tag, index) => (
                          <span
                            key={`${lead.id}-${tag}`}
                            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${tagTones[index % tagTones.length]}`}
                          >
                            {tag}
                          </span>
                        ))
                      ) : (
                        <span className="badge badge-neutral">
                          No tags
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <span
                      className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${
                        lead.optIn
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {lead.optIn ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : (
                        <CircleOff className="h-3.5 w-3.5" />
                      )}
                      {lead.optIn ? "Opted in" : "No consent"}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-sm text-slate-500">
                    {formatRelativeDate(lead.createdAt)}
                  </td>
                  <td className="px-3 py-3">
                    <button className="rounded-md p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600" aria-label="Lead actions">
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="px-4 py-12 text-center sm:px-5">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-neutral-100">
            <UsersRound className="h-5 w-5 text-neutral-400" />
          </div>
          <h3 className="mt-4 text-base font-medium text-neutral-900">
            No leads found
          </h3>
          <p className="mx-auto mt-1 max-w-sm text-sm text-neutral-500">
            Add contacts or import a CSV to get started.
          </p>
        </div>
      )}
    </div>
  );
}
