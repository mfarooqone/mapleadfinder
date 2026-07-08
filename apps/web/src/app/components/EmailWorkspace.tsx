"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Clock3,
  ContactRound,
  History,
  KeyRound,
  LayoutTemplate,
  Mail,
  Pause,
  Play,
  RefreshCw,
  Send,
  Settings,
  Sparkles,
  Square,
  XCircle,
} from "lucide-react";
import {
  fetchEmailBulkProgress,
  fetchEmailCampaigns,
  enrichDecisionMakers,
  getJson,
  pauseEmailBulkCampaign,
  postJson,
  resumeEmailBulkCampaign,
  retryFailedEmailBulkCampaign,
  stopEmailBulkCampaign,
  type EmailBulkCampaignProgress,
  type EmailCampaignHistoryItem,
  type EmailBulkSendResponse,
  type EmailAiProvider,
  type EmailAiSettings,
  type EmailAiSettingsPayload,
  type LeadRecord,
  type ScrapeBatch,
  type SmtpSettings,
  type TemplateRecord,
} from "@/lib/backend";
import AppShell from "./AppShell";
import PageHeader, { PageLink } from "./PageHeader";
import StatusBanner, { type BannerState } from "./StatusBanner";
import { fetchLeads } from "./dashboard-data";

const EMAIL_CAMPAIGN_STORAGE_KEY = "lead_outreach_last_email_campaign";
const EMAIL_TEMPLATE_STORAGE_KEY = "lead_outreach_last_email_template";
const EMAIL_SEND_DELAY_SECONDS = 15;
const DECISION_MAKER_BATCH_SIZE = 50;
const BLOCKED_EMAIL_DOMAINS = new Set([
  "10minutemail.com",
  "domain.com",
  "example.com",
  "example.net",
  "example.org",
  "guerrillamail.com",
  "invalid.com",
  "mailinator.com",
  "temp-mail.org",
  "tempmail.com",
  "test.com",
  "throwawaymail.com",
  "yopmail.com",
]);

function getEmailValidationError(email?: string | null) {
  const normalized = email?.trim().toLowerCase();
  if (!normalized) return "No email address";

  const emailPattern =
    /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i;
  if (!emailPattern.test(normalized)) return "Invalid email format";

  const [localPart, domain] = normalized.split("@");
  if (!localPart || localPart.length > 64 || !domain || domain.length > 253) {
    return "Invalid email length";
  }

  if (BLOCKED_EMAIL_DOMAINS.has(domain)) {
    return "Fake or temporary email domain";
  }

  return null;
}

function getContactEmail(contact: LeadRecord) {
  return contact.preferredEmail ?? contact.email ?? null;
}

function chunkIds(ids: string[], size: number) {
  const chunks: string[][] = [];

  for (let index = 0; index < ids.length; index += size) {
    chunks.push(ids.slice(index, index + size));
  }

  return chunks;
}

function hasUsableEmail(contact: LeadRecord) {
  return getEmailValidationError(getContactEmail(contact)) === null;
}

const DEFAULT_SUBJECT = "Quick support for {{name}}";

const DEFAULT_BODY = `Dear {{firstName}},

I wanted to briefly introduce Al Kasir Metal Scrap Trading. We purchase all kinds of metal scrap and cable scrap, and also support demolition, heavy machinery buying and rental, land filling, dead stock purchasing, and site cleaning.

Given {{name}}'s work in {{category}}, our team may be able to help with reliable cleanup, material handling, or scrap purchasing when needed.

Would exploring how our services could support {{name}} be worthwhile? If this is not directly within your scope, I would appreciate it if you could point me toward the right person.

Thank You
Regard
Managing Director
Saud Danish
Mobile: +971557568720
Email: sauddanish@alkasirscrap.com`;

export default function EmailWorkspace() {
  const [contacts, setContacts] = useState<LeadRecord[]>([]);
  const [scrapeBatches, setScrapeBatches] = useState<ScrapeBatch[]>([]);
  const [templates, setTemplates] = useState<TemplateRecord[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [selectedBatchId, setSelectedBatchId] = useState("");
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [subjectTemplate, setSubjectTemplate] = useState(DEFAULT_SUBJECT);
  const [bodyTemplate, setBodyTemplate] = useState(DEFAULT_BODY);
  const [lastResponse, setLastResponse] = useState<EmailBulkSendResponse | null>(null);
  const [progress, setProgress] = useState<EmailBulkCampaignProgress | null>(null);
  const [campaigns, setCampaigns] = useState<EmailCampaignHistoryItem[]>([]);
  const [smtpSettings, setSmtpSettings] = useState<SmtpSettings | null>(null);
  const [aiSettings, setAiSettings] = useState<EmailAiSettings | null>(null);
  const [aiForm, setAiForm] = useState<EmailAiSettingsPayload>({
    provider: "OPENAI",
    apiKey: "",
    openaiModel: "gpt-5.5",
    mistralModel: "mistral-large-latest",
    isActive: true,
  });
  const [aiPersonalizationEnabled, setAiPersonalizationEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [queueing, setQueueing] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [pausing, setPausing] = useState(false);
  const [resuming, setResuming] = useState(false);
  const [retryingFailed, setRetryingFailed] = useState(false);
  const [savingAi, setSavingAi] = useState(false);
  const [testingAi, setTestingAi] = useState(false);
  const [enrichingDecisionMakers, setEnrichingDecisionMakers] = useState(false);
  const [banner, setBanner] = useState<BannerState>(null);

  const sortedContacts = useMemo(
    () => [...contacts].sort((a, b) => (a.name ?? a.email ?? "").localeCompare(b.name ?? b.email ?? "")),
    [contacts],
  );
  const filteredContacts = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return sortedContacts;
    return sortedContacts.filter(
      (contact) =>
        (contact.name ?? "").toLowerCase().includes(needle) ||
        (contact.email ?? "").toLowerCase().includes(needle) ||
        (contact.preferredEmail ?? "").toLowerCase().includes(needle) ||
        (contact.bestDecisionMaker?.name ?? "").toLowerCase().includes(needle) ||
        (contact.bestDecisionMaker?.title ?? "").toLowerCase().includes(needle) ||
        (contact.website ?? "").toLowerCase().includes(needle) ||
        (contact.category ?? "").toLowerCase().includes(needle),
    );
  }, [search, sortedContacts]);
  const emailContacts = sortedContacts.filter(hasUsableEmail);
  const invalidEmailCount = sortedContacts.filter(
    (contact) => Boolean(getContactEmail(contact)) && !hasUsableEmail(contact),
  ).length;
  const selectedWithEmail = sortedContacts.filter(
    (contact) => selectedContactIds.includes(contact.id) && hasUsableEmail(contact),
  ).length;
  const selectedProviderHasKey = Boolean(
    aiSettings?.providerKeys?.[aiForm.provider] ??
      (aiSettings?.provider === aiForm.provider && aiSettings?.hasApiKey),
  );
  const aiModelOptions = aiSettings?.models?.options ?? {
    OPENAI: ["gpt-5.5", "gpt-5.4", "gpt-5-mini", "gpt-4.1", "gpt-4.1-mini", "gpt-4o-mini"],
    MISTRAL: ["mistral-large-latest", "mistral-medium-latest", "mistral-small-latest"],
  };
  const previewContact =
    sortedContacts.find((contact) => selectedContactIds.includes(contact.id)) ??
    emailContacts[0] ??
    null;
  const renderedSubject = renderEmailTemplate(subjectTemplate, previewContact);
  const renderedBody = renderEmailTemplate(bodyTemplate, previewContact);

  const loadContactsForBatch = async (batchId: string) => {
    const leads = batchId
      ? await getJson<LeadRecord[]>(`/scrape/batches/${encodeURIComponent(batchId)}/leads`)
      : await fetchLeads().catch(() => [] as LeadRecord[]);
    setContacts(leads);
    setSelectedContactIds((current) => {
      const visibleIds = new Set(leads.map((lead) => lead.id));
      return current.filter((id) => visibleIds.has(id));
    });
    return leads;
  };

  const loadWorkspace = async () => {
    const [batches, emailTemplates, settings, nextAiSettings, campaignHistory] = await Promise.all([
      getJson<ScrapeBatch[]>("/scrape/batches").catch(() => [] as ScrapeBatch[]),
      getJson<TemplateRecord[]>("/templates?channel=EMAIL").catch(() => [] as TemplateRecord[]),
      getJson<SmtpSettings>("/email/smtp-settings").catch(() => null),
      getJson<EmailAiSettings>("/email/ai-settings").catch(() => null),
      fetchEmailCampaigns().catch(() => [] as EmailCampaignHistoryItem[]),
    ]);
    setScrapeBatches(batches);
    setTemplates(emailTemplates);
    if (typeof window !== "undefined") {
      const storedTemplateId = window.localStorage.getItem(EMAIL_TEMPLATE_STORAGE_KEY);
      const storedTemplate = emailTemplates.find((template) => template.id === storedTemplateId);
      if (storedTemplate) {
        setSelectedTemplateId(storedTemplate.id);
        setSubjectTemplate(storedTemplate.subject ?? "");
        setBodyTemplate(storedTemplate.content);
      }
    }
    setSmtpSettings(settings);
    setAiSettings(nextAiSettings);
    setCampaigns(campaignHistory);
    if (nextAiSettings?.provider) {
      setAiForm({
        provider: nextAiSettings.provider,
        apiKey: "",
        openaiModel: nextAiSettings.openaiModel ?? nextAiSettings.models?.OPENAI ?? "gpt-5.5",
        mistralModel:
          nextAiSettings.mistralModel ??
          nextAiSettings.models?.MISTRAL ??
          "mistral-large-latest",
        isActive: nextAiSettings.isActive ?? true,
      });
    }
    await loadContactsForBatch(selectedBatchId);
  };

  const loadProgress = async (campaignId?: string | null) => {
    const nextProgress = await fetchEmailBulkProgress(campaignId);
    setProgress(nextProgress.total > 0 ? nextProgress : null);
    setCampaigns(await fetchEmailCampaigns().catch(() => campaigns));
    if (nextProgress.campaignId && typeof window !== "undefined") {
      window.localStorage.setItem(EMAIL_CAMPAIGN_STORAGE_KEY, nextProgress.campaignId);
    }
    return nextProgress;
  };

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        await loadWorkspace();
        const storedCampaignId =
          typeof window !== "undefined"
            ? window.localStorage.getItem(EMAIL_CAMPAIGN_STORAGE_KEY)
            : null;
        await loadProgress(storedCampaignId).catch(() => null);
      } catch (error) {
        if (!active) return;
        setBanner({
          type: "error",
          message: error instanceof Error ? error.message : "Could not load email page.",
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
    if (!progress?.campaignId) return;
    if (progress.pending === 0 && progress.processing === 0) return;
    const id = window.setInterval(() => {
      void loadProgress(progress.campaignId);
    }, 10000);
    return () => window.clearInterval(id);
  }, [progress?.campaignId, progress?.pending, progress?.processing]);

  const refreshAll = async () => {
    setRefreshing(true);
    setBanner(null);
    try {
      await loadWorkspace();
      await loadProgress(progress?.campaignId).catch(() => null);
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

  const handleSelectBatch = async (batchId: string) => {
    setSelectedBatchId(batchId);
    setSelectedContactIds([]);
    await loadContactsForBatch(batchId);
  };

  const handleSelectTemplate = (templateId: string) => {
    setSelectedTemplateId(templateId);
    if (typeof window !== "undefined") {
      if (templateId) {
        window.localStorage.setItem(EMAIL_TEMPLATE_STORAGE_KEY, templateId);
      } else {
        window.localStorage.removeItem(EMAIL_TEMPLATE_STORAGE_KEY);
      }
    }
    const template = templates.find((item) => item.id === templateId);
    if (!template) return;
    setSubjectTemplate(template.subject ?? "");
    setBodyTemplate(template.content);
  };

  const handleQueue = async () => {
    setQueueing(true);
    setBanner(null);
    setLastResponse(null);
    try {
      const response = await postJson<
        EmailBulkSendResponse,
        {
          leadIds: string[];
          subjectTemplate: string;
          bodyTemplate: string;
          minDelaySeconds: number;
          maxDelaySeconds: number;
          aiPersonalizationEnabled: boolean;
          selectedTemplateId?: string;
          campaignName?: string;
        }
      >("/email/bulk-send", {
        leadIds: selectedContactIds,
        subjectTemplate,
        bodyTemplate,
        minDelaySeconds: EMAIL_SEND_DELAY_SECONDS,
        maxDelaySeconds: EMAIL_SEND_DELAY_SECONDS,
        aiPersonalizationEnabled,
        selectedTemplateId: selectedTemplateId || undefined,
        campaignName:
          templates.find((template) => template.id === selectedTemplateId)?.name ||
          subjectTemplate.trim().slice(0, 80) ||
          undefined,
      });
      setLastResponse(response);
      if (response.campaignId && typeof window !== "undefined") {
        window.localStorage.setItem(EMAIL_CAMPAIGN_STORAGE_KEY, response.campaignId);
      }
      await loadProgress(response.campaignId);
      setCampaigns(await fetchEmailCampaigns().catch(() => campaigns));
      setBanner({ type: "success", message: response.note ?? "Email campaign queued." });
    } catch (error) {
      setBanner({
        type: "error",
        message: error instanceof Error ? error.message : "Email queue failed.",
      });
    } finally {
      setQueueing(false);
    }
  };

  const handleStop = async () => {
    const campaignId = progress?.campaignId ?? lastResponse?.campaignId;
    if (!campaignId) return;
    setStopping(true);
    setBanner(null);
    try {
      const response = await stopEmailBulkCampaign(campaignId);
      await loadProgress(campaignId);
      setCampaigns(await fetchEmailCampaigns().catch(() => campaigns));
      setBanner({ type: "success", message: response.note });
    } catch (error) {
      setBanner({
        type: "error",
        message: error instanceof Error ? error.message : "Could not stop campaign.",
      });
    } finally {
      setStopping(false);
    }
  };

  const handleFindDecisionMakers = async () => {
    const leadIds = selectedContactIds.length
      ? selectedContactIds
      : filteredContacts.map((contact) => contact.id);
    if (!leadIds.length) return;

    setEnrichingDecisionMakers(true);
    setBanner(null);
    try {
      let processed = 0;
      let found = 0;

      for (const chunk of chunkIds(leadIds, DECISION_MAKER_BATCH_SIZE)) {
        const response = await enrichDecisionMakers(chunk);
        processed += response.processed;
        found += response.found;
      }

      await loadContactsForBatch(selectedBatchId);
      setBanner({
        type: "success",
        message: `Decision Maker Finder checked ${processed} contact(s) and found ${found} candidate(s).`,
      });
    } catch (error) {
      setBanner({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Could not find decision makers.",
      });
    } finally {
      setEnrichingDecisionMakers(false);
    }
  };

  const handlePause = async () => {
    const campaignId = progress?.campaignId ?? lastResponse?.campaignId;
    if (!campaignId) return;
    setPausing(true);
    setBanner(null);
    try {
      const response = await pauseEmailBulkCampaign(campaignId);
      await loadProgress(campaignId);
      setBanner({ type: "success", message: response.note });
    } catch (error) {
      setBanner({
        type: "error",
        message: error instanceof Error ? error.message : "Could not pause campaign.",
      });
    } finally {
      setPausing(false);
    }
  };

  const handleResume = async () => {
    const campaignId = progress?.campaignId ?? lastResponse?.campaignId;
    if (!campaignId) return;
    setResuming(true);
    setBanner(null);
    try {
      const response = await resumeEmailBulkCampaign(campaignId);
      await loadProgress(campaignId);
      setBanner({ type: "success", message: response.note });
    } catch (error) {
      setBanner({
        type: "error",
        message: error instanceof Error ? error.message : "Could not resume campaign.",
      });
    } finally {
      setResuming(false);
    }
  };

  const handleRetryFailed = async () => {
    const campaignId = progress?.campaignId ?? lastResponse?.campaignId;
    if (!campaignId) return;
    setRetryingFailed(true);
    setBanner(null);
    try {
      const response = await retryFailedEmailBulkCampaign(campaignId);
      await loadProgress(campaignId);
      setBanner({ type: "success", message: response.note });
    } catch (error) {
      setBanner({
        type: "error",
        message:
          error instanceof Error ? error.message : "Could not retry failed emails.",
      });
    } finally {
      setRetryingFailed(false);
    }
  };

  const saveAiSettings = async () => {
    setSavingAi(true);
    setBanner(null);
    try {
      const response = await postJson<
        { saved: boolean; settings: EmailAiSettings },
        EmailAiSettingsPayload
      >("/email/ai-settings", {
        provider: aiForm.provider,
        apiKey: aiForm.apiKey?.trim() || undefined,
        openaiModel: aiForm.openaiModel,
        mistralModel: aiForm.mistralModel,
        isActive: aiForm.isActive ?? true,
      });
      setAiSettings(response.settings);
      setAiForm((current) => ({ ...current, apiKey: "" }));
      setBanner({ type: "success", message: "AI personalization settings saved." });
    } catch (error) {
      setBanner({
        type: "error",
        message: error instanceof Error ? error.message : "Could not save AI settings.",
      });
    } finally {
      setSavingAi(false);
    }
  };

  const testAiSettings = async () => {
    setTestingAi(true);
    setBanner(null);
    try {
      const response = await postJson<{ ok: boolean; note: string }, Record<string, never>>(
        "/email/ai-settings/test",
        {},
      );
      const next = await getJson<EmailAiSettings>("/email/ai-settings");
      setAiSettings(next);
      setBanner({ type: "success", message: response.note });
    } catch (error) {
      setBanner({
        type: "error",
        message: error instanceof Error ? error.message : "AI test failed.",
      });
    } finally {
      setTestingAi(false);
    }
  };

  const selectedVisibleCount = filteredContacts.filter((contact) =>
    selectedContactIds.includes(contact.id),
  ).length;

  return (
    <AppShell onRefresh={() => void refreshAll()} refreshing={refreshing}>
      <div className="flex flex-col gap-4 pb-20 xl:pb-6">
        <PageHeader
          title="Email campaigns"
          description="Queue SMTP email campaigns to contacts with valid email addresses."
          actions={
            <>
              <PageLink href="/dashboard/email/setup">
                <Settings className="h-4 w-4" />
                SMTP Setup
              </PageLink>
              <PageLink href="/dashboard/email/mailbox">
                <Mail className="h-4 w-4" />
                Mailbox
              </PageLink>
              <PageLink href="/dashboard/templates">
                <LayoutTemplate className="h-4 w-4" />
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

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="card card-pad space-y-4">
            <div>
              <p className="section-label">Recipients</p>
              <h2 className="text-lg font-semibold text-neutral-900">Select contacts</h2>
              <p className="mt-1 text-sm text-neutral-600">
                {loading
                  ? "Loading contacts..."
                  : `${emailContacts.length} of ${sortedContacts.length} contact(s) have usable email addresses.${
                      invalidEmailCount
                        ? ` ${invalidEmailCount} invalid/fake email(s) hidden from sending.`
                        : ""
                    }`}
              </p>
            </div>

            {scrapeBatches.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void handleSelectBatch("")}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                    selectedBatchId === ""
                      ? "border-emerald-700 bg-emerald-700 text-white"
                      : "border-neutral-200 bg-white text-neutral-600"
                  }`}
                >
                  All leads
                </button>
                {scrapeBatches.map((batch) => (
                  <button
                    key={batch.id}
                    type="button"
                    onClick={() => void handleSelectBatch(batch.id)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                      selectedBatchId === batch.id
                        ? "border-emerald-700 bg-emerald-700 text-white"
                        : "border-neutral-200 bg-white text-neutral-600"
                    }`}
                  >
                    {batch.keyword}
                    <span className="ml-2 opacity-75">{batch.leadCount}</span>
                  </button>
                ))}
              </div>
            ) : null}

            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name, email, category, or website..."
              className="input"
            />

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setSelectedContactIds(emailContacts.map((contact) => contact.id))}
                className="btn btn-secondary text-xs"
                disabled={emailContacts.length === 0}
              >
                Select all valid email ({emailContacts.length})
              </button>
              <button
                type="button"
                onClick={() =>
                  setSelectedContactIds(
                    filteredContacts
                      .filter(hasUsableEmail)
                      .map((contact) => contact.id),
                  )
                }
                className="btn btn-secondary text-xs"
                disabled={filteredContacts.length === 0}
              >
                Select shown valid email
              </button>
              <button
                type="button"
                onClick={() => setSelectedContactIds([])}
                className="btn btn-ghost text-xs"
              >
                Clear ({selectedContactIds.length})
              </button>
              <button
                type="button"
                onClick={() => void handleFindDecisionMakers()}
                className="btn btn-secondary text-xs"
                disabled={enrichingDecisionMakers || filteredContacts.length === 0}
              >
                <ContactRound className="h-4 w-4" />
                {enrichingDecisionMakers
                  ? "Finding..."
                  : selectedContactIds.length
                    ? `Find decision makers (${selectedContactIds.length})`
                    : "Find decision makers shown"}
              </button>
            </div>

            <div className="overflow-hidden rounded-lg border border-neutral-200">
              <div className="border-b border-neutral-200 bg-neutral-50 px-3 py-2 text-xs font-medium text-neutral-600">
                {selectedVisibleCount} of {filteredContacts.length} visible selected
              </div>
              <div className="max-h-72 space-y-1 overflow-auto p-2">
                {filteredContacts.map((contact) => {
                  const checked = selectedContactIds.includes(contact.id);
                  const preferredEmail = getContactEmail(contact);
                  const emailError = getEmailValidationError(preferredEmail);
                  const disabled = Boolean(emailError);
                  return (
                    <label
                      key={contact.id}
                      className={`flex items-start gap-3 rounded-lg px-3 py-2 ${
                        checked ? "border border-green-200 bg-green-50" : "hover:bg-neutral-50"
                      } ${disabled ? "opacity-55" : "cursor-pointer"}`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={disabled}
                        onChange={() =>
                          setSelectedContactIds((current) =>
                            current.includes(contact.id)
                              ? current.filter((id) => id !== contact.id)
                              : [...current, contact.id],
                          )
                        }
                        className="mt-1 shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-neutral-900">
                          {contact.name ?? "Unnamed contact"}
                        </p>
                        <p className="truncate text-xs text-neutral-500">
                          {preferredEmail ?? "No email address"}
                        </p>
                        {contact.bestDecisionMaker ? (
                          <p className="mt-1 text-xs font-medium text-emerald-700">
                            {contact.bestDecisionMaker.name ?? "Decision maker"}
                            {contact.bestDecisionMaker.title
                              ? ` · ${contact.bestDecisionMaker.title}`
                              : ""}{" "}
                            · {contact.bestDecisionMaker.emailType}
                          </p>
                        ) : contact.email ? (
                          <p className="mt-1 text-xs font-medium text-amber-700">
                            Generic/business inbox only
                          </p>
                        ) : null}
                        {emailError ? (
                          <p className="mt-1 text-xs font-medium text-red-600">
                            {emailError}
                          </p>
                        ) : null}
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="card card-pad space-y-4">
            <div>
              <p className="section-label">Email campaign</p>
              <h2 className="text-lg font-semibold text-neutral-900">Template</h2>
              <p className="mt-1 text-sm text-neutral-600">
                Use placeholders: {"{{firstName}}"}, {"{{name}}"}, {"{{category}}"}, {"{{website}}"}.
              </p>
            </div>

            <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="section-label">AI personalization</p>
                  <p className="text-sm font-semibold text-emerald-950">
                    Research each business at send time
                  </p>
                  <p className="mt-1 text-xs leading-5 text-emerald-800">
                    Research text is not saved. Each email job researches, customizes, sends,
                    then moves to the next lead.
                  </p>
                </div>
                <Sparkles className="h-5 w-5 shrink-0 text-emerald-700" />
              </div>

              <div className="mt-3 grid gap-2 lg:grid-cols-3">
                <div>
                  <label className="label">AI provider</label>
                  <select
                    value={aiForm.provider}
                    onChange={(event) =>
                      setAiForm({
                        ...aiForm,
                        provider: event.target.value as EmailAiProvider,
                        apiKey: "",
                      })
                    }
                    className="input bg-white"
                  >
                    {(aiSettings?.providers ?? [
                      { value: "OPENAI" as const, label: "ChatGPT (OpenAI)" },
                      { value: "MISTRAL" as const, label: "Mistral (Le Chat)" },
                    ]).map((provider) => (
                      <option key={provider.value} value={provider.value}>
                        {provider.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Model</label>
                  <select
                    value={
                      aiForm.provider === "MISTRAL"
                        ? (aiForm.mistralModel ?? "mistral-large-latest")
                        : (aiForm.openaiModel ?? "gpt-5.5")
                    }
                    onChange={(event) =>
                      setAiForm(
                        aiForm.provider === "MISTRAL"
                          ? { ...aiForm, mistralModel: event.target.value }
                          : { ...aiForm, openaiModel: event.target.value },
                      )
                    }
                    className="input bg-white"
                  >
                    {aiModelOptions[aiForm.provider].map((model) => (
                      <option key={model} value={model}>
                        {model}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">API key</label>
                  <input
                    type="password"
                    value={aiForm.apiKey ?? ""}
                    onChange={(event) => setAiForm({ ...aiForm, apiKey: event.target.value })}
                    placeholder={
                      selectedProviderHasKey
                        ? "Saved key unchanged"
                        : `Paste ${aiForm.provider === "MISTRAL" ? "Mistral" : "OpenAI"} API key`
                    }
                    className="input bg-white"
                  />
                </div>
              </div>

              <label className="mt-3 flex items-start gap-2 text-sm text-emerald-950">
                <input
                  type="checkbox"
                  checked={aiForm.isActive ?? true}
                  onChange={(event) =>
                    setAiForm({ ...aiForm, isActive: event.target.checked })
                  }
                  className="mt-1"
                />
                Save selected provider, model, and API key.
              </label>

              <label className="mt-2 flex items-start gap-2 text-sm text-emerald-950">
                <input
                  type="checkbox"
                  checked={aiPersonalizationEnabled}
                  onChange={(event) => setAiPersonalizationEnabled(event.target.checked)}
                  className="mt-1"
                />
                Customize selected emails with AI before sending.
              </label>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void saveAiSettings()}
                  disabled={savingAi}
                  className="btn btn-primary text-xs"
                >
                  <KeyRound className="h-4 w-4" />
                  {savingAi ? "Saving..." : "Save AI"}
                </button>
                <button
                  type="button"
                  onClick={() => void testAiSettings()}
                  disabled={testingAi || !selectedProviderHasKey || aiSettings?.provider !== aiForm.provider}
                  className="btn btn-secondary text-xs"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {testingAi ? "Testing..." : "Test AI"}
                </button>
              </div>

              {aiSettings?.configured ? (
                <p className="mt-2 text-xs text-emerald-800">
                  Active provider:{" "}
                  {aiSettings.provider === "MISTRAL" ? "Mistral (Le Chat)" : "ChatGPT (OpenAI)"}
                  {" · "}
                  Model {aiSettings.provider === "MISTRAL" ? aiSettings.mistralModel : aiSettings.openaiModel}
                  {" · "}
                  OpenAI key {aiSettings.providerKeys?.OPENAI ? "saved" : "missing"}
                  {" · "}
                  Mistral key {aiSettings.providerKeys?.MISTRAL ? "saved" : "missing"}
                  {aiSettings.lastTestError ? (
                    <span className="text-red-700"> · Last error: {aiSettings.lastTestError}</span>
                  ) : null}
                </p>
              ) : (
                <p className="mt-2 text-xs text-amber-800">
                  Save an API key before using AI customization.
                </p>
              )}
            </div>

            <div>
              <label className="label">Saved email template</label>
              <select
                value={selectedTemplateId}
                onChange={(event) => handleSelectTemplate(event.target.value)}
                className="input"
              >
                <option value="">Write manually</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-neutral-500">
                Create email templates on the Templates page.
              </p>
            </div>

            <div>
              <label className="label">Subject</label>
              <input
                value={subjectTemplate}
                onChange={(event) => setSubjectTemplate(event.target.value)}
                className="input"
              />
            </div>
            <div>
              <label className="label">Body</label>
              <textarea
                value={bodyTemplate}
                onChange={(event) => setBodyTemplate(event.target.value)}
                rows={12}
                className="input resize-none"
              />
            </div>
            <div className="hint-box hint-box-info text-sm">
              Emails are queued one-by-one every {EMAIL_SEND_DELAY_SECONDS} seconds.
            </div>
            <div>
              <label className="label">Preview</label>
              <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-700">
                <p className="font-semibold text-neutral-900">{renderedSubject}</p>
                <pre className="mt-2 whitespace-pre-wrap font-sans text-xs leading-5">
                  {renderedBody}
                </pre>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void handleQueue()}
              disabled={
                queueing ||
                selectedWithEmail === 0 ||
                !subjectTemplate.trim() ||
                !bodyTemplate.trim() ||
                (aiPersonalizationEnabled && !aiSettings?.configured)
              }
              className="btn btn-primary w-full"
            >
              <Send className="h-4 w-4" />
              {queueing
                ? "Queueing..."
                : aiPersonalizationEnabled
                  ? `AI customize + send to ${selectedWithEmail} contact(s)`
                  : `Queue email to ${selectedWithEmail} contact(s)`}
            </button>
          </div>
        </section>

        {lastResponse ? (
          <section className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium">Last email queue</p>
              <span className="rounded-full bg-white/70 px-2.5 py-1 font-semibold">
                Queued {lastResponse.queued} · skipped{" "}
                {(lastResponse.skippedNoEmail?.length ?? 0) +
                  (lastResponse.skippedInvalidEmail?.length ?? 0)}
              </span>
            </div>
            <p className="mt-2 leading-5">{lastResponse.note}</p>
          </section>
        ) : null}

        {progress?.total ? (
          <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="section-label">Live email progress</p>
                <h2 className="text-lg font-semibold text-emerald-950">
                  {buildProgressSummary(progress).percent}% complete
                </h2>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-emerald-700">
                  {progress.sent + progress.failed} / {progress.total} finished
                </span>
                {progress.pending > 0 ? (
                  <button
                    type="button"
                    onClick={() => void handlePause()}
                    disabled={pausing}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Pause className="h-3.5 w-3.5" />
                    {pausing ? "Pausing..." : "Pause"}
                  </button>
                ) : null}
                {progress.paused > 0 ? (
                  <button
                    type="button"
                    onClick={() => void handleResume()}
                    disabled={resuming}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Play className="h-3.5 w-3.5" />
                    {resuming ? "Resuming..." : "Resume"}
                  </button>
                ) : null}
                {progress.failed > 0 && progress.pending === 0 && progress.processing === 0 ? (
                  <button
                    type="button"
                    onClick={() => void handleRetryFailed()}
                    disabled={retryingFailed}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-sky-700 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${retryingFailed ? "animate-spin" : ""}`} />
                    {retryingFailed ? "Retrying..." : "Retry failed"}
                  </button>
                ) : null}
                {progress.pending > 0 ? (
                  <button
                    type="button"
                    onClick={() => void handleStop()}
                    disabled={stopping}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Square className="h-3.5 w-3.5" />
                    {stopping ? "Stopping..." : "Stop"}
                  </button>
                ) : null}
              </div>
            </div>

            <div className="mt-3">
              <div className="h-2 overflow-hidden rounded-full bg-emerald-100">
                <div
                  className="h-full rounded-full bg-emerald-600 transition-all duration-500"
                  style={{ width: `${buildProgressSummary(progress).percent}%` }}
                />
              </div>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-emerald-800">
                <span>{buildProgressSummary(progress).label}</span>
                {buildProgressSummary(progress).nextLabel ? (
                  <span>{buildProgressSummary(progress).nextLabel}</span>
                ) : null}
              </div>
            </div>

            <div className="mt-3 grid gap-2 text-xs text-emerald-950 sm:grid-cols-5">
              <ProgressStat label="Pending" value={progress.pending} tone="pending" />
              <ProgressStat label="Paused" value={progress.paused} tone="paused" />
              <ProgressStat label="Sending now" value={progress.processing} tone="processing" />
              <ProgressStat label="SMTP accepted" value={progress.sent} tone="sent" />
              <ProgressStat label="Failed" value={progress.failed} tone="failed" />
            </div>
            <div className="mt-3 max-h-80 space-y-2 overflow-y-auto">
              {progress.contacts.map((contact) => (
                <div
                  key={contact.jobId}
                  className="rounded-lg border border-emerald-100 bg-white p-2 text-xs text-neutral-600"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium text-neutral-900">
                      {contact.name ?? contact.email}
                    </p>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold ${getJobStatusTone(contact.jobStatus)}`}>
                      {getJobStatusIcon(contact.jobStatus)}
                      {formatJobStatus(contact.jobStatus)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-neutral-500">
                    {contact.email} · Scheduled {formatScheduleTime(contact.scheduledFor)}
                  </p>
                  <p className="mt-1 font-medium text-neutral-700">{contact.subject}</p>
                  {contact.lastError ? (
                    <p className="mt-1 text-red-600">{contact.lastError}</p>
                  ) : null}
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <section className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="section-label">Campaign history</p>
              <h2 className="text-lg font-semibold text-neutral-900">
                Recent email campaigns
              </h2>
            </div>
            <History className="h-5 w-5 text-neutral-500" />
          </div>
          <div className="mt-3 space-y-2">
            {campaigns.length > 0 ? (
              campaigns.slice(0, 8).map((campaign) => (
                <button
                  key={campaign.id}
                  type="button"
                  onClick={() => void loadProgress(campaign.id)}
                  className="w-full rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-left transition hover:border-emerald-200 hover:bg-emerald-50"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-neutral-900">
                        {campaign.name || campaign.subjectTemplate}
                      </p>
                      <p className="mt-0.5 text-xs text-neutral-500">
                        {formatScheduleTime(campaign.createdAt)} · {campaign.status}
                        {campaign.aiPersonalizationEnabled
                          ? ` · AI ${campaign.provider ?? ""}`
                          : ""}
                      </p>
                    </div>
                    <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-neutral-700">
                      {campaign.sent}/{campaign.queued} sent
                    </span>
                  </div>
                  <div className="mt-3 grid gap-2 text-xs sm:grid-cols-6">
                    <CampaignStat label="Failed" value={campaign.failed} />
                    <CampaignStat label="Skipped" value={campaign.skippedNoEmail + campaign.skippedInvalidEmail} />
                    <CampaignStat label="Replies" value={campaign.replied} />
                    <CampaignStat label="Bounces" value={campaign.bounced} />
                    <CampaignStat label="Selected" value={campaign.totalSelected} />
                    <CampaignStat label="Queued" value={campaign.queued} />
                  </div>
                </button>
              ))
            ) : (
              <p className="rounded-lg bg-neutral-50 p-3 text-sm text-neutral-500">
                No email campaign history yet.
              </p>
            )}
          </div>
        </section>

        <div
          className={`hint-box text-sm ${
            smtpSettings?.configured && smtpSettings.isActive
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "hint-box-info"
          }`}
        >
          <Mail className="mr-1 inline h-4 w-4" />
          {smtpSettings?.configured && smtpSettings.isActive
            ? `SMTP is active for ${smtpSettings.fromEmail ?? smtpSettings.username ?? "this account"}. Messages marked as SMTP accepted were accepted by the mail server; some hosts do not copy app-sent SMTP mail into Roundcube Sent.`
            : "Configure SMTP on the SMTP Setup page before emails can actually send."}
        </div>
      </div>
    </AppShell>
  );
}

function buildProgressSummary(progress: EmailBulkCampaignProgress) {
  const finished = progress.sent + progress.failed;
  const percent =
    progress.total > 0 ? Math.round((finished / progress.total) * 100) : 0;
  const next = progress.contacts
    .filter((contact) => contact.jobStatus === "PENDING")
    .sort(
      (left, right) =>
        new Date(left.scheduledFor).getTime() -
        new Date(right.scheduledFor).getTime(),
    )[0];

  return {
    percent,
    label:
      progress.pending === 0 && progress.processing === 0
        ? progress.paused > 0
          ? "Campaign paused. Change settings, then resume when ready."
          : "Campaign finished."
        : `${progress.pending + progress.processing} email(s) still in progress.`,
    nextLabel: next
      ? `Next: ${next.name ?? next.email} at ${formatScheduleTime(next.scheduledFor)}`
      : "",
  };
}

function ProgressStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "pending" | "paused" | "processing" | "sent" | "failed";
}) {
  const toneClass = {
    pending: "bg-white/80 text-amber-900",
    paused: "bg-white/80 text-orange-900",
    processing: "bg-white/80 text-sky-900",
    sent: "bg-white/80 text-emerald-900",
    failed: "bg-white/80 text-red-900",
  }[tone];

  return (
    <div className={`rounded-lg p-2 ${toneClass}`}>
      <p className="font-semibold">{value}</p>
      <p>{label}</p>
    </div>
  );
}

function CampaignStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-white px-2 py-1.5">
      <p className="font-semibold text-neutral-900">{value}</p>
      <p className="text-neutral-500">{label}</p>
    </div>
  );
}

function getJobStatusTone(status: string) {
  switch (status) {
    case "DONE":
      return "bg-emerald-100 text-emerald-700";
    case "FAILED":
      return "bg-red-100 text-red-700";
    case "PROCESSING":
      return "bg-sky-100 text-sky-700";
    case "PAUSED":
      return "bg-orange-100 text-orange-700";
    default:
      return "bg-amber-100 text-amber-700";
  }
}

function getJobStatusIcon(status: string) {
  switch (status) {
    case "DONE":
      return <CheckCircle2 className="h-3.5 w-3.5" />;
    case "FAILED":
      return <XCircle className="h-3.5 w-3.5" />;
    case "PROCESSING":
      return <RefreshCw className="h-3.5 w-3.5 animate-spin" />;
    case "PAUSED":
      return <Pause className="h-3.5 w-3.5" />;
    default:
      return <Clock3 className="h-3.5 w-3.5" />;
  }
}

function formatJobStatus(status: string) {
  return status.toLowerCase().replace(/_/g, " ");
}

function renderEmailTemplate(template: string, lead: LeadRecord | null) {
  const displayName = lead?.bestDecisionMaker?.name ?? lead?.name ?? null;
  const firstName = displayName?.trim().split(/\s+/)[0] || "there";
  const email = lead ? getContactEmail(lead) : "";
  const values: Record<string, string> = {
    firstName,
    name: displayName ?? firstName,
    company: lead?.name ?? firstName,
    email: email ?? "",
    phone: lead?.phone ?? "",
    website: lead?.website ?? "",
    category: lead?.category ?? "",
    address: lead?.address ?? "",
    sourceKeyword: lead?.sourceKeyword ?? "",
    title: lead?.bestDecisionMaker?.title ?? "",
  };
  return template.replace(/\{\{\s*([\w]+)\s*\}\}/g, (_, key: string) => values[key] ?? "");
}

function formatScheduleTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}
