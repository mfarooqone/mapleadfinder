"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { QrCode, RefreshCw, Users } from "lucide-react";
import {
  getJson,
  patchJson,
  postJson,
  fetchOutreachStats,
  fetchWahaBulkProgress,
  stopWahaBulkCampaign,
  type LeadRecord,
  type OutreachStats,
  type ScrapeBatch,
  type TestingStatus,
  type WahaBulkCampaignProgress,
  type WahaBulkSendResponse,
} from "@/lib/backend";
import AppShell from "./AppShell";
import PageHeader, { PageLink } from "./PageHeader";
import StatusBanner, { type BannerState } from "./StatusBanner";
import TestMessageComposer from "./Testmessagecomposer";
import WhatsAppConnectionCard from "./Whatsappconnectioncard";
import WahaCampaignPanel, {
  DEFAULT_MESSAGE_TEMPLATE,
  DEFAULT_VOICE_MIMETYPE,
} from "./WahaCampaignPanel";
import WahaContactPicker, { isBulkEligible } from "./WahaContactPicker";
import {
  DEFAULT_TEST_MESSAGE,
  DEFAULT_WAHA_SESSION,
  fetchLeads,
  fetchWhatsappWorkspaceData,
} from "./dashboard-data";

const BULK_CAMPAIGN_STORAGE_KEY = "lead_outreach_last_bulk_campaign";

export default function WhatsappWorkspace() {
  const [status, setStatus] = useState<TestingStatus | null>(null);
  const [accounts, setAccounts] = useState<
    Awaited<ReturnType<typeof fetchWhatsappWorkspaceData>>["accounts"]
  >([]);
  const [templates, setTemplates] = useState<
    Awaited<ReturnType<typeof fetchWhatsappWorkspaceData>>["templates"]
  >([]);
  const [contacts, setContacts] = useState<LeadRecord[]>([]);
  const [scrapeBatches, setScrapeBatches] = useState<ScrapeBatch[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState("");
  const [selectedContactId, setSelectedContactId] = useState("");
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [recipientPhone, setRecipientPhone] = useState("");
  const [testMessage, setTestMessage] = useState(DEFAULT_TEST_MESSAGE);
  const [selectedBulkTemplateId, setSelectedBulkTemplateId] = useState("");
  const [messageTemplate, setMessageTemplate] = useState(DEFAULT_MESSAGE_TEMPLATE);
  const sendMode = "text" as const;
  const [minDelaySeconds, setMinDelaySeconds] = useState(90);
  const [maxDelaySeconds, setMaxDelaySeconds] = useState(180);
  const [outreachStats, setOutreachStats] = useState<OutreachStats | null>(null);
  const [lastBulkResponse, setLastBulkResponse] = useState<WahaBulkSendResponse | null>(null);
  const [campaignProgress, setCampaignProgress] =
    useState<WahaBulkCampaignProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [queueingBatch, setQueueingBatch] = useState(false);
  const [stoppingCampaign, setStoppingCampaign] = useState(false);
  const [optingInSkippedContacts, setOptingInSkippedContacts] = useState(false);
  const [loadingQr, setLoadingQr] = useState(false);
  const [qrValue, setQrValue] = useState<string | null>(null);
  const [banner, setBanner] = useState<BannerState>(null);

  const sortedContacts = useMemo(
    () => [...contacts].sort((a, b) => (a.name ?? a.phone).localeCompare(b.name ?? b.phone)),
    [contacts],
  );
  const whatsappTemplates = useMemo(
    () => templates.filter((template) => (template.channel ?? "WHATSAPP") === "WHATSAPP"),
    [templates],
  );
  const previewContact =
    sortedContacts.find((c) => c.id === selectedContactId) ??
    sortedContacts.find((c) => selectedContactIds.includes(c.id)) ??
    null;
  const connected = Boolean(status?.connectedAccount);
  const linkedPhone = status?.connectedAccount?.phoneNumber ?? "Not linked";
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

  const loadContactsForBatch = async (batchId: string) => {
    const leads = batchId
      ? await getJson<LeadRecord[]>(
          `/scrape/batches/${encodeURIComponent(batchId)}/leads`,
        )
      : await fetchLeads().catch(() => [] as LeadRecord[]);
    setContacts(leads);
    setSelectedContactIds((current) => {
      const visibleIds = new Set(leads.map((lead) => lead.id));
      return current.filter((id) => visibleIds.has(id));
    });
    setSelectedContactId((current) =>
      current && leads.some((lead) => lead.id === current) ? current : "",
    );
    return leads;
  };

  const loadWorkspace = async () => {
    const [data, batches] = await Promise.all([
      fetchWhatsappWorkspaceData(DEFAULT_WAHA_SESSION),
      getJson<ScrapeBatch[]>("/scrape/batches").catch(() => [] as ScrapeBatch[]),
    ]);
    setStatus(data.status);
    setAccounts(data.accounts);
    setTemplates(data.templates);
    setScrapeBatches(batches);
    await loadContactsForBatch(selectedBatchId);
    try {
      const stats = await fetchOutreachStats(data.status?.connectedAccount?.id);
      setOutreachStats(stats);
    } catch {
      setOutreachStats(null);
    }
    return data;
  };

  const loadCampaignProgress = async (campaignId?: string | null) => {
    const progress = await fetchWahaBulkProgress(campaignId);
    setCampaignProgress(progress.total > 0 ? progress : null);
    if (progress.campaignId && typeof window !== "undefined") {
      window.localStorage.setItem(BULK_CAMPAIGN_STORAGE_KEY, progress.campaignId);
    }
    return progress;
  };

  const handleSelectBatch = async (batchId: string) => {
    setSelectedBatchId(batchId);
    setSelectedContactIds([]);
    setSelectedContactId("");
    await loadContactsForBatch(batchId);
  };

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        await loadWorkspace();
        const storedCampaignId =
          typeof window !== "undefined"
            ? window.localStorage.getItem(BULK_CAMPAIGN_STORAGE_KEY)
            : null;
        await loadCampaignProgress(storedCampaignId).catch(() => null);
      } catch (error) {
        if (!active) return;
        setBanner({
          type: "error",
          message: error instanceof Error ? error.message : "Could not load WhatsApp page.",
        });
      } finally {
        if (active) setLoading(false);
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

  const refreshAll = async () => {
    setRefreshing(true);
    setBanner(null);
    try {
      await loadWorkspace();
      setBanner({ type: "success", message: "Refreshed." });
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
      await loadWorkspace();
      setBanner({ type: "success", message: "Session synced." });
    } catch (error) {
      setBanner({
        type: "error",
        message: error instanceof Error ? error.message : "Could not sync session.",
      });
    } finally {
      setBootstrapping(false);
    }
  };

  const handleLoadQr = async () => {
    setLoadingQr(true);
    setBanner(null);
    try {
      const response = await getJson<{ qr?: { value?: string; data?: string }; hint?: string }>(
        `/whatsapp/testing/waha/qr?sessionName=${encodeURIComponent(DEFAULT_WAHA_SESSION)}`,
      );
      setQrValue(response.qr?.value ?? response.qr?.data ?? null);
      setBanner({
        type: "info",
        message: response.hint ?? "For the full QR image, use the Setup page.",
      });
    } catch (error) {
      setBanner({
        type: "error",
        message: error instanceof Error ? error.message : "Could not fetch QR.",
      });
    } finally {
      setLoadingQr(false);
    }
  };

  const handleSendTest = async () => {
    setSendingTest(true);
    setBanner(null);
    try {
      const response = await postJson<
        { note?: string },
        { to: string; message?: string }
      >("/whatsapp/testing/waha/send", {
        to: recipientPhone.trim(),
        message: testMessage.trim(),
      });
      await loadWorkspace();
      setBanner({ type: "success", message: response.note ?? "Test message sent." });
    } catch (error) {
      setBanner({
        type: "error",
        message: error instanceof Error ? error.message : "Send failed.",
      });
    } finally {
      setSendingTest(false);
    }
  };

  const handleQueueBatch = async () => {
    setQueueingBatch(true);
    setBanner(null);
    setLastBulkResponse(null);
    try {
      const response = await postJson<
        WahaBulkSendResponse,
        {
          leadIds: string[];
          messageType?: "text" | "voice";
          messageTemplate: string;
          minDelaySeconds: number;
          maxDelaySeconds: number;
          enableSeoResearch: boolean;
        }
      >("/whatsapp/testing/waha/bulk-send", {
        leadIds: selectedContactIds,
        messageType: sendMode,
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
      await loadWorkspace();
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
      await loadWorkspace();
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

  return (
    <AppShell onRefresh={() => void refreshAll()} refreshing={refreshing}>
      <div className="flex flex-col gap-4 pb-20 xl:pb-6">
        <PageHeader
          title="WhatsApp campaigns"
          description={
            connected
              ? `Sending from ${linkedPhone}. Import contacts, search, test one, or queue a WhatsApp bulk campaign.`
              : "Link your WhatsApp number on the Setup page before sending."
          }
          actions={
            <>
              <PageLink href="/dashboard/contacts">
                <Users className="h-4 w-4" />
                Contacts
              </PageLink>
              <PageLink href="/dashboard/whatsapp/setup" primary>
                <QrCode className="h-4 w-4" />
                Setup & QR
              </PageLink>
              <PageLink href="/dashboard/templates">
                Templates
              </PageLink>
              <button
                type="button"
                onClick={() => void refreshAll()}
                disabled={refreshing}
                className="btn btn-secondary"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              </button>
            </>
          }
        />

        <StatusBanner banner={banner} />

        {!connected && !loading ? (
          <div className="hint-box hint-box-warning">
            WhatsApp is not linked yet.{" "}
            <Link href="/dashboard/whatsapp/setup" className="font-medium underline">
              Open Setup
            </Link>{" "}
            to scan the QR code.
          </div>
        ) : null}

        <div className="hint-box hint-box-info text-sm">
          <strong>Send to all imported contacts:</strong> import CSV on{" "}
          <Link href="/dashboard/contacts" className="font-medium underline">
            Contacts
          </Link>
          , then use <strong>Select all</strong> below, write your message, and click{" "}
          <strong>Queue bulk send</strong>. Messages go out one-by-one with safe delays
          (90–180s). If warm-up mode requires incoming messages, only engaged contacts
          are queued.
        </div>

        <section className="grid gap-4 xl:grid-cols-2">
          <WhatsAppConnectionCard
            status={status}
            accounts={accounts}
            onConnect={() => void handleBootstrap()}
            onLoadQr={() => void handleLoadQr()}
            onRefresh={() => void refreshAll()}
            qrValue={qrValue}
            connecting={bootstrapping}
            loadingQr={loadingQr}
            refreshing={refreshing}
          />

          <div className="card card-pad">
            <TestMessageComposer
              templates={whatsappTemplates}
              contacts={contacts}
              recipientPhone={recipientPhone}
              onRecipientPhoneChange={setRecipientPhone}
              onPickContact={(contact) => setSelectedContactId(contact.id)}
              message={testMessage}
              onMessageChange={setTestMessage}
              onSend={() => void handleSendTest()}
              sending={sendingTest}
              connected={connected}
            />
          </div>
        </section>

        <section className="card card-pad space-y-4">
          <div>
            <p className="section-label">Bulk send</p>
            <h2 className="text-lg font-semibold text-neutral-900">
              Send to many imported contacts
            </h2>
            <p className="mt-1 text-sm text-neutral-600">
              Search your list, tick contacts (or Select all), then queue the campaign below.
            </p>
          </div>

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

          <WahaCampaignPanel
            sendMode={sendMode}
            onSendModeChange={() => {}}
            showSendModeToggle={false}
            voiceSourceMode="url"
            onVoiceSourceModeChange={() => {}}
            templates={whatsappTemplates}
            selectedTemplateId={selectedBulkTemplateId}
            onSelectedTemplateIdChange={setSelectedBulkTemplateId}
            messageTemplate={messageTemplate}
            onMessageTemplateChange={setMessageTemplate}
            voiceUrl=""
            onVoiceUrlChange={() => {}}
            voiceFilename=""
            onVoiceFilenameChange={() => {}}
            voiceMimetype={DEFAULT_VOICE_MIMETYPE}
            onVoiceMimetypeChange={() => {}}
            voiceConvert={false}
            onVoiceConvertChange={() => {}}
            onVoiceFileSelect={() => {}}
            minDelaySeconds={minDelaySeconds}
            onMinDelaySecondsChange={setMinDelaySeconds}
            maxDelaySeconds={maxDelaySeconds}
            onMaxDelaySecondsChange={setMaxDelaySeconds}
            selectedCount={selectedContactIds.length}
            canSend={connected}
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
        </section>
      </div>
    </AppShell>
  );
}
