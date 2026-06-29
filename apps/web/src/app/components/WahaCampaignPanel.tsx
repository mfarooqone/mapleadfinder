"use client";

import { useEffect, useMemo, useState } from "react";
import { LoaderCircle, Send, Square, TriangleAlert } from "lucide-react";
import type {
  OutreachStats,
  TemplateRecord,
  WahaBulkCampaignProgress,
  WahaBulkSendResponse,
} from "@/lib/backend";

type SendMode = "text" | "voice";
type VoiceSourceMode = "url" | "file";

type WahaCampaignPanelProps = {
  sendMode: SendMode;
  onSendModeChange: (mode: SendMode) => void;
  voiceSourceMode: VoiceSourceMode;
  onVoiceSourceModeChange: (mode: VoiceSourceMode) => void;
  templates?: TemplateRecord[];
  selectedTemplateId?: string;
  onSelectedTemplateIdChange?: (value: string) => void;
  messageTemplate: string;
  onMessageTemplateChange: (value: string) => void;
  voiceUrl: string;
  onVoiceUrlChange: (value: string) => void;
  voiceFilename: string;
  onVoiceFilenameChange: (value: string) => void;
  voiceMimetype: string;
  onVoiceMimetypeChange: (value: string) => void;
  voiceConvert: boolean;
  onVoiceConvertChange: (value: boolean) => void;
  onVoiceFileSelect: (file: File) => void;
  minDelaySeconds: number;
  onMinDelaySecondsChange: (value: number) => void;
  maxDelaySeconds: number;
  onMaxDelaySecondsChange: (value: number) => void;
  selectedCount: number;
  canSend: boolean;
  queueingBatch: boolean;
  onQueueBatch: () => void;
  onOptInSkippedContacts?: (leadIds: string[]) => void;
  optingInSkippedContacts?: boolean;
  onStopCampaign?: () => void;
  stoppingCampaign?: boolean;
  lastBulkResponse: WahaBulkSendResponse | null;
  campaignProgress?: WahaBulkCampaignProgress | null;
  outreachStats?: OutreachStats | null;
  eligibleCount?: number;
  selectedCountTotal?: number;
  showSendModeToggle?: boolean;
};

export default function WahaCampaignPanel({
  sendMode,
  onSendModeChange,
  voiceSourceMode,
  onVoiceSourceModeChange,
  templates = [],
  selectedTemplateId = "",
  onSelectedTemplateIdChange,
  messageTemplate,
  onMessageTemplateChange,
  voiceUrl,
  onVoiceUrlChange,
  voiceFilename,
  onVoiceFilenameChange,
  voiceMimetype,
  onVoiceMimetypeChange,
  voiceConvert,
  onVoiceConvertChange,
  onVoiceFileSelect,
  minDelaySeconds,
  onMinDelaySecondsChange,
  maxDelaySeconds,
  onMaxDelaySecondsChange,
  selectedCount,
  canSend,
  queueingBatch,
  onQueueBatch,
  onOptInSkippedContacts,
  optingInSkippedContacts = false,
  onStopCampaign,
  stoppingCampaign = false,
  lastBulkResponse,
  campaignProgress,
  outreachStats,
  eligibleCount = 0,
  selectedCountTotal = 0,
  showSendModeToggle = true,
}: WahaCampaignPanelProps) {
  const [progressNow, setProgressNow] = useState(() => Date.now());
  const voiceReady =
    voiceSourceMode === "url" ? Boolean(voiceUrl.trim()) : Boolean(voiceFilename);
  const bulkSummary = useMemo(() => buildBulkSummary(lastBulkResponse), [lastBulkResponse]);
  void onOptInSkippedContacts;
  void optingInSkippedContacts;
  const scheduleProgress = useMemo(
    () => buildScheduleProgress(lastBulkResponse, progressNow),
    [lastBulkResponse, progressNow],
  );

  useEffect(() => {
    if (!lastBulkResponse?.contacts?.length) {
      return;
    }

    setProgressNow(Date.now());
    const interval = window.setInterval(() => setProgressNow(Date.now()), 15000);

    return () => window.clearInterval(interval);
  }, [lastBulkResponse]);

  return (
    <div className="space-y-4">
      <div className="hint-box hint-box-warning">
        <div className="flex items-start gap-2">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="text-sm">
            <strong>Not zero ban risk.</strong> Cold WhatsApp DMs can trigger spam
            reports. Lowest-risk flow: send a{" "}
            <a
              href="https://waha.devlike.pro/docs/overview/%EF%B8%8F-how-to-avoid-blocking/#how-to-avoid-getting-banned"
              target="_blank"
              rel="noreferrer"
              className="font-medium text-amber-900 underline"
            >
              wa.me invite
            </a>{" "}
            by email/SMS, wait for them to message you, then pitch here.
          </div>
        </div>
      </div>

      {outreachStats ? (
        <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-700">
          <p className="font-medium text-neutral-900">Daily outreach quota</p>
          <p className="mt-1">
            {outreachStats.coldSendCount}/{outreachStats.maxDailyCold} cold sends
            used today · {outreachStats.remainingCold} remaining
          </p>
          <p className="mt-1 text-xs text-neutral-500">
            Mode: {outreachStats.mode.replace(/_/g, " ")} · min delay{" "}
            {outreachStats.minDelaySeconds}s · first message max{" "}
            {outreachStats.maxFirstMessageChars} chars
          </p>
        </div>
      ) : null}

      <div className="rounded-lg border border-neutral-200 bg-white p-3 text-sm text-neutral-700">
        <p className="font-medium text-neutral-900">How to message all imported contacts</p>
        <ol className="mt-2 list-inside list-decimal space-y-1 text-xs leading-5">
          <li>Import contacts on the Contacts page (CSV or manual add).</li>
          <li>Search the list above and click <strong>Select all</strong> (or pick individuals).</li>
          <li>Choose a saved WhatsApp template from the Templates page.</li>
          <li>Click <strong>Queue bulk send</strong> — each contact is scheduled with a random delay.</li>
        </ol>
      </div>

      {selectedCountTotal > 0 ? (
        <div className="hint-box hint-box-info text-sm">
          Bulk preview: <strong>{eligibleCount}</strong> eligible of{" "}
          <strong>{selectedCountTotal}</strong> selected
          {outreachStats?.requireIncoming
            ? " (engaged only)"
            : " (blocked contacts skipped)"}
        </div>
      ) : null}

      {showSendModeToggle ? (
        <>
          <div className="hint-box hint-box-info">
            <strong>Text</strong> sends personalized messages with {"{{firstName}}"} and{" "}
            {"{{seoPoint}}"}. <strong>Voice</strong> sends the same audio to every selected
            contact — set up Baileys on the Voice page first.
          </div>

          <div className="segmented">
            {(["text", "voice"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                className={`segmented-btn ${sendMode === mode ? "active" : ""}`}
                onClick={() => onSendModeChange(mode)}
              >
                {mode === "text" ? "Text" : "Voice"}
              </button>
            ))}
          </div>
        </>
      ) : null}

      {sendMode === "voice" ? (
        <>
          <div className="segmented">
            {(["url", "file"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                className={`segmented-btn ${voiceSourceMode === mode ? "active" : ""}`}
                onClick={() => onVoiceSourceModeChange(mode)}
              >
                {mode === "url" ? "Audio URL" : "Upload file"}
              </button>
            ))}
          </div>
          {voiceSourceMode === "url" ? (
            <div>
              <label className="label">Voice file URL</label>
              <input
                value={voiceUrl}
                onChange={(e) => onVoiceUrlChange(e.target.value)}
                className="input"
              />
            </div>
          ) : (
            <>
              <div>
                <label className="label">Upload audio</label>
                <input
                  type="file"
                  accept="audio/*,.opus,.ogg,.mp3,.m4a,.wav"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) onVoiceFileSelect(file);
                  }}
                  className="input"
                />
              </div>
              <div>
                <label className="label">Filename (optional)</label>
                <input
                  value={voiceFilename}
                  onChange={(e) => onVoiceFilenameChange(e.target.value)}
                  className="input"
                />
              </div>
            </>
          )}
          <div>
            <label className="label">MIME type</label>
            <input
              value={voiceMimetype}
              onChange={(e) => onVoiceMimetypeChange(e.target.value)}
              className="input"
            />
          </div>
          <label className="flex items-start gap-2 text-sm text-neutral-700">
            <input
              type="checkbox"
              checked={voiceConvert}
              onChange={(e) => onVoiceConvertChange(e.target.checked)}
              className="mt-1"
            />
            Convert to WhatsApp voice format (for MP3; disable for Opus)
          </label>
        </>
      ) : (
        <>
          <div>
            <label className="label">Saved WhatsApp template</label>
            {templates.length > 0 ? (
              <select
                value={selectedTemplateId}
                onChange={(event) => {
                  const templateId = event.target.value;
                  onSelectedTemplateIdChange?.(templateId);
                  const template = templates.find((item) => item.id === templateId);
                  onMessageTemplateChange(template?.content ?? "");
                }}
                className="input"
              >
                <option value="">Select saved template</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
            ) : (
              <p className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-600">
                No WhatsApp templates yet. Create one on the Templates page first.
              </p>
            )}
          </div>
        </>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label">Min delay (seconds)</label>
          <input
            type="number"
            min={90}
            max={300}
            value={minDelaySeconds}
            onChange={(e) => onMinDelaySecondsChange(Number(e.target.value))}
            className="input"
          />
        </div>
        <div>
          <label className="label">Max delay (seconds)</label>
          <input
            type="number"
            min={90}
            max={300}
            value={maxDelaySeconds}
            onChange={(e) => onMaxDelaySecondsChange(Number(e.target.value))}
            className="input"
          />
        </div>
      </div>

      <button
        type="button"
        onClick={onQueueBatch}
        disabled={
          !canSend ||
          selectedCount === 0 ||
          queueingBatch ||
          (sendMode === "text" ? !messageTemplate.trim() : !voiceReady)
        }
        className="btn btn-secondary w-full"
      >
        {queueingBatch ? (
          <LoaderCircle className="h-4 w-4 animate-spin" />
        ) : (
          <Send className="h-4 w-4" />
        )}
        {queueingBatch
          ? "Queueing…"
          : `Queue bulk send to ${selectedCount} contact(s)`}
      </button>

      {lastBulkResponse ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-medium">Last bulk queue</p>
            <span className="rounded-full bg-white/70 px-2.5 py-1 font-semibold">
              Queued {lastBulkResponse.queued} · skipped {bulkSummary.skippedTotal}
            </span>
          </div>
          {lastBulkResponse.note ? (
            <p className="mt-2 leading-5">{lastBulkResponse.note}</p>
          ) : null}
          {bulkSummary.groups.length ? (
            <div className="mt-3 space-y-2">
              {bulkSummary.groups.map((group) => (
                <details key={group.key} className="rounded-lg border border-amber-200 bg-white/60 p-2">
                  <summary className="cursor-pointer font-medium">
                    {group.label}: {group.contacts.length}
                  </summary>
                  <div className="mt-2 space-y-1">
                    {group.contacts.slice(0, 6).map((contact) => (
                      <p key={`${group.key}-${contact.leadId}`} className="truncate text-amber-950/80">
                        {contact.name || contact.phone} · {contact.phone}
                      </p>
                    ))}
                    {group.contacts.length > 6 ? (
                      <p className="text-amber-800/80">
                        +{group.contacts.length - 6} more
                      </p>
                    ) : null}
                  </div>
                </details>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {lastBulkResponse?.contacts?.length ? (
        <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="section-label">Last queued progress</p>
            <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-neutral-600">
              {scheduleProgress.completed} / {scheduleProgress.total} due
            </span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-neutral-200">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-500"
              style={{ width: `${scheduleProgress.percent}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-neutral-500">
            {scheduleProgress.nextLabel}
          </p>
          <div className="mt-2 space-y-2">
            {lastBulkResponse.contacts.map((contact) => (
              <div
                key={contact.leadId}
                className="rounded-lg border border-neutral-200 bg-white p-2 text-xs text-neutral-600"
              >
                <p className="font-medium text-neutral-900">
                  {contact.name ?? contact.phone}
                </p>
                <p className="mt-0.5 text-[11px] text-neutral-500">
                  Scheduled {formatScheduleTime(contact.scheduledFor)}
                </p>
                {contact.messagePreview ? (
                  <p className="mt-1 leading-5">{contact.messagePreview}</p>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {campaignProgress?.total ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="section-label">Live sending progress</p>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-emerald-700">
                {campaignProgress.sent + campaignProgress.failed} / {campaignProgress.total} finished
              </span>
              {campaignProgress.pending > 0 && onStopCampaign ? (
                <button
                  type="button"
                  onClick={onStopCampaign}
                  disabled={stoppingCampaign}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {stoppingCampaign ? (
                    <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Square className="h-3.5 w-3.5" />
                  )}
                  Stop
                </button>
              ) : null}
            </div>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-emerald-100">
            <div
              className="h-full rounded-full bg-emerald-600 transition-all duration-500"
              style={{
                width: `${Math.round(
                  ((campaignProgress.sent + campaignProgress.failed) /
                    campaignProgress.total) *
                    100,
                )}%`,
              }}
            />
          </div>
          <div className="mt-3 grid gap-2 text-xs text-emerald-950 sm:grid-cols-4">
            <div className="rounded-lg bg-white/80 p-2">
              <p className="font-semibold">{campaignProgress.pending}</p>
              <p>Pending</p>
            </div>
            <div className="rounded-lg bg-white/80 p-2">
              <p className="font-semibold">{campaignProgress.processing}</p>
              <p>Sending now</p>
            </div>
            <div className="rounded-lg bg-white/80 p-2">
              <p className="font-semibold">{campaignProgress.sent}</p>
              <p>Sent</p>
            </div>
            <div className="rounded-lg bg-white/80 p-2">
              <p className="font-semibold">{campaignProgress.failed}</p>
              <p>Failed</p>
            </div>
          </div>
          <div className="mt-3 max-h-64 space-y-2 overflow-y-auto">
            {campaignProgress.contacts.map((contact) => (
              <div
                key={contact.jobId}
                className="rounded-lg border border-emerald-100 bg-white p-2 text-xs text-neutral-600"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium text-neutral-900">
                    {contact.name ?? contact.phone}
                  </p>
                  <span className="rounded-full bg-neutral-100 px-2 py-0.5 font-semibold text-neutral-600">
                    {contact.messageStatus ?? contact.jobStatus}
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] text-neutral-500">
                  Scheduled {formatScheduleTime(contact.scheduledFor)}
                </p>
                {contact.lastError ? (
                  <p className="mt-1 text-red-600">{contact.lastError}</p>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

type SkippedContact = {
  leadId: string;
  name: string | null;
  phone: string;
};

function buildBulkSummary(response: WahaBulkSendResponse | null) {
  const groups: Array<{
    key: string;
    label: string;
    contacts: SkippedContact[];
  }> = [];

  const addGroup = (
    key: string,
    label: string,
    contacts?: SkippedContact[],
  ) => {
    if (contacts?.length) {
      groups.push({ key, label, contacts });
    }
  };

  addGroup(
    "already-contacted",
    "Already contacted",
    response?.skippedAlreadyContacted,
  );
  addGroup(
    "no-incoming",
    "No incoming message yet",
    response?.outreachSummary?.skippedNoIncoming,
  );
  addGroup(
    "daily-cap",
    "Daily cap reached",
    response?.outreachSummary?.skippedDailyCap,
  );
  addGroup(
    "message-too-long",
    "First message rule",
    response?.outreachSummary?.skippedMessageTooLong,
  );
  addGroup(
    "recently-contacted",
    "Recently contacted",
    response?.outreachSummary?.skippedRecentlyContacted,
  );
  addGroup("blocked", "Blocked", response?.outreachSummary?.skippedBlocked);

  return {
    groups,
    skippedTotal: groups.reduce((total, group) => total + group.contacts.length, 0),
  };
}

function buildScheduleProgress(
  response: WahaBulkSendResponse | null,
  now: number,
) {
  const contacts = response?.contacts ?? [];
  const total = contacts.length;

  if (!total) {
    return {
      completed: 0,
      total: 0,
      percent: 0,
      nextLabel: "No contacts queued.",
    };
  }

  const scheduledTimes = contacts
    .map((contact) => new Date(contact.scheduledFor).getTime())
    .filter((time) => Number.isFinite(time))
    .sort((left, right) => left - right);
  const completed = scheduledTimes.filter((time) => time <= now).length;
  const nextTime = scheduledTimes.find((time) => time > now);

  return {
    completed,
    total,
    percent: Math.round((completed / total) * 100),
    nextLabel: nextTime
      ? `Next queued message is due ${formatScheduleTime(new Date(nextTime).toISOString())}.`
      : "All queued messages are due. Refresh conversations/messages to verify delivery.",
  };
}

function formatScheduleTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "soon";
  }

  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export const DEFAULT_MESSAGE_TEMPLATE = "";

export const DEFAULT_VOICE_MIMETYPE = "audio/ogg; codecs=opus";
