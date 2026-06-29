"use client";

import { QrCode, RefreshCw } from "lucide-react";

type DashboardHeroProps = {
  connected: boolean;
  linkedPhone?: string | null;
  envReady: boolean;
  activeProfile?: string;
  onConnect: () => void;
  onLoadQr: () => void;
  onJumpToTest: () => void;
  loading?: boolean;
};

export default function DashboardHero({
  connected,
  linkedPhone,
  envReady,
  activeProfile,
  onConnect,
  onLoadQr,
  onJumpToTest,
  loading = false,
}: DashboardHeroProps) {
  const statusLabel = connected
    ? "WhatsApp linked"
    : activeProfile === "SCAN_QR_CODE"
      ? "Scan QR to finish"
      : envReady
        ? "Ready to link"
        : "Setup needed";

  return (
    <section className="card card-pad">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span
              className={`h-2 w-2 rounded-full ${connected ? "bg-green-500" : "bg-amber-400"}`}
            />
            <span className="section-label">{statusLabel}</span>
          </div>
          <h1 className="page-title mt-2">Dashboard</h1>
          <p className="page-subtitle max-w-lg">
            {connected
              ? `Your number ${linkedPhone ?? ""} is linked. Send messages and view your inbox.`
              : "Link one WhatsApp number to this account, then start messaging."}
          </p>
          {connected && linkedPhone ? (
            <p className="mt-2 text-sm font-medium text-green-700">{linkedPhone}</p>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onConnect}
            disabled={loading}
            className="btn btn-primary"
          >
            {loading ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            {connected ? "Sync" : "Connect"}
          </button>
          {!connected ? (
            <button type="button" onClick={onLoadQr} className="btn btn-secondary">
              <QrCode className="h-4 w-4" />
              Setup & QR
            </button>
          ) : null}
          <button type="button" onClick={onJumpToTest} className="btn btn-ghost">
            Send message
          </button>
        </div>
      </div>
    </section>
  );
}
