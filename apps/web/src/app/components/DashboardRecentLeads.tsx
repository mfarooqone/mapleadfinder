"use client";

import Link from "next/link";
import { ArrowRight, MapPin, Star } from "lucide-react";
import type { LeadRecord } from "@/lib/backend";

type DashboardRecentLeadsProps = {
  leads: LeadRecord[];
  loading?: boolean;
};

export default function DashboardRecentLeads({
  leads,
  loading = false,
}: DashboardRecentLeadsProps) {
  const recent = leads.slice(0, 6);

  return (
    <section className="card card-pad h-full">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="section-label">Recent leads</p>
          <h2 className="mt-1 text-lg font-semibold text-neutral-900">
            Latest from scraper
          </h2>
        </div>
        <Link
          href="/dashboard/leads"
          className="inline-flex items-center gap-1 text-sm font-medium text-emerald-700 hover:text-emerald-800"
        >
          View all
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {loading ? (
        <div className="mt-6 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-lg bg-neutral-100" />
          ))}
        </div>
      ) : recent.length === 0 ? (
        <div className="mt-8 rounded-lg border border-dashed border-neutral-200 bg-neutral-50 px-4 py-10 text-center">
          <MapPin className="mx-auto h-8 w-8 text-neutral-300" />
          <p className="mt-3 text-sm font-medium text-neutral-700">No leads yet</p>
          <p className="mt-1 text-xs text-neutral-500">
            Run a Google Maps scrape to populate your pipeline
          </p>
          <Link href="/dashboard/scraper" className="btn btn-primary mt-4 text-sm">
            Open scraper
          </Link>
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead>
              <tr>
                <th className="pb-2 font-semibold">Business</th>
                <th className="pb-2 font-semibold">Category</th>
                <th className="pb-2 font-semibold">Rating</th>
                <th className="pb-2 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((lead) => (
                <tr
                  key={lead.id}
                  className="last:border-0"
                >
                  <td className="py-3 pr-3">
                    <p className="font-medium text-neutral-900">
                      {lead.name ?? "Unknown"}
                    </p>
                    <p className="truncate text-xs text-neutral-500">
                      {lead.phone || "No phone"}
                    </p>
                  </td>
                  <td className="py-3 text-neutral-600">
                    {lead.category ?? lead.sourceKeyword ?? "—"}
                  </td>
                  <td className="py-3">
                    {lead.rating != null ? (
                      <span className="inline-flex items-center gap-1 text-neutral-700">
                        <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                        {lead.rating}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="py-3">
                    <span
                      className={`badge ${
                        lead.warmUpStatus === "ENGAGED"
                          ? "badge-success"
                          : lead.optIn
                            ? "badge-warning"
                            : "badge-neutral"
                      }`}
                    >
                      {lead.warmUpStatus ?? (lead.optIn ? "Opted in" : "Cold")}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
