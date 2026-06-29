"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  MessageSquare,
  MessagesSquare,
  QrCode,
  Shapes,
  UserRoundPlus,
  Users,
  type LucideIcon,
} from "lucide-react";
import { startTransition, useEffect, useMemo, useState } from "react";
import { postJson } from "@/lib/backend";
import AppShell from "./AppShell";
import DashboardHero from "./Dashboardhero";
import StatsCards from "./Statscards";
import StatusBanner, { type BannerState } from "./StatusBanner";
import {
  DEFAULT_WAHA_SESSION,
  buildDashboardStats,
  fetchDashboardSummary,
} from "./dashboard-data";
import type {
  ConversationRecord,
  LeadRecord,
  TemplateRecord,
  TestingStatus,
} from "@/lib/backend";

type QuickLink = {
  href: string;
  title: string;
  meta: string;
  icon: LucideIcon;
};

export default function OverviewWorkspace() {
  const router = useRouter();
  const [status, setStatus] = useState<TestingStatus | null>(null);
  const [leads, setLeads] = useState<LeadRecord[]>([]);
  const [templates, setTemplates] = useState<TemplateRecord[]>([]);
  const [conversations, setConversations] = useState<ConversationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(false);
  const [banner, setBanner] = useState<BannerState>(null);

  const applySummary = (
    data: Awaited<ReturnType<typeof fetchDashboardSummary>>,
  ) => {
    startTransition(() => {
      setStatus(data.status);
      setLeads(data.leads);
      setTemplates(data.templates);
      setConversations(data.conversations);
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
      setBanner({ type: "success", message: "Updated." });
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

  const stats = useMemo(
    () => buildDashboardStats({ leads, templates, conversations, status }),
    [conversations, leads, status, templates],
  );

  const linkedPhone = status?.connectedAccount?.phoneNumber;
  const connected = Boolean(status?.connectedAccount);

  const quickLinks = useMemo<QuickLink[]>(
    () => [
      {
        href: "/dashboard/whatsapp/setup",
        title: "Setup",
        meta: connected ? (linkedPhone ?? "Linked") : "Link your number",
        icon: QrCode,
      },
      {
        href: "/dashboard/whatsapp",
        title: "Send",
        meta: connected ? "Ready" : "Link WhatsApp first",
        icon: MessageSquare,
      },
      {
        href: "/dashboard/conversations",
        title: "Inbox",
        meta: `${conversations.length} threads`,
        icon: MessagesSquare,
      },
      {
        href: "/dashboard/contacts",
        title: "Contacts",
        meta: "Manage list",
        icon: UserRoundPlus,
      },
      {
        href: "/dashboard/leads",
        title: "Leads",
        meta: `${leads.length} total`,
        icon: Users,
      },
      {
        href: "/dashboard/templates",
        title: "Templates",
        meta: `${templates.filter((t) => t.status === "APPROVED").length} approved`,
        icon: Shapes,
      },
    ],
    [connected, conversations.length, leads.length, linkedPhone, templates],
  );

  return (
    <AppShell onRefresh={() => void refreshAll()} refreshing={refreshing}>
      <div className="flex flex-col gap-4 pb-20 xl:pb-6">
        <StatusBanner banner={banner} />

        <DashboardHero
          connected={connected}
          linkedPhone={linkedPhone}
          envReady={Boolean(status?.envReady)}
          activeProfile={status?.wahaSession?.status}
          onConnect={() => void handleBootstrap()}
          onLoadQr={() => router.push("/dashboard/whatsapp/setup")}
          onJumpToTest={() => router.push("/dashboard/whatsapp")}
          loading={bootstrapping}
        />

        <StatsCards cards={stats} loading={loading} />

        <section className="card card-pad">
          <p className="section-label">Quick links</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {quickLinks.map((link) => {
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className="flex items-center gap-3 rounded-lg border border-neutral-200 px-4 py-3 transition-colors hover:border-neutral-300 hover:bg-neutral-50"
                >
                  <Icon className="h-4 w-4 shrink-0 text-neutral-400" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-neutral-900">{link.title}</p>
                    <p className="truncate text-xs text-neutral-500">{link.meta}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
