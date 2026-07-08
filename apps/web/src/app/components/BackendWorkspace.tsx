"use client";

import Link from "next/link";
import {
  CheckCircle2,
  ChevronRight,
  Database,
  Layers,
  LayoutTemplate,
  MessageSquareMore,
  MessagesSquare,
  RefreshCw,
  Server,
  ShieldCheck,
  Users,
  XCircle,
} from "lucide-react";
import { startTransition, useEffect, useState } from "react";
import type {
  BackendOverview,
  ConnectedAccount,
  ConversationRecord,
  TemplateRecord,
  TestingStatus,
} from "@/lib/backend";
import AppShell from "./AppShell";
import PageHeader, { PageLink } from "./PageHeader";
import StatusBanner, { type BannerState } from "./StatusBanner";
import {
  DEFAULT_WAHA_SESSION,
  fetchDashboardSummary,
} from "./dashboard-data";

function MetricCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  hint: string;
  icon: typeof Layers;
}) {
  return (
    <div className="card card-pad">
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-emerald-50 text-emerald-700">
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <p className="stat-value mt-4">{value}</p>
      <p className="stat-label">{label}</p>
      <p className="stat-hint">{hint}</p>
    </div>
  );
}

function ReadinessTile({
  label,
  ok,
  okText,
  failText,
  okSub,
  failSub,
}: {
  label: string;
  ok: boolean;
  okText: string;
  failText: string;
  okSub: string;
  failSub: string;
}) {
  return (
    <div className="rounded-md border border-neutral-200 bg-white p-4">
      <div className="flex items-start gap-3">
        {ok ? (
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
        ) : (
          <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
        )}
        <div>
          <p className="section-label">{label}</p>
          <p className="mt-1 text-sm font-bold text-neutral-900">
            {ok ? okText : failText}
          </p>
          <p className="mt-1 text-xs leading-5 text-neutral-500">
            {ok ? okSub : failSub}
          </p>
        </div>
      </div>
    </div>
  );
}

function StackCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4">
      <p className="section-label">{label}</p>
      <p className="mt-2 text-sm font-semibold text-neutral-900">{value}</p>
    </div>
  );
}

export default function BackendWorkspace() {
  const [overview, setOverview] = useState<BackendOverview | null>(null);
  const [status, setStatus] = useState<TestingStatus | null>(null);
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [templates, setTemplates] = useState<TemplateRecord[]>([]);
  const [conversations, setConversations] = useState<ConversationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [banner, setBanner] = useState<BannerState>(null);

  const applySummary = (
    nextData: Awaited<ReturnType<typeof fetchDashboardSummary>>,
  ) => {
    startTransition(() => {
      setOverview(nextData.overview);
      setStatus(nextData.status);
      setAccounts(nextData.accounts);
      setTemplates(nextData.templates);
      setConversations(nextData.conversations);
    });
  };

  const loadBackendRoute = async () => {
    const nextData = await fetchDashboardSummary(DEFAULT_WAHA_SESSION);
    applySummary(nextData);
  };

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const nextData = await fetchDashboardSummary(DEFAULT_WAHA_SESSION);
        if (active) applySummary(nextData);
      } catch (error) {
        if (!active) return;
        setBanner({
          type: "error",
          message:
            error instanceof Error
              ? error.message
              : "Could not load the backend route.",
        });
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    setBanner(null);
    try {
      await loadBackendRoute();
      setBanner({ type: "success", message: "Backend route refreshed." });
    } catch (error) {
      setBanner({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Could not refresh the backend route.",
      });
    } finally {
      setRefreshing(false);
    }
  };

  const envReady = Boolean(status?.envReady);
  const hasAccount = Boolean(status?.connectedAccount);
  const healthPercent = envReady && hasAccount ? 100 : envReady || hasAccount ? 50 : 0;

  return (
    <AppShell
      onRefresh={() => void handleRefresh()}
      refreshing={refreshing}
      contentClassName="max-w-7xl"
    >
      <PageHeader
        eyebrow="Infrastructure"
        title="Backend"
        description="Live API, database, job, and messaging readiness in the same dashboard style."
        actions={
          <>
            <PageLink href="/dashboard/templates" primary>
              <ShieldCheck className="h-4 w-4" />
              Templates
            </PageLink>
            <PageLink href="/dashboard/whatsapp">
              <MessageSquareMore className="h-4 w-4" />
              Campaigns
            </PageLink>
            <button
              type="button"
              onClick={() => void handleRefresh()}
              disabled={refreshing}
              className="btn btn-secondary"
              aria-label="Refresh backend"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            </button>
          </>
        }
      />

      <StatusBanner banner={banner} />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Provider"
          icon={Layers}
          value={loading ? "-" : overview?.recommendedProvider ?? "WAHA"}
          hint="Recommended messaging provider."
        />
        <MetricCard
          label="Accounts"
          icon={Users}
          value={loading ? "-" : accounts.length}
          hint="WhatsApp account records."
        />
        <MetricCard
          label="Templates"
          icon={LayoutTemplate}
          value={loading ? "-" : templates.length}
          hint="Saved outreach templates."
        />
        <MetricCard
          label="Conversations"
          icon={MessagesSquare}
          value={loading ? "-" : conversations.length}
          hint="Stored conversation threads."
        />
      </div>

      <section className="card card-pad space-y-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-emerald-50 text-emerald-700">
            <Database className="h-5 w-5" />
          </div>
          <div>
            <p className="section-label">Connected backend</p>
            <h2 className="text-base font-bold text-neutral-900">Stack overview</h2>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StackCell label="Framework" value={overview?.stack.framework ?? "NestJS"} />
          <StackCell
            label="Database"
            value={overview?.stack.database ?? "PostgreSQL + Prisma"}
          />
          <StackCell
            label="Jobs"
            value={overview?.stack.jobEngine ?? "Database jobs + schedule"}
          />
          <StackCell
            label="Session"
            value={status?.wahaSession?.status ?? "NOT_CREATED"}
          />
        </div>

        {(overview?.modules ?? []).length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {(overview?.modules ?? []).map((item) => (
              <span key={item} className="badge badge-success">
                {item}
              </span>
            ))}
          </div>
        ) : null}
      </section>

      <div className="grid gap-5 xl:grid-cols-[1fr_0.9fr]">
        <section className="card card-pad space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-emerald-50 text-emerald-700">
              <Server className="h-5 w-5" />
            </div>
            <div>
              <p className="section-label">Operational notes</p>
              <h2 className="text-base font-bold text-neutral-900">
                API response notes
              </h2>
            </div>
          </div>

          <div className="space-y-2">
            {(overview?.notes ?? []).length > 0 ? (
              (overview?.notes ?? []).map((note, index) => (
                <div
                  key={note}
                  className="rounded-md border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm leading-6 text-neutral-700"
                >
                  <span className="mr-2 text-xs font-bold text-emerald-700">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  {note}
                </div>
              ))
            ) : (
              <div className="rounded-md border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-500">
                No backend notes were returned yet.
              </div>
            )}
          </div>
        </section>

        <section className="card card-pad space-y-4">
          <div>
            <p className="section-label">Live readiness</p>
            <h2 className="text-base font-bold text-neutral-900">System health</h2>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <ReadinessTile
              label="Environment"
              ok={envReady}
              okText="Ready"
              failText="Needs setup"
              okSub="Backend can reach the WAHA container."
              failSub="Check WAHA_BASE_URL and restart the backend."
            />
            <ReadinessTile
              label="Account"
              ok={hasAccount}
              okText="Saved"
              failText="Pending"
              okSub="Linked number is stored and ready for sends."
              failSub="Create session, scan QR, then save the linked account."
            />
          </div>

          <div>
            <div className="mb-1.5 flex justify-between text-xs font-semibold text-neutral-500">
              <span>Overall health</span>
              <span className="text-emerald-700">{healthPercent}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-neutral-100">
              <div
                className="h-full rounded-full bg-emerald-600 transition-all"
                style={{ width: `${healthPercent}%` }}
              />
            </div>
          </div>

          <Link
            href="/dashboard/whatsapp/setup"
            className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-700 hover:text-emerald-800"
          >
            Open WhatsApp setup
            <ChevronRight className="h-4 w-4" />
          </Link>
        </section>
      </div>
    </AppShell>
  );
}
