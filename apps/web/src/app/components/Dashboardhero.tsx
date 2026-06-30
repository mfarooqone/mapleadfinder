"use client";

import { MapPin, QrCode, RefreshCw, Sparkles, Zap } from "lucide-react";

type DashboardHeroProps = {
  userName?: string | null;
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
  userName,
  connected,
  linkedPhone,
  envReady,
  activeProfile,
  onConnect,
  onLoadQr,
  onJumpToTest,
  loading = false,
}: DashboardHeroProps) {
  const firstName = userName?.split(" ")[0] ?? "there";
  const statusLabel = connected
    ? "WhatsApp linked"
    : activeProfile === "SCAN_QR_CODE"
      ? "Scan QR to finish"
      : envReady
        ? "Ready to link"
        : "Setup needed";

  return (
    <section className="dashboard-hero">
      <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-2xl">
          <div className="flex flex-wrap items-center gap-2">
            <span className="dashboard-hero-badge">
              <Sparkles className="h-3.5 w-3.5" />
              MapLeadFinder Pro
            </span>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                connected
                  ? "bg-white/20 text-white"
                  : "bg-amber-400/20 text-amber-100"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${connected ? "bg-emerald-300" : "bg-amber-300"}`}
              />
              {statusLabel}
            </span>
          </div>

          <h1 className="mt-4 text-2xl font-bold tracking-tight text-white sm:text-3xl lg:text-4xl">
            Welcome back, {firstName}
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-emerald-50/90 sm:text-base">
            {connected
              ? `Your number ${linkedPhone ?? ""} is live. Scrape local businesses, enrich contacts, and run WhatsApp campaigns — all from one Apollo-style workspace.`
              : "Connect WhatsApp, scrape Google Maps leads, and launch outreach with anti-block pacing built in."}
          </p>

          <div className="mt-5 flex flex-wrap gap-4 text-xs text-emerald-100/80">
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" />
              Google Maps scraper
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5" />
              WAHA bulk send
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5" />
              Email + inbox
            </span>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2 lg:flex-col lg:items-stretch">
          <button
            type="button"
            onClick={onConnect}
            disabled={loading}
            className="btn bg-white text-emerald-800 hover:bg-emerald-50"
          >
            {loading ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            {connected ? "Sync session" : "Connect WhatsApp"}
          </button>
          {!connected ? (
            <button
              type="button"
              onClick={onLoadQr}
              className="btn border border-white/30 bg-white/10 text-white hover:bg-white/20"
            >
              <QrCode className="h-4 w-4" />
              Scan QR code
            </button>
          ) : null}
          <button
            type="button"
            onClick={onJumpToTest}
            className="btn border border-white/20 bg-transparent text-white hover:bg-white/10"
          >
            Launch campaign
          </button>
        </div>
      </div>
    </section>
  );
}
