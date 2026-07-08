"use client";

import Link from "next/link";
import {
  ChevronRight,
  MessageSquare,
  Mic,
  QrCode,
  RefreshCw,
} from "lucide-react";
import { startTransition, useEffect, useState } from "react";
import {
  bootstrapBaileysSession,
  fetchBaileysQr,
  fetchBaileysStatus,
  getVoiceApiInfo,
  getJson,
  postJson,
  sendVoiceMessage,
  type BaileysQrResponse,
  type LeadRecord,
  type TestingStatus,
  type VoiceApiInfo,
} from "@/lib/backend";
import AppShell from "./AppShell";
import VoiceMessageComposer, {
  type VoiceSourceMode,
} from "./VoiceMessageComposer";
import {
  DEFAULT_WAHA_SESSION,
} from "./dashboard-data";

type BannerState = {
  type: "success" | "error" | "info";
  message: string;
} | null;

const DEFAULT_MIMETYPE = "audio/ogg; codecs=opus";
const DEFAULT_VOICE_SCRIPT = `Hi {{firstName}},
This is Rehman Ahmed from Social Velocity.
I came across your business online and found a quick SEO point:
{{seoPoint}}

Would it be okay if I share 2-3 practical improvements for your website?`;

export default function WahaVoiceWorkspace() {
  const [status, setStatus] = useState<TestingStatus | null>(null);
  const [wahaSessionName, setWahaSessionName] = useState(DEFAULT_WAHA_SESSION);
  const [recipientPhone, setRecipientPhone] = useState("");
  const [sourceMode, setSourceMode] = useState<VoiceSourceMode>("url");
  const [voiceUrl, setVoiceUrl] = useState("");
  const [voiceData, setVoiceData] = useState("");
  const [filename, setFilename] = useState("");
  const [mimetype, setMimetype] = useState(DEFAULT_MIMETYPE);
  const [convert, setConvert] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sending, setSending] = useState(false);
  const [generatingVoice, setGeneratingVoice] = useState(false);
  const [sendingText, setSendingText] = useState(false);
  const [banner, setBanner] = useState<BannerState>(null);
  const [voiceApiInfo, setVoiceApiInfo] = useState<VoiceApiInfo | null>(null);
  const [qrResponse, setQrResponse] = useState<BaileysQrResponse | null>(null);
  const [contacts, setContacts] = useState<LeadRecord[]>([]);
  const [selectedContactId, setSelectedContactId] = useState("");

  const loadWorkspace = async (sessionNameOverride?: string) => {
    const resolvedSessionName =
      (sessionNameOverride ?? wahaSessionName.trim()) || DEFAULT_WAHA_SESSION;
    const nextStatus = await fetchBaileysStatus(resolvedSessionName);
    startTransition(() => {
      setStatus(nextStatus);
      setWahaSessionName((current) => nextStatus.sessionName ?? current);
    });
  };

  useEffect(() => {
    let active = true;
    const run = async () => {
      try {
        const [nextData, apiInfo] = await Promise.all([
          fetchBaileysStatus(DEFAULT_WAHA_SESSION),
          getVoiceApiInfo().catch(() => null),
          getJson<LeadRecord[]>("/leads")
            .then((rows) => {
              if (active) setContacts(rows);
            })
            .catch(() => undefined),
        ]);
        if (!active) return;
        startTransition(() => {
          setStatus(nextData);
          setWahaSessionName((current) => nextData.sessionName ?? current);
          setVoiceApiInfo(apiInfo);
        });
      } catch (error) {
        if (!active) return;
        setBanner({
          type: "error",
          message:
            error instanceof Error
              ? error.message
              : "Could not load the voice workspace.",
        });
      } finally {
        if (active) setLoading(false);
      }
    };
    void run();
    return () => {
      active = false;
    };
  }, []);

  const refreshAll = async () => {
    setRefreshing(true);
    setBanner(null);
    try {
      const [nextContacts] = await Promise.all([
        getJson<LeadRecord[]>("/leads").catch(() => contacts),
        loadWorkspace(),
      ]);
      setContacts(nextContacts);
      setBanner({ type: "success", message: "Voice route refreshed from the backend." });
    } catch (error) {
      setBanner({
        type: "error",
        message:
          error instanceof Error ? error.message : "Refresh failed.",
      });
    } finally {
      setRefreshing(false);
    }
  };

  const handleLoadQr = async () => {
    setRefreshing(true);
    setBanner(null);
    try {
      const resolvedSessionName = wahaSessionName.trim() || DEFAULT_WAHA_SESSION;
      const response = await fetchBaileysQr(resolvedSessionName);
      setQrResponse(response);
      await loadWorkspace(resolvedSessionName);
      setBanner({
        type: response.qrDataUrl ? "info" : response.connected ? "success" : "info",
        message: response.hint ?? "Baileys session updated.",
      });
    } catch (error) {
      setBanner({
        type: "error",
        message: error instanceof Error ? error.message : "Could not load Baileys QR.",
      });
    } finally {
      setRefreshing(false);
    }
  };

  const handleBootstrapBaileys = async () => {
    setRefreshing(true);
    setBanner(null);
    try {
      const resolvedSessionName = wahaSessionName.trim() || DEFAULT_WAHA_SESSION;
      const response = await bootstrapBaileysSession({
        sessionName: resolvedSessionName,
      });
      await loadWorkspace(resolvedSessionName);
      setBanner({
        type: response.accountSaved ? "success" : "info",
        message: response.nextStep ?? "Baileys session synced.",
      });
    } catch (error) {
      setBanner({
        type: "error",
        message: error instanceof Error ? error.message : "Could not save Baileys session.",
      });
    } finally {
      setRefreshing(false);
    }
  };

  const handleFileSelect = (file: File) => {
    setFilename(file.name);
    setMimetype(file.type || DEFAULT_MIMETYPE);
    setConvert(!file.name.endsWith(".opus") && !file.name.endsWith(".ogg"));

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      const base64 = result.includes(",") ? result.split(",")[1] ?? "" : result;
      setVoiceData(base64);
    };
    reader.onerror = () => {
      setBanner({ type: "error", message: "Could not read the selected file." });
    };
    reader.readAsDataURL(file);
  };

  const handleSendVoice = async () => {
    setSending(true);
    setBanner(null);
    try {
      const payload: {
        to: string;
        url?: string;
        data?: string;
        filename?: string;
        mimetype?: string;
        convert?: boolean;
      } = {
        to: recipientPhone.trim(),
        mimetype: mimetype.trim() || DEFAULT_MIMETYPE,
        convert,
      };

      if (sourceMode === "url") {
        payload.url = voiceUrl.trim();
      } else {
        payload.data = voiceData.trim();
        if (filename.trim()) payload.filename = filename.trim();
      }

      const response = await sendVoiceMessage(payload);
      await loadWorkspace();
      setBanner({
        type: "success",
        message: response.note ?? "Baileys voice message sent successfully.",
      });
    } catch (error) {
      setBanner({
        type: "error",
        message: error instanceof Error ? error.message : "Voice send failed.",
      });
    } finally {
      setSending(false);
    }
  };

  const handleSendScriptAsText = async () => {
    if (!status?.connectedAccount?.id) {
      setBanner({
        type: "error",
        message: "Save the Baileys session first.",
      });
      return;
    }

    setSendingText(true);
    setBanner(null);
    try {
      await postJson<
        { queued: boolean; scheduledFor?: string },
        {
          whatsappAccountId: string;
          phone: string;
          messageType: "text";
          message: string;
        }
      >("/whatsapp/send", {
        whatsappAccountId: status.connectedAccount.id,
        phone: recipientPhone.trim(),
        messageType: "text",
        message: renderedVoiceScript,
      });
      setBanner({
        type: "success",
        message:
          "Fetched message queued as text. Record/upload audio if you want it as a voice note.",
      });
    } catch (error) {
      setBanner({
        type: "error",
        message:
          error instanceof Error ? error.message : "Could not send script as text.",
      });
    } finally {
      setSendingText(false);
    }
  };

  const handleGenerateAndSendScriptVoice = async () => {
    setGeneratingVoice(true);
    setBanner(null);
    try {
      const response = await postJson<
        { sent: boolean; note?: string },
        { to: string; message: string }
      >("/whatsapp/testing/baileys/send-script-voice", {
        to: recipientPhone.trim(),
        message: renderedVoiceScript,
      });
      await loadWorkspace();
      setBanner({
        type: "success",
        message:
          response.note ??
          "Generated the fetched script as speech and sent it as a Baileys voice note.",
      });
    } catch (error) {
      setBanner({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Could not generate and send voice.",
      });
    } finally {
      setGeneratingVoice(false);
    }
  };

  const connected = Boolean(
    status?.connectedAccount && status?.baileysSession?.connected,
  );
  const sortedContacts = [...contacts].sort((left, right) =>
    (left.name ?? left.phone).localeCompare(right.name ?? right.phone),
  );
  const selectedContact =
    contacts.find((candidate) => candidate.id === selectedContactId) ?? null;
  const selectedFirstName =
    selectedContact?.name?.trim().split(/\s+/)[0] || "there";
  const renderedVoiceScript = DEFAULT_VOICE_SCRIPT
    .replaceAll("{{firstName}}", selectedFirstName)
    .replaceAll("{{seoPoint}}", "Your custom SEO point goes here.");

  return (
    <AppShell
      onRefresh={() => void refreshAll()}
      refreshing={refreshing}
      contentClassName="max-w-[1200px]"
    >
      <div className="flex flex-col gap-6">
        <header className="card card-pad border-l-4 border-l-emerald-500">
          <div className="relative flex flex-wrap items-center justify-between gap-6">
            <div>
              <p className="section-label">
                Dedicated Route
              </p>
              <h1 className="page-title mt-1.5">
                Voice Workspace
              </h1>
              <p className="page-subtitle">
                Send WhatsApp voice notes through a free Baileys linked-device
                session. Use URL or upload a file; queued sends use{" "}
                <code className="rounded bg-emerald-50 px-1.5 py-0.5 font-mono text-xs text-emerald-800">messageType: voice</code>.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href="/dashboard/whatsapp"
                  className="badge badge-success"
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  Text sends
                </Link>
                <Link
                  href="/dashboard/whatsapp/setup"
                  className="badge badge-neutral"
                >
                  <QrCode className="h-3.5 w-3.5" />
                  Text setup
                </Link>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <span
                className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-[0.14em] ${
                  connected
                    ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border border-amber-200 bg-amber-50 text-amber-700"
                }`}
              >
                <span
                  className={`h-2 w-2 rounded-full ${connected ? "bg-emerald-400" : "bg-amber-400"}`}
                />
                {connected ? "Session live" : "Not connected"}
              </span>
              <button
                type="button"
                onClick={() => void refreshAll()}
                disabled={refreshing || loading}
                className="btn btn-secondary"
              >
                <RefreshCw
                  className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
                />
                Refresh
              </button>
              <button
                type="button"
                onClick={() => void handleLoadQr()}
                disabled={refreshing || loading}
                className="btn btn-secondary"
              >
                <QrCode className="h-4 w-4" />
                Load QR
              </button>
              <button
                type="button"
                onClick={() => void handleBootstrapBaileys()}
                disabled={refreshing || loading}
                className="btn btn-primary"
              >
                Save Session
              </button>
            </div>
          </div>
        </header>

        {banner ? (
          <div
            className={`rounded-2xl border px-4 py-3 text-sm ${
              banner.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : banner.type === "error"
                  ? "border-red-200 bg-red-50 text-red-800"
                  : "border-sky-200 bg-sky-50 text-sky-800"
            }`}
          >
            {banner.message}
          </div>
        ) : null}

        {!connected && !loading ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Link Baileys first: load the QR, scan it from WhatsApp Linked
            Devices, then click Save Session before sending voice messages.
          </div>
        ) : null}

        <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="flex flex-col gap-5">
            <div className="section-card p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                Fetched Message Script
              </p>
              <textarea
                value={renderedVoiceScript}
                readOnly
                rows={6}
                className="mt-3 w-full rounded-2xl border border-emerald-100 bg-emerald-50/60 px-4 py-3 text-sm leading-6 text-slate-800 outline-none"
              />
              <p className="mt-3 text-xs leading-5 text-slate-500">
                This is the text script for the selected customer. Baileys sends
                audio only, so record this script as OGG/Opus, then upload it
                below or paste your hosted audio URL.
              </p>
              <button
                type="button"
                onClick={() => void handleSendScriptAsText()}
                disabled={!connected || !recipientPhone.trim() || sendingText}
                className="btn btn-secondary mt-4"
              >
                {sendingText ? "Queueing text..." : "Send This Script as Text"}
              </button>
              <button
                type="button"
                onClick={() => void handleGenerateAndSendScriptVoice()}
                disabled={!connected || !recipientPhone.trim() || generatingVoice}
                className="btn btn-primary ml-2 mt-4"
              >
                {generatingVoice
                  ? "Generating voice..."
                  : "Generate & Send as Voice"}
              </button>
            </div>

            <div className="section-card p-5">
              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-[240px] flex-1">
                  <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Saved Customer
                  </label>
                  <select
                    value={selectedContactId}
                    onChange={(event) => {
                      const leadId = event.target.value;
                      setSelectedContactId(leadId);
                      const lead = contacts.find((candidate) => candidate.id === leadId);
                      if (lead) setRecipientPhone(lead.phone);
                    }}
                    className="mt-3 w-full rounded-md border border-emerald-100 bg-neutral-50 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-emerald-300 focus:bg-white"
                  >
                    <option value="">Manual number / no selected contact</option>
                    {sortedContacts.map((lead) => (
                      <option key={lead.id} value={lead.id}>
                        {lead.name || lead.phone} - {lead.phone}
                      </option>
                    ))}
                  </select>
                </div>
                <Link
                  href="/dashboard/contacts"
                  className="btn btn-secondary"
                >
                  Add contacts
                </Link>
              </div>
              <p className="mt-3 text-xs leading-5 text-slate-500">
                Choose a saved customer to fill the number automatically, or leave
                this empty and type any customer number below.
              </p>
            </div>

          <VoiceMessageComposer
            recipientPhone={recipientPhone}
            onRecipientPhoneChange={setRecipientPhone}
            sourceMode={sourceMode}
            onSourceModeChange={(mode) => {
              setSourceMode(mode);
              setBanner(null);
            }}
            voiceUrl={voiceUrl}
            onVoiceUrlChange={setVoiceUrl}
            voiceData={voiceData}
            onVoiceDataChange={setVoiceData}
            filename={filename}
            onFilenameChange={setFilename}
            mimetype={mimetype}
            onMimetypeChange={setMimetype}
            convert={convert}
            onConvertChange={setConvert}
            onFileSelect={handleFileSelect}
            onSend={() => void handleSendVoice()}
            sending={sending}
            connected={connected}
          />
          </div>

          <aside className="flex flex-col gap-4">
            <div className="rounded-lg border border-emerald-100 bg-white p-5 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-md bg-emerald-50">
                  <Mic className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                    API routes
                  </p>
                  <h2 className="mt-1 text-lg font-bold text-slate-900">
                    Voice endpoints
                  </h2>
                  <ul className="mt-3 space-y-2 text-sm text-slate-600">
                    {voiceApiInfo
                      ? Object.entries(voiceApiInfo.routes).map(([key, path]) => (
                          <li key={key}>
                            <code className="font-mono text-xs">{path}</code>
                          </li>
                        ))
                      : (
                        <>
                          <li>
                            <code className="font-mono text-xs">GET /whatsapp/voice</code>
                          </li>
                          <li>
                            <code className="font-mono text-xs">POST /whatsapp/voice/send</code>
                          </li>
                          <li>
                            <code className="font-mono text-xs">POST /whatsapp/voice/queue</code>
                          </li>
                        </>
                      )}
                  </ul>
                  {voiceApiInfo?.requiresWahaPlus ? (
                    <p className="mt-3 text-xs text-amber-700">{voiceApiInfo.note}</p>
                  ) : voiceApiInfo?.note ? (
                    <p className="mt-3 text-xs text-emerald-700">{voiceApiInfo.note}</p>
                  ) : null}
                  <Link
                    href="/dashboard/whatsapp/setup"
                    className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700"
                  >
                    Open text setup
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            </div>

            <div className="rounded-[1.4rem] border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-900">Session</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Link Baileys here before sending.
                  </p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${
                    status?.baileysSession?.connected
                      ? "bg-emerald-100 text-emerald-700"
                      : status?.baileysSession?.hasQr
                        ? "bg-sky-100 text-sky-700"
                        : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {status?.baileysSession?.connected
                    ? "Connected"
                    : status?.baileysSession?.hasQr
                      ? "QR ready"
                      : "Needs QR"}
                </span>
              </div>
              <p className="mt-2">
                {status?.connectedAccount?.phoneNumber ?? "No linked account"}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Session: {wahaSessionName || DEFAULT_WAHA_SESSION}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Baileys: {status?.baileysSession?.status ?? "idle"}
              </p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => void handleLoadQr()}
                  disabled={refreshing || loading}
                  className="btn btn-primary text-xs"
                >
                  <QrCode className="h-3.5 w-3.5" />
                  Load QR
                </button>
                <button
                  type="button"
                  onClick={() => void handleBootstrapBaileys()}
                  disabled={refreshing || loading}
                  className="btn btn-secondary text-xs"
                >
                  Save Session
                </button>
              </div>
              {qrResponse?.qrDataUrl ? (
                <img
                  src={qrResponse.qrDataUrl}
                  alt="Baileys WhatsApp QR"
                  className="mt-4 aspect-square w-full rounded-2xl border border-slate-200 bg-white p-3"
                />
              ) : null}
            </div>
          </aside>
        </section>
      </div>
    </AppShell>
  );
}
