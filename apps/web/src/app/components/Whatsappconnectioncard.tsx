"use client";

import {
  CheckCircle2,
  Copy,
  Globe,
  QrCode,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Wifi,
  Zap,
} from "lucide-react";
import type { ConnectedAccount, TestingStatus } from "@/lib/backend";

type WhatsAppConnectionCardProps = {
  status: TestingStatus | null;
  accounts: ConnectedAccount[];
  onConnect: () => void;
  onLoadQr: () => void;
  onRefresh: () => void;
  qrValue?: string | null;
  connecting?: boolean;
  loadingQr?: boolean;
  refreshing?: boolean;
};

export default function WhatsAppConnectionCard({
  status,
  accounts,
  onConnect,
  onLoadQr,
  onRefresh,
  qrValue = null,
  connecting = false,
  loadingQr = false,
  refreshing = false,
}: WhatsAppConnectionCardProps) {
  const connected = Boolean(status?.connectedAccount);
  const requiredConfig = status?.requiredConfig ?? {};
  const readinessItems = [
    ["WAHA server", requiredConfig.baseUrl, false],
    ["API key", requiredConfig.apiKey, true],
  ] as const;
  const sessionStatus = status?.wahaSession?.status ?? "NOT_CREATED";
  const linkedPhone =
    status?.connectedAccount?.phoneNumber ?? status?.me?.id ?? "Not linked";
  const linkedAccount = accounts[0];

  return (
    <div className="card card-pad">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="section-label">Your WhatsApp number</p>
          <h2 className="text-lg font-semibold text-neutral-900">
            {connected ? linkedPhone : "Not linked yet"}
          </h2>
          <p className="page-subtitle mt-1 max-w-xl">
            {status?.nextStep ??
              "Go to Setup to scan the QR and link your number to this login."}
          </p>
        </div>
        <span className={`badge ${connected ? "badge-success" : "badge-warning"}`}>
          {connected ? (
            <>
              <CheckCircle2 className="h-3.5 w-3.5" />
              Connected
            </>
          ) : (
            <>
              <Wifi className="h-3.5 w-3.5" />
              {sessionStatus.replace(/_/g, " ")}
            </>
          )}
        </span>
      </div>

      <div className="status-row mt-5">
        <div className="status-item">
          <p className="status-item-label">Session</p>
          <p className="status-item-value">{sessionStatus.replace(/_/g, " ")}</p>
        </div>
        <div className="status-item">
          <p className="status-item-label">Provider</p>
          <p className="status-item-value">{linkedAccount?.provider ?? "WAHA"}</p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
          <div className="flex items-center gap-3">
            <Smartphone className="h-5 w-5 text-green-600" />
            <div>
              <p className="text-xs font-medium text-neutral-500">Linked number</p>
              <p className="text-sm font-semibold text-neutral-900">{linkedPhone}</p>
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
          <div className="flex items-center gap-3">
            <Globe className="h-5 w-5 text-sky-600" />
            <div>
              <p className="text-xs font-medium text-neutral-500">Webhook</p>
              <p className="text-sm font-semibold text-neutral-900">
                {status?.webhookPath ?? "/webhooks/whatsapp/waha"}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5 rounded-lg border border-neutral-200 p-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-green-600" />
          <p className="text-sm font-medium text-neutral-900">Server checklist</p>
        </div>
        <div className="mt-3 space-y-2">
          {readinessItems.map(([label, ready, optional]) => (
            <div
              key={label}
              className="flex items-center justify-between rounded-lg bg-neutral-50 px-3 py-2 text-sm"
            >
              <span className="text-neutral-700">{label}</span>
              <span className={`badge ${ready ? "badge-success" : optional ? "badge-warning" : "badge-warning"}`}>
                {ready ? "Ready" : optional ? "Optional" : "Missing"}
              </span>
            </div>
          ))}
        </div>
      </div>

      {qrValue ? (
        <div className="mt-4 rounded-lg border border-neutral-200 p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="section-label">Raw QR payload</p>
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(qrValue)}
              className="btn btn-ghost text-xs"
            >
              <Copy className="h-3.5 w-3.5" />
              Copy
            </button>
          </div>
          <pre className="mt-2 max-h-40 overflow-auto rounded-lg bg-neutral-900 p-3 text-xs text-green-100">
            {qrValue}
          </pre>
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onConnect}
          disabled={connecting}
          className="btn btn-primary"
        >
          {connecting ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
          ) : (
            <Zap className="h-4 w-4" />
          )}
          {connected ? "Sync session" : "Create session"}
        </button>
        <button
          type="button"
          onClick={onLoadQr}
          disabled={loadingQr}
          className="btn btn-secondary"
        >
          <QrCode className="h-4 w-4" />
          {loadingQr ? "Loading…" : "Load QR"}
        </button>
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          className="btn btn-secondary"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>
    </div>
  );
}
