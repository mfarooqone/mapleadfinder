"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  LoaderCircle,
  QrCode,
  Smartphone,
  Unlink,
  Zap,
} from "lucide-react";
import {
  type TestingStatus,
  type WahaQrResponse,
  type LeadRecord,
  type WahaBulkSendResponse,
  type WahaBulkCampaignProgress,
  type OutreachStats,
  type ScrapeBatch,
  type TemplateRecord,
  fetchBaileysStatus,
  fetchOutreachStats,
  fetchWahaBulkProgress,
  stopWahaBulkCampaign,
  getJson,
  patchJson,
  postJson,
} from "@/lib/backend";
import AppShell from "./AppShell";
import PageHeader, { PageLink } from "./PageHeader";
import StatusBanner, { type BannerState } from "./StatusBanner";
import StepCard from "./StepCard";
import WahaCampaignPanel, {
  DEFAULT_MESSAGE_TEMPLATE,
  DEFAULT_VOICE_MIMETYPE,
} from "./WahaCampaignPanel";
import WahaContactPicker, { isBulkEligible } from "./WahaContactPicker";

const DEFAULT_SESSION = "default";
const BULK_CAMPAIGN_STORAGE_KEY = "lead_outreach_last_bulk_campaign";

function getQrImageSource(response: WahaQrResponse | null) {
  const mimetype = response?.qr?.mimetype ?? "image/png";
  const data = response?.qr?.data;
  if (!data) return null;
  return `data:${mimetype};base64,${data}`;
}

export default function WahaSetupWorkspace() {
  const [contacts, setContacts] = useState<LeadRecord[]>([]);
  const [scrapeBatches, setScrapeBatches] = useState<ScrapeBatch[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState("");
  const [selectedContactId, setSelectedContactId] = useState("");
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [recipientPhone, setRecipientPhone] = useState("");
  const [templates, setTemplates] = useState<TemplateRecord[]>([]);
  const [selectedBulkTemplateId, setSelectedBulkTemplateId] = useState("");
  const [messageTemplate, setMessageTemplate] = useState(DEFAULT_MESSAGE_TEMPLATE);
  const [sendMode, setSendMode] = useState<"text" | "voice">("text");
  const [voiceSourceMode, setVoiceSourceMode] = useState<"url" | "file">("url");
  const [voiceUrl, setVoiceUrl] = useState("");
  const [voiceData, setVoiceData] = useState("");
  const [voiceFilename, setVoiceFilename] = useState("");
  const [voiceMimetype, setVoiceMimetype] = useState(DEFAULT_VOICE_MIMETYPE);
  const [voiceConvert, setVoiceConvert] = useState(false);
  const [minDelaySeconds, setMinDelaySeconds] = useState(90);
  const [maxDelaySeconds, setMaxDelaySeconds] = useState(180);
  const [outreachStats, setOutreachStats] = useState<OutreachStats | null>(null);
  const [lastBulkResponse, setLastBulkResponse] = useState<WahaBulkSendResponse | null>(null);
  const [campaignProgress, setCampaignProgress] =
    useState<WahaBulkCampaignProgress | null>(null);
  const [status, setStatus] = useState<TestingStatus | null>(null);
  const [baileysStatus, setBaileysStatus] = useState<TestingStatus | null>(null);
  const [qrResponse, setQrResponse] = useState<WahaQrResponse | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [bootstrapping, setBootstrapping] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [loadingQr, setLoadingQr] = useState(false);
  const [sending, setSending] = useState(false);
  const [queueingBatch, setQueueingBatch] = useState(false);
  const [stoppingCampaign, setStoppingCampaign] = useState(false);
  const [optingInSkippedContacts, setOptingInSkippedContacts] = useState(false);
  const [banner, setBanner] = useState<BannerState>(null);
  const autoSaveAttemptRef = useRef<string | null>(null);

  const sessionStatus = status?.wahaSession?.status ?? "NOT_CREATED";
  const qrImageSource = useMemo(() => getQrImageSource(qrResponse), [qrResponse]);
  const sortedContacts = useMemo(
    () => [...contacts].sort((a, b) => (a.name ?? a.phone).localeCompare(b.name ?? b.phone)),
    [contacts],
  );
  const previewContact =
    sortedContacts.find((c) => c.id === selectedContactId) ??
    sortedContacts.find((c) => selectedContactIds.includes(c.id)) ??
    null;
  const selectedFirstName = previewContact?.name?.trim().split(/\s+/)[0] ?? "there";
  const renderedMessage = useMemo(
    () =>
      messageTemplate
        .replaceAll("{{firstName}}", selectedFirstName)
        .replaceAll("{{name}}", selectedFirstName)
        .replaceAll("{{seoPoint}}", "")
        .replaceAll("{{website}}", previewContact?.website ?? ""),
    [messageTemplate, previewContact?.website, selectedFirstName],
  );
  const whatsappTemplates = useMemo(
    () => templates.filter((template) => (template.channel ?? "WHATSAPP") === "WHATSAPP"),
    [templates],
  );

  const connectedPhone =
    status?.connectedAccount?.phoneNumber ?? status?.me?.id ?? "Not linked yet";
  const hasAccount = Boolean(status?.connectedAccount);
  const envReady = Boolean(status?.envReady);
  const hasBaileysVoice = Boolean(
    baileysStatus?.connectedAccount && baileysStatus?.baileysSession?.connected,
  );
  const canSend = sendMode === "voice" ? hasBaileysVoice : hasAccount;
  const requireIncoming = outreachStats?.requireIncoming ?? false;
  const eligibleSelectedCount = useMemo(
    () =>
      sortedContacts.filter(
        (contact) =>
          selectedContactIds.includes(contact.id) &&
          isBulkEligible(contact, requireIncoming),
      ).length,
    [requireIncoming, selectedContactIds, sortedContacts],
  );
  const waitingForQr =
    !hasAccount &&
    (sessionStatus === "SCAN_QR_CODE" || sessionStatus === "STARTING");
  const primaryActionLabel = hasAccount
    ? "Number saved"
    : status?.me?.id || sessionStatus === "WORKING"
      ? "Save linked number"
      : waitingForQr
        ? "Session started — scan QR below"
        : "Start connection";

  const loadStatus = async () => {
    const [data, baileys] = await Promise.all([
      getJson<TestingStatus>(
        `/whatsapp/testing/waha/status?sessionName=${encodeURIComponent(DEFAULT_SESSION)}`,
      ),
      fetchBaileysStatus(DEFAULT_SESSION).catch(() => null),
    ]);
    setStatus(data);
    setBaileysStatus(baileys);
    return data;
  };

  const loadBatches = async () => {
    const data = await getJson<ScrapeBatch[]>("/scrape/batches").catch(
      () => [] as ScrapeBatch[],
    );
    setScrapeBatches(data);
    return data;
  };

  const loadTemplates = async () => {
    const data = await getJson<TemplateRecord[]>("/templates?channel=WHATSAPP").catch(
      () => [] as TemplateRecord[],
    );
    setTemplates(data);
    return data;
  };

  const loadContacts = async (batchId = selectedBatchId) => {
    const data = await getJson<LeadRecord[]>(
      batchId
        ? `/scrape/batches/${encodeURIComponent(batchId)}/leads`
        : "/leads",
    );
    setContacts(data);
    setSelectedContactIds((current) => {
      const visibleIds = new Set(data.map((lead) => lead.id));
      return current.filter((id) => visibleIds.has(id));
    });
    setSelectedContactId((current) =>
      current && data.some((lead) => lead.id === current) ? current : "",
    );
    return data;
  };

  const handleSelectBatch = async (batchId: string) => {
    setSelectedBatchId(batchId);
    setSelectedContactIds([]);
    setSelectedContactId("");
    await loadContacts(batchId);
  };

  const loadOutreachStats = async (accountId?: string) => {
    try {
      const stats = await fetchOutreachStats(accountId);
      setOutreachStats(stats);
      return stats;
    } catch {
      setOutreachStats(null);
      return null;
    }
  };

  const loadCampaignProgress = async (campaignId?: string | null) => {
    const progress = await fetchWahaBulkProgress(campaignId);
    setCampaignProgress(progress.total > 0 ? progress : null);
    if (progress.campaignId && typeof window !== "undefined") {
      window.localStorage.setItem(BULK_CAMPAIGN_STORAGE_KEY, progress.campaignId);
    }
    return progress;
  };

  const handleBootstrap = async () => {
    setBootstrapping(true);
    setBanner(null);
    try {
      const response = await postJson<
        {
          sessionName: string;
          nextStep?: string;
          accountSaved?: boolean;
          session?: { status?: string };
        },
        { sessionName: string }
      >("/whatsapp/testing/waha/bootstrap", { sessionName: DEFAULT_SESSION });
      const data = await loadStatus();
      const sessionState =
        response.session?.status ?? data.wahaSession?.status ?? "";
      const needsQr = !response.accountSaved && !data.connectedAccount;

      if (needsQr) {
        setBanner({
          type: "info",
          message:
            sessionState === "SCAN_QR_CODE"
              ? "Session started. Scroll to Step 2, load the QR, and scan it with your phone."
              : (response.nextStep ??
                "Session started. Load the QR in Step 2 and scan with WhatsApp."),
        });
        if (sessionState === "SCAN_QR_CODE") {
          await handleLoadQr();
          setBanner({
            type: "info",
            message:
              "QR loaded below. Open WhatsApp on your phone → Linked Devices → Link a device → scan.",
          });
        }
      } else {
        setBanner({
          type: "success",
          message: response.nextStep ?? data.nextStep ?? "WhatsApp number linked.",
        });
      }
    } catch (error) {
      setBanner({
        type: "error",
        message: error instanceof Error ? error.message : "Could not start the session.",
      });
    } finally {
      setBootstrapping(false);
    }
  };

  const handleLoadQr = async () => {
    setLoadingQr(true);
    setBanner(null);
    try {
      const response = await getJson<WahaQrResponse>(
        `/whatsapp/testing/waha/qr?sessionName=${encodeURIComponent(DEFAULT_SESSION)}`,
      );
      setQrResponse(response);
      if (response.alreadyLinked) {
        setBanner({
          type: "info",
          message:
            response.hint ??
            "Session is already linked. Use Change number below to scan a different phone.",
        });
        return;
      }
      setBanner({
        type: "info",
        message:
          response.hint ??
          (getQrImageSource(response)
            ? "QR ready — scan it with WhatsApp Linked Devices."
            : "QR not ready yet. Wait a few seconds and try again."),
      });
    } catch (error) {
      setBanner({
        type: "error",
        message: error instanceof Error ? error.message : "Could not load QR.",
      });
    } finally {
      setLoadingQr(false);
      await loadStatus();
    }
  };

  const handleChangeNumber = async () => {
    const label = connectedPhone !== "Not linked yet" ? connectedPhone : "this account";
    if (
      !window.confirm(
        `Disconnect ${label} from this login?\n\nYou will need to scan a QR code with the new phone. Old messages in the inbox stay, but sends will use the new number.`,
      )
    ) {
      return;
    }

    setDisconnecting(true);
    setBanner(null);
    setQrResponse(null);
    autoSaveAttemptRef.current = null;

    try {
      const response = await postJson<
        { nextStep?: string; removedAccountPhone?: string | null },
        { sessionName: string }
      >("/whatsapp/testing/waha/disconnect", { sessionName: DEFAULT_SESSION });
      const data = await loadStatus();
      await loadOutreachStats();
      setBanner({
        type: "success",
        message:
          response.nextStep ??
          "Number disconnected. Click Start connection, then Load QR, and scan with the new phone.",
      });
      if (data.wahaSession?.status === "SCAN_QR_CODE") {
        await handleLoadQr();
      }
    } catch (error) {
      setBanner({
        type: "error",
        message: error instanceof Error ? error.message : "Could not disconnect number.",
      });
    } finally {
      setDisconnecting(false);
    }
  };

  const handleRefresh = async () => {
    setLoadingStatus(true);
    try {
      const data = await loadStatus();
      await loadBatches();
      await loadContacts();
      await loadOutreachStats(data?.connectedAccount?.id);
      setBanner({ type: "info", message: data.nextStep ?? "Status refreshed." });
    } catch (error) {
      setBanner({
        type: "error",
        message: error instanceof Error ? error.message : "Refresh failed.",
      });
    } finally {
      setLoadingStatus(false);
    }
  };

  const buildVoicePayload = () => {
    if (voiceSourceMode === "url") {
      if (!voiceUrl.trim()) throw new Error("Enter a voice file URL.");
      return {
        url: voiceUrl.trim(),
        mimetype: voiceMimetype.trim() || DEFAULT_VOICE_MIMETYPE,
        convert: voiceConvert,
      };
    }
    if (!voiceData.trim()) throw new Error("Upload an audio file.");
    return {
      data: voiceData.trim(),
      filename: voiceFilename.trim() || undefined,
      mimetype: voiceMimetype.trim() || DEFAULT_VOICE_MIMETYPE,
      convert: voiceConvert,
    };
  };

  const handleSendTest = async () => {
    setSending(true);
    setBanner(null);
    try {
      if (sendMode === "voice") {
        const voice = buildVoicePayload();
        const response = await postJson<{ note?: string }, { to: string } & typeof voice>(
          "/whatsapp/testing/baileys/send-voice",
          { to: recipientPhone.trim(), ...voice },
        );
        setBanner({ type: "success", message: response.note ?? "Voice note sent." });
      } else {
        const response = await postJson<
          { note?: string },
          { to: string; message: string }
        >("/whatsapp/testing/waha/send", {
          to: recipientPhone.trim(),
          message: renderedMessage.trim(),
        });
        setBanner({ type: "success", message: response.note ?? "Test message sent." });
      }
      const statusData = await loadStatus();
      await loadContacts();
      await loadOutreachStats(statusData?.connectedAccount?.id);
    } catch (error) {
      setBanner({
        type: "error",
        message: error instanceof Error ? error.message : "Send failed.",
      });
    } finally {
      setSending(false);
    }
  };

  const handleQueueBatch = async () => {
    setQueueingBatch(true);
    setBanner(null);
    setLastBulkResponse(null);
    try {
      if (sendMode === "voice") {
        const voice = buildVoicePayload();
        const response = await postJson<
          WahaBulkSendResponse,
          {
            leadIds: string[];
            messageType: "voice";
            minDelaySeconds: number;
            maxDelaySeconds: number;
          } & typeof voice
        >("/whatsapp/testing/waha/bulk-send", {
          leadIds: selectedContactIds,
          messageType: "voice",
          minDelaySeconds,
          maxDelaySeconds,
          ...voice,
        });
        setLastBulkResponse(response);
        if (response.campaignId && typeof window !== "undefined") {
          window.localStorage.setItem(BULK_CAMPAIGN_STORAGE_KEY, response.campaignId);
        }
        await loadCampaignProgress(response.campaignId);
        setBanner({ type: "success", message: response.note ?? "Voice queue created." });
      } else {
        const response = await postJson<
          WahaBulkSendResponse,
          {
            leadIds: string[];
            messageTemplate: string;
            minDelaySeconds: number;
            maxDelaySeconds: number;
            enableSeoResearch: boolean;
          }
        >("/whatsapp/testing/waha/bulk-send", {
          leadIds: selectedContactIds,
          messageTemplate,
          minDelaySeconds,
          maxDelaySeconds,
          enableSeoResearch: true,
        });
        setLastBulkResponse(response);
        if (response.campaignId && typeof window !== "undefined") {
          window.localStorage.setItem(BULK_CAMPAIGN_STORAGE_KEY, response.campaignId);
        }
        await loadCampaignProgress(response.campaignId);
        setBanner({ type: "success", message: response.note ?? "Bulk queue created." });
      }
    } catch (error) {
      setBanner({
        type: "error",
        message: error instanceof Error ? error.message : "Bulk queue failed.",
      });
    } finally {
      setQueueingBatch(false);
    }
  };

  const handleStopCampaign = async () => {
    const campaignId = campaignProgress?.campaignId ?? lastBulkResponse?.campaignId;
    if (!campaignId) return;

    setStoppingCampaign(true);
    setBanner(null);
    try {
      const response = await stopWahaBulkCampaign(campaignId);
      const progress = await loadCampaignProgress(campaignId);
      setCampaignProgress(progress.total > 0 ? progress : null);
      setBanner({
        type: "success",
        message: response.note ?? `Stopped ${response.stopped} pending message(s).`,
      });
    } catch (error) {
      setBanner({
        type: "error",
        message: error instanceof Error ? error.message : "Could not stop campaign.",
      });
    } finally {
      setStoppingCampaign(false);
    }
  };

  const handleOptInSkippedContacts = async (leadIds: string[]) => {
    const uniqueLeadIds = [...new Set(leadIds)].filter(Boolean);
    if (!uniqueLeadIds.length) return;

    if (
      !window.confirm(
        `Mark ${uniqueLeadIds.length} skipped contact(s) as opted-in for WhatsApp outreach? Only continue if you have consent.`,
      )
    ) {
      return;
    }

    setOptingInSkippedContacts(true);
    setBanner(null);

    try {
      const response = await patchJson<
        { updated:boolean; count:number; optIn:boolean; ids:string[] },
        { ids:string[]; optIn:boolean }
      >("/leads/bulk/opt-in", { ids: uniqueLeadIds, optIn: true });
      await loadContacts();
      setLastBulkResponse((current) =>
        current
          ? {
              ...current,
              skippedNotOptedIn: current.skippedNotOptedIn?.filter(
                (contact) => !uniqueLeadIds.includes(contact.leadId),
              ),
              note: `${response.count} contact(s) marked opted-in. Queue bulk send again to re-check eligibility.`,
            }
          : current,
      );
      setBanner({
        type: "success",
        message: `${response.count} contact(s) marked opted-in. Queue bulk send again.`,
      });
    } catch (error) {
      setBanner({
        type: "error",
        message: error instanceof Error ? error.message : "Could not mark contacts opted-in.",
      });
    } finally {
      setOptingInSkippedContacts(false);
    }
  };

  const handleVoiceFileSelect = (file: File) => {
    setVoiceFilename(file.name);
    setVoiceMimetype(file.type || DEFAULT_VOICE_MIMETYPE);
    setVoiceConvert(!file.name.endsWith(".opus") && !file.name.endsWith(".ogg"));
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      setVoiceData(result.includes(",") ? (result.split(",")[1] ?? "") : result);
    };
    reader.onerror = () => setBanner({ type: "error", message: "Could not read audio file." });
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const data = await loadStatus();
        await loadBatches();
        await loadTemplates();
        await loadContacts();
        await loadOutreachStats(data?.connectedAccount?.id);
        const storedCampaignId =
          typeof window !== "undefined"
            ? window.localStorage.getItem(BULK_CAMPAIGN_STORAGE_KEY)
            : null;
        await loadCampaignProgress(storedCampaignId).catch(() => null);
        if (!active) return;
        setBanner({
          type: "info",
          message: data.nextStep ?? "Link your WhatsApp number using the steps below.",
        });
      } catch (error) {
        if (!active) return;
        setBanner({
          type: "error",
          message: error instanceof Error ? error.message : "Could not load setup status.",
        });
      } finally {
        if (active) setLoadingStatus(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!campaignProgress?.campaignId) return;
    if (campaignProgress.pending === 0 && campaignProgress.processing === 0) return;

    const id = window.setInterval(() => {
      void loadCampaignProgress(campaignProgress.campaignId);
    }, 10000);

    return () => window.clearInterval(id);
  }, [campaignProgress?.campaignId, campaignProgress?.pending, campaignProgress?.processing]);

  useEffect(() => {
    if (!previewContact) return;
    setRecipientPhone(previewContact.phone);
  }, [previewContact]);

  useEffect(() => {
    if (!status) return;
    if (status.wahaSession?.status === "WORKING") {
      setQrResponse(null);
      return;
    }
    if (
      status.wahaSession?.status !== "STARTING" &&
      status.wahaSession?.status !== "SCAN_QR_CODE"
    ) {
      return;
    }
    const id = window.setTimeout(() => void loadStatus(), 3000);
    return () => window.clearTimeout(id);
  }, [status]);

  useEffect(() => {
    const linkedPhoneId = status?.me?.id ?? null;
    if (!linkedPhoneId || status?.connectedAccount) {
      autoSaveAttemptRef.current = null;
      return;
    }
    if (autoSaveAttemptRef.current === linkedPhoneId || bootstrapping) return;
    autoSaveAttemptRef.current = linkedPhoneId;
    setBanner({ type: "info", message: "Phone linked — saving to your account…" });
    void handleBootstrap();
  }, [status?.me?.id, status?.connectedAccount, bootstrapping]);

  return (
    <AppShell
      onRefresh={() => void handleRefresh()}
      refreshing={loadingStatus}
      contentClassName="max-w-4xl"
    >
      <div className="flex flex-col gap-4 pb-20 xl:pb-6">
        <PageHeader
          title="WhatsApp setup"
          description="One number per login. Create a session, scan the QR, then send messages."
          actions={
            <>
              <PageLink href="/dashboard/contacts">Contacts</PageLink>
              <PageLink href="/dashboard/whatsapp/voice">Voice</PageLink>
              <span
                className={`badge ${hasAccount ? "badge-success" : "badge-warning"}`}
              >
                {sessionStatus.replace(/_/g, " ")}
              </span>
            </>
          }
        />

        <StatusBanner banner={banner} />

        <StepCard
          step={1}
          title="Connect your number"
          description="Each login can link one WhatsApp number. Need another? Ask an admin to create a separate user."
        >
          {waitingForQr ? (
            <div className="hint-box hint-box-info mb-4">
              <strong>Next:</strong> Go to Step 2 below, click <strong>Load QR</strong>, then
              scan with WhatsApp → Linked Devices → Link a device. After scanning, this page
              will save your number automatically.
            </div>
          ) : null}

          {hasAccount ? (
            <div className="hint-box hint-box-warning mb-4">
              <strong>Linked:</strong> {connectedPhone}. To use a different number, click{" "}
              <strong>Change number</strong> below — Load QR alone will not work while the
              current session is active.
            </div>
          ) : null}

          <div className="status-row mb-4">
            <div className="status-item">
              <p className="status-item-label">Your number</p>
              <p className="status-item-value flex items-center gap-1.5">
                <Smartphone className="h-4 w-4 text-green-600" />
                {connectedPhone}
              </p>
            </div>
            <div className="status-item">
              <p className="status-item-label">Saved in backend</p>
              <p className="status-item-value flex items-center gap-1.5">
                {hasAccount ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : null}
                {hasAccount ? "Ready to send" : "Not saved yet"}
              </p>
            </div>
            <div className="status-item">
              <p className="status-item-label">Server</p>
              <p className="status-item-value">{envReady ? "Ready" : "Needs config"}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void handleBootstrap()}
              disabled={bootstrapping || hasAccount || disconnecting}
              className="btn btn-primary"
            >
              {bootstrapping ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <Zap className="h-4 w-4" />
              )}
              {primaryActionLabel}
            </button>

            {hasAccount ? (
              <button
                type="button"
                onClick={() => void handleChangeNumber()}
                disabled={disconnecting || bootstrapping}
                className="btn btn-secondary"
              >
                {disconnecting ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <Unlink className="h-4 w-4" />
                )}
                {disconnecting ? "Disconnecting…" : "Change number"}
              </button>
            ) : null}
          </div>

          <div className="mt-6 border-t border-neutral-200 pt-6">
            <p className="section-label mb-3">Contacts for bulk send</p>
            <WahaContactPicker
              contacts={contacts}
              selectedContactId={selectedContactId}
              selectedContactIds={selectedContactIds}
              onSelectContact={setSelectedContactId}
              onToggleContact={(id) =>
                setSelectedContactIds((current) =>
                  current.includes(id)
                    ? current.filter((x) => x !== id)
                    : [...current, id],
                )
              }
              onSelectAll={(ids) => setSelectedContactIds(ids)}
              onClearAll={() => setSelectedContactIds([])}
              scrapeBatches={scrapeBatches}
              selectedBatchId={selectedBatchId}
              onSelectBatch={(batchId) => void handleSelectBatch(batchId)}
              requireIncoming={requireIncoming}
              onSelectEngagedOnly={() =>
                setSelectedContactIds(
                  sortedContacts
                    .filter((contact) => isBulkEligible(contact, requireIncoming))
                    .map((contact) => contact.id),
                )
              }
            />
          </div>
        </StepCard>

        <StepCard
          step={2}
          title="Scan QR code"
          description="Open WhatsApp → Linked Devices → Link a device, then scan."
          actions={
            <button
              type="button"
              onClick={() => void handleLoadQr()}
              disabled={loadingQr}
              className="btn btn-primary"
            >
              {loadingQr ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <QrCode className="h-4 w-4" />
              )}
              {loadingQr ? "Loading…" : "Load QR"}
            </button>
          }
        >
          <div className="flex min-h-[280px] items-center justify-center rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-6">
            {qrImageSource ? (
              <img
                src={qrImageSource}
                alt="WhatsApp QR code"
                className="max-w-[260px] rounded-lg border border-neutral-200 bg-white p-3"
              />
            ) : (
              <div className="text-center">
                <QrCode className="mx-auto h-10 w-10 text-neutral-400" />
                <p className="mt-3 text-sm font-medium text-neutral-900">
                  QR will appear here
                </p>
                <p className="mt-1 text-xs text-neutral-500">
                  Click Load QR after starting the session.
                </p>
              </div>
            )}
          </div>
          <ol className="mt-4 list-inside list-decimal space-y-1 text-sm text-neutral-600">
            <li>Start connection (step 1)</li>
            <li>Load QR and scan with your phone</li>
            <li>Wait for status WORKING — number saves automatically</li>
          </ol>
        </StepCard>

        <StepCard
          step={3}
          title="Send messages"
          description="Send one test message or queue a bulk campaign with delays."
        >
          <WahaCampaignPanel
            sendMode={sendMode}
            onSendModeChange={setSendMode}
            voiceSourceMode={voiceSourceMode}
            onVoiceSourceModeChange={setVoiceSourceMode}
            templates={whatsappTemplates}
            selectedTemplateId={selectedBulkTemplateId}
            onSelectedTemplateIdChange={setSelectedBulkTemplateId}
            messageTemplate={messageTemplate}
            onMessageTemplateChange={setMessageTemplate}
            voiceUrl={voiceUrl}
            onVoiceUrlChange={setVoiceUrl}
            voiceFilename={voiceFilename}
            onVoiceFilenameChange={setVoiceFilename}
            voiceMimetype={voiceMimetype}
            onVoiceMimetypeChange={setVoiceMimetype}
            voiceConvert={voiceConvert}
            onVoiceConvertChange={setVoiceConvert}
            onVoiceFileSelect={handleVoiceFileSelect}
            minDelaySeconds={minDelaySeconds}
            onMinDelaySecondsChange={setMinDelaySeconds}
            maxDelaySeconds={maxDelaySeconds}
            onMaxDelaySecondsChange={setMaxDelaySeconds}
            selectedCount={selectedContactIds.length}
            canSend={canSend}
            queueingBatch={queueingBatch}
            onQueueBatch={() => void handleQueueBatch()}
            onOptInSkippedContacts={(ids) => void handleOptInSkippedContacts(ids)}
            optingInSkippedContacts={optingInSkippedContacts}
            onStopCampaign={() => void handleStopCampaign()}
            stoppingCampaign={stoppingCampaign}
            lastBulkResponse={lastBulkResponse}
            campaignProgress={campaignProgress}
            outreachStats={outreachStats}
            eligibleCount={eligibleSelectedCount}
            selectedCountTotal={selectedContactIds.length}
          />
        </StepCard>

        <p className="text-center text-xs text-neutral-500">
          <Link href="/dashboard" className="text-green-700 hover:underline">
            ← Back to dashboard
          </Link>
        </p>
      </div>
    </AppShell>
  );
}
