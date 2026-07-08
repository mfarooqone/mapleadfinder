"use client";

import { useRouter } from "next/navigation";
import { startTransition, useEffect, useMemo, useState } from "react";
import { getAuthUser, type AuthUser } from "@/lib/auth";
import { postJson } from "@/lib/backend";
import ActivityJobsPanel from "./Activityjobspanel";
import AppShell from "./AppShell";
import DashboardHero from "./Dashboardhero";
import DashboardLeaderboard from "./DashboardLeaderboard";
import DashboardOnboarding from "./DashboardOnboarding";
import DashboardPipelineFunnel from "./DashboardPipelineFunnel";
import DashboardQuickActions from "./DashboardQuickActions";
import DashboardRecentLeads from "./DashboardRecentLeads";
import DashboardReviews from "./DashboardReviews";
import DashboardTrustBar from "./DashboardTrustBar";
import StatsCards from "./Statscards";
import StatusBanner, { type BannerState } from "./StatusBanner";
import {
  buildActivityItems,
  buildDashboardStats,
  DEFAULT_WAHA_SESSION,
  fetchDashboardSummary,
} from "./dashboard-data";
import {
  buildOnboardingSteps,
  buildPipelineStages,
  TRUST_STATS,
} from "./marketing-data";
import type {
  ConnectedAccount,
  ConversationRecord,
  LeadRecord,
  TemplateRecord,
  TestingStatus,
} from "@/lib/backend";

export default function OverviewWorkspace() {
  const router = useRouter();
  const [status, setStatus] = useState<TestingStatus | null>(null);
  const [leads, setLeads] = useState<LeadRecord[]>([]);
  const [templates, setTemplates] = useState<TemplateRecord[]>([]);
  const [conversations, setConversations] = useState<ConversationRecord[]>([]);
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(false);
  const [banner, setBanner] = useState<BannerState>(null);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    setAuthUser(getAuthUser());
  }, []);

  const applySummary = (
    data: Awaited<ReturnType<typeof fetchDashboardSummary>>,
  ) => {
    startTransition(() => {
      setStatus(data.status);
      setLeads(data.leads);
      setTemplates(data.templates);
      setConversations(data.conversations);
      setAccounts(data.accounts);
    });
  };

  const loadOverview = async () => {
    const data = await fetchDashboardSummary(DEFAULT_WAHA_SESSION);
    applySummary(data);
    return data;
  };

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const data = await fetchDashboardSummary(DEFAULT_WAHA_SESSION);
        if (!active) return;
        applySummary(data);
      } catch (error) {
        if (!active) return;
        setBanner({
          type: "error",
          message:
            error instanceof Error ? error.message : "Could not connect to the backend.",
        });
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const refreshAll = async () => {
    setRefreshing(true);
    setBanner(null);
    try {
      await loadOverview();
      setBanner({ type: "success", message: "Dashboard updated." });
    } catch (error) {
      setBanner({
        type: "error",
        message: error instanceof Error ? error.message : "Refresh failed.",
      });
    } finally {
      setRefreshing(false);
    }
  };

  const handleBootstrap = async () => {
    setBootstrapping(true);
    setBanner(null);
    try {
      await postJson("/whatsapp/testing/waha/bootstrap", {
        sessionName: DEFAULT_WAHA_SESSION,
      });
      await loadOverview();
      setBanner({ type: "success", message: "WhatsApp session synced." });
    } catch (error) {
      setBanner({
        type: "error",
        message: error instanceof Error ? error.message : "Could not sync session.",
      });
    } finally {
      setBootstrapping(false);
    }
  };

  const connected = Boolean(status?.connectedAccount);
  const linkedPhone = status?.connectedAccount?.phoneNumber;
  const optedInLeads = leads.filter((lead) => lead.optIn).length;
  const engagedLeads = leads.filter((lead) => lead.warmUpStatus === "ENGAGED").length;

  const stats = useMemo(
    () => buildDashboardStats({ leads, templates, conversations, status }),
    [conversations, leads, status, templates],
  );

  const onboardingSteps = useMemo(
    () =>
      buildOnboardingSteps({
        connected,
        leadsCount: leads.length,
        templatesCount: templates.length,
        conversationsCount: conversations.length,
      }),
    [connected, conversations.length, leads.length, templates.length],
  );

  const pipelineStages = useMemo(
    () =>
      buildPipelineStages({
        leadsCount: leads.length,
        optedInCount: optedInLeads,
        conversationsCount: conversations.length,
        engagedCount: engagedLeads,
      }),
    [conversations.length, engagedLeads, leads.length, optedInLeads],
  );

  const activityItems = useMemo(
    () =>
      buildActivityItems({
        status,
        accounts,
        templates,
        conversations,
      }),
    [accounts, conversations, status, templates],
  );

  return (
    <AppShell onRefresh={() => void refreshAll()} refreshing={refreshing}>
      <div className="flex flex-col gap-6 pb-20 xl:pb-8">
        <StatusBanner banner={banner} />

        <DashboardHero
          userName={authUser?.name ?? authUser?.email}
          connected={connected}
          linkedPhone={linkedPhone}
          envReady={Boolean(status?.envReady)}
          activeProfile={status?.wahaSession?.status}
          onConnect={() => void handleBootstrap()}
          onLoadQr={() => router.push("/dashboard/whatsapp/setup")}
          onJumpToTest={() => router.push("/dashboard/whatsapp")}
          loading={bootstrapping}
        />

        <DashboardTrustBar />

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Leads scraped", value: TRUST_STATS.leadsScraped },
            { label: "Messages sent", value: TRUST_STATS.messagesSent },
            { label: "Active users", value: TRUST_STATS.users },
            { label: "Avg. rating", value: `${TRUST_STATS.avgRating} ★` },
          ].map((item) => (
            <div key={item.label} className="dashboard-mini-stat">
              <p className="text-lg font-bold text-neutral-900">{item.value}</p>
              <p className="text-xs text-neutral-500">{item.label}</p>
            </div>
          ))}
        </div>

        <StatsCards cards={stats} loading={loading} />

        <DashboardQuickActions />

        <div className="grid gap-6 lg:grid-cols-2">
          <DashboardOnboarding steps={onboardingSteps} />
          <DashboardPipelineFunnel stages={pipelineStages} />
        </div>

        <div className="grid gap-6 xl:grid-cols-3">
          <div className="xl:col-span-2">
            <DashboardRecentLeads leads={leads} loading={loading} />
          </div>
          <DashboardLeaderboard />
        </div>

        <ActivityJobsPanel
          items={activityItems}
          onRefresh={() => void refreshAll()}
          refreshing={refreshing}
        />

        <DashboardReviews />
      </div>
    </AppShell>
  );
}
