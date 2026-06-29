"use client";

import Link from "next/link";
import { RefreshCw, Upload, UserRoundPlus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { LeadRecord } from "@/lib/backend";
import AppShell from "./AppShell";
import LeadsTable from "./Leadstable";
import PageHeader, { PageLink } from "./PageHeader";
import { fetchLeads } from "./dashboard-data";

type BannerState = { type: "success" | "error"; message: string } | null;

export default function LeadsWorkspace() {
  const [leads, setLeads] = useState<LeadRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [banner, setBanner] = useState<BannerState>(null);

  useEffect(() => {
    let active = true;
    const run = async () => {
      try {
        const nextLeads = await fetchLeads();
        if (active) setLeads(nextLeads);
      } catch (error) {
        if (active) {
          setBanner({
            type: "error",
            message: error instanceof Error ? error.message : "Could not load leads.",
          });
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    void run();
    return () => {
      active = false;
    };
  }, []);

  const optedInCount = useMemo(() => leads.filter((l) => l.optIn).length, [leads]);
  const newCount = useMemo(
    () => leads.filter((l) => l.status.toLowerCase() === "new").length,
    [leads],
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    setBanner(null);
    try {
      setLeads(await fetchLeads());
      setBanner({ type: "success", message: "Leads updated." });
    } catch (error) {
      setBanner({
        type: "error",
        message: error instanceof Error ? error.message : "Refresh failed.",
      });
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <AppShell onRefresh={() => void handleRefresh()} refreshing={refreshing}>
      <PageHeader
        title="Leads"
        description="Contacts opted in for WhatsApp outreach."
        actions={
          <>
            <PageLink href="/dashboard/contacts" primary>
              <UserRoundPlus className="h-4 w-4" />
              Contacts
            </PageLink>
            <PageLink href="/dashboard/whatsapp/setup">
              <Upload className="h-4 w-4" />
              Setup
            </PageLink>
          </>
        }
      />

      {banner ? (
        <div className={`alert alert-${banner.type === "success" ? "success" : "error"}`}>
          {banner.message}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: "Total", value: loading ? "—" : leads.length },
          { label: "Opted in", value: loading ? "—" : optedInCount },
          { label: "New", value: loading ? "—" : newCount },
        ].map((stat) => (
          <div key={stat.label} className="card card-pad">
            <p className="stat-value">{stat.value}</p>
            <p className="stat-label">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="card overflow-hidden pb-20 xl:pb-0">
        {loading ? (
          <div className="flex items-center justify-center gap-2 p-12 text-sm text-neutral-500">
            <RefreshCw className="h-4 w-4 animate-spin" />
            Loading leads…
          </div>
        ) : (
          <LeadsTable leads={leads} />
        )}
      </div>
    </AppShell>
  );
}
