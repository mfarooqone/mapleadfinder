import {
  clearAuthSession,
  getAuthToken,
  type AuthUser,
} from "./auth";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api/backend";

export type BackendOverview = {
  name: string;
  recommendedProvider: string;
  modules: string[];
  notes: string[];
  stack: {
    framework: string;
    database: string;
    jobEngine: string;
    providerStrategy: string;
    redis: boolean;
  };
};

export type ConnectedAccount = {
  id: string;
  userId: string;
  phoneNumber: string;
  provider: string;
  businessAccountId?: string | null;
  webhookUrl?: string | null;
  webhookVerifyToken?: string | null;
  isActive: boolean;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  hasApiKey: boolean;
  hasApiSecret: boolean;
};

export type TestingStatus = {
  recommendedProvider: string;
  testingMode: string;
  activeProfile?: string;
  envReady: boolean;
  requiredConfig: Record<string, boolean>;
  sessionName?: string;
  wahaSession?: {
    name?: string;
    status?: string;
    me?: {
      id?: string;
      pushName?: string;
    } | null;
  } | null;
  baileysSession?: {
    sessionName: string;
    status: string;
    connected: boolean;
    hasQr: boolean;
    phoneNumber?: string | null;
    lastError?: string | null;
  } | null;
  me?: {
    id?: string;
    pushName?: string;
  } | null;
  qrHint?: string;
  riskNote?: string;
  sandboxJoin?: {
    sandboxNumber: string;
    joinCode?: string | null;
    instruction: string;
  } | null;
  configuredProfiles?: {
    test?: {
      phoneNumber?: string | null;
      phoneNumberId?: string | null;
      ready: boolean;
    };
    live?: {
      phoneNumber?: string | null;
      phoneNumberId?: string | null;
      ready: boolean;
    };
  };
  webhookPath?: string;
  connectedAccount: ConnectedAccount | null;
  nextStep: string;
  productionUpgrade?: string;
};

export type WahaQrResponse = {
  sessionName: string;
  qr?: {
    value?: string;
    data?: string;
    mimetype?: string;
  } | null;
  alreadyLinked?: boolean;
  hint?: string;
};

export type BaileysQrResponse = {
  sessionName: string;
  status: string;
  connected: boolean;
  hasQr: boolean;
  phoneNumber?: string | null;
  lastError?: string | null;
  qr?: string | null;
  qrDataUrl?: string | null;
  hint?: string;
};

export type LeadRecord = {
  id: string;
  userId: string;
  name?: string | null;
  category?: string | null;
  address?: string | null;
  phone: string;
  email?: string | null;
  website?: string | null;
  rating?: number | null;
  reviewsCount?: number | null;
  source?: "MANUAL" | "CSV" | "GOOGLE_MAPS";
  sourceKeyword?: string | null;
  optIn: boolean;
  warmUpStatus?: "PENDING" | "LINK_SENT" | "ENGAGED" | "BLOCKED";
  firstIncomingAt?: string | null;
  lastOutgoingAt?: string | null;
  status: string;
  leadStatus?: string;
  contactState?: "NEW" | "CONTACTED";
  contactedAt?: string | null;
  latestOutgoingStatus?: string | null;
  hasIncoming?: boolean;
  lastIncomingAt?: string | null;
  qualityScore?: number;
  qualityReasons?: string[];
  emailDeliveryStatus?: string;
  emailLastSentAt?: string | null;
  emailLastReplyAt?: string | null;
  emailLastBounceAt?: string | null;
  emailLastError?: string | null;
  bestDecisionMaker?: LeadDecisionMaker | null;
  preferredEmail?: string | null;
  preferredEmailType?: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
};

export type LeadDecisionMaker = {
  id: string;
  name: string | null;
  title: string | null;
  email: string | null;
  emailType: string;
  confidence: number;
  sourceUrl: string | null;
};

export type DecisionMakerEnrichmentResponse = {
  processed: number;
  found: number;
  results: Array<{
    leadId: string;
    name: string | null;
    website: string | null;
    best: LeadDecisionMaker | null;
    candidates: LeadDecisionMaker[];
    note: string;
  }>;
};

export type ScrapeBatch = {
  id: string;
  userId: string;
  keyword: string;
  maxRecords?: number | null;
  discovered: number;
  saved: number;
  leadCount: number;
  createdAt: string;
  updatedAt: string;
};

export type WaMeLinkResponse = {
  leadId: string;
  phone: string;
  warmUpStatus: string;
  businessPhone: string;
  prefilledText: string;
  link: string;
};

export type OutreachStats = {
  date: string;
  coldSendCount: number;
  newContactCount: number;
  maxDailyCold: number;
  remainingCold: number;
  mode: string;
  requireIncoming: boolean;
  minDelaySeconds: number;
  maxFirstMessageChars: number;
  packageSize: number;
  packagePauseSeconds: number;
};

export type UploadLeadsResponse = {
  imported: number;
  skipped?: number;
};

export type WahaVoiceSendResponse = {
  sent: boolean;
  provider: string;
  to: string;
  providerMessageId?: string | null;
  note?: string;
};

export type VoiceApiInfo = {
  provider: string;
  requiresWahaPlus: boolean;
  wahaUpstream: string;
  note: string;
  documentation: string;
  plusDocumentation: string;
  routes: Record<string, string>;
  body: Record<string, string>;
};

export type VoiceSendPayload = {
  to: string;
  whatsappAccountId?: string;
  url?: string;
  data?: string;
  filename?: string;
  mimetype?: string;
  convert?: boolean;
};

export type QueueVoicePayload = VoiceSendPayload & {
  whatsappAccountId: string;
  phone: string;
  leadId?: string;
  scheduleAt?: string;
};

export type QueueVoiceResponse = {
  queued: boolean;
  messageType: string;
  provider: string;
  conversationId: string;
  messageId: string;
  scheduledFor: string;
};

export async function getVoiceApiInfo() {
  return getJson<VoiceApiInfo>("/whatsapp/voice");
}

export async function sendVoiceMessage(payload: VoiceSendPayload) {
  return postJson<WahaVoiceSendResponse, VoiceSendPayload>(
    "/whatsapp/voice/send",
    payload,
  );
}

export async function sendWahaTestVoiceMessage(payload: VoiceSendPayload) {
  return postJson<WahaVoiceSendResponse, VoiceSendPayload>(
    "/whatsapp/testing/waha/send-voice",
    payload,
  );
}

export async function fetchBaileysStatus(sessionName: string) {
  return getJson<TestingStatus>(
    `/whatsapp/testing/baileys/status?sessionName=${encodeURIComponent(sessionName)}`,
  );
}

export async function fetchBaileysQr(sessionName: string) {
  return getJson<BaileysQrResponse>(
    `/whatsapp/testing/baileys/qr?sessionName=${encodeURIComponent(sessionName)}`,
  );
}

export async function bootstrapBaileysSession(payload: { sessionName: string }) {
  return postJson<
    {
      provider: string;
      sessionName: string;
      accountSaved: boolean;
      account?: ConnectedAccount;
      nextStep?: string;
    },
    { sessionName: string }
  >("/whatsapp/testing/baileys/bootstrap", payload);
}

export async function queueVoiceMessage(payload: QueueVoicePayload) {
  return postJson<QueueVoiceResponse, QueueVoicePayload>(
    "/whatsapp/voice/queue",
    payload,
  );
}

export type WahaBulkSendResponse = {
  campaignId?: string;
  queued: number;
  minDelaySeconds: number;
  maxDelaySeconds: number;
  seoResearchEnabled?: boolean;
  note: string;
  outreachSummary?: {
    eligible: number;
    remainingCold: number;
    maxDailyCold: number;
    skippedNoIncoming: Array<{ leadId: string; name: string | null; phone: string }>;
    skippedDailyCap: Array<{ leadId: string; name: string | null; phone: string }>;
    skippedMessageTooLong: Array<{ leadId: string; name: string | null; phone: string }>;
    skippedRecentlyContacted: Array<{ leadId: string; name: string | null; phone: string }>;
    skippedBlocked: Array<{ leadId: string; name: string | null; phone: string }>;
  };
  skippedAlreadyContacted?: Array<{
    leadId: string;
    jobId?: string;
    messageId?: string;
    name: string | null;
    phone: string;
    contactedAt: string | null;
    latestOutgoingStatus: string | null;
  }>;
  skippedNotOptedIn?: Array<{
    leadId: string;
    name: string | null;
    phone: string;
  }>;
  contacts: Array<{
    leadId: string;
    name: string | null;
    phone: string;
    scheduledFor: string;
    delaySeconds?: number;
    website?: string | null;
    seoPoint?: string;
    messagePreview?: string;
  }>;
};

export type WahaBulkCampaignProgress = {
  campaignId: string | null;
  total: number;
  queued: number;
  processing: number;
  sent: number;
  failed: number;
  pending: number;
  paused: number;
  contacts: Array<{
    jobId: string;
    messageId: string | null;
    leadId: string | null;
    name: string | null;
    phone: string;
    scheduledFor: string;
    jobStatus: string;
    messageStatus: string | null;
    providerMessageId: string | null;
    lastError: string | null;
    updatedAt: string;
  }>;
};

export async function fetchOutreachStats(whatsappAccountId?: string) {
  const query = whatsappAccountId
    ? `?whatsappAccountId=${encodeURIComponent(whatsappAccountId)}`
    : "";
  return getJson<OutreachStats>(`/whatsapp/outreach/stats${query}`);
}

export async function fetchWahaBulkProgress(campaignId?: string | null) {
  const query = campaignId
    ? `?campaignId=${encodeURIComponent(campaignId)}`
    : "";
  return getJson<WahaBulkCampaignProgress>(
    `/whatsapp/testing/waha/bulk-progress${query}`,
  );
}

export async function stopWahaBulkCampaign(campaignId: string) {
  return postJson<{ campaignId: string; stopped: number; note: string }, { campaignId: string }>(
    "/whatsapp/testing/waha/bulk-stop",
    { campaignId },
  );
}

export type EmailBulkSendResponse = {
  campaignId?: string;
  queued: number;
  minDelaySeconds: number;
  maxDelaySeconds: number;
  note: string;
  skippedNoEmail?: Array<{
    leadId: string;
    name: string | null;
    email: string | null;
  }>;
  skippedInvalidEmail?: Array<{
    leadId: string;
    name: string | null;
    email: string;
    reason: string;
  }>;
  contacts: Array<{
    leadId: string;
    name: string | null;
    email: string;
    scheduledFor: string;
    delaySeconds: number;
    jobId: string;
    subject: string;
    bodyPreview: string;
  }>;
};

export type EmailBulkCampaignProgress = {
  campaignId: string | null;
  total: number;
  queued: number;
  processing: number;
  sent: number;
  failed: number;
  pending: number;
  paused: number;
  contacts: Array<{
    jobId: string;
    leadId: string | null;
    name: string | null;
    email: string;
    subject: string;
    scheduledFor: string;
    jobStatus: string;
    lastError: string | null;
    updatedAt: string;
  }>;
};

export type EmailCampaignHistoryItem = {
  id: string;
  name: string | null;
  subjectTemplate: string;
  bodyTemplatePreview: string | null;
  aiPersonalizationEnabled: boolean;
  provider: EmailAiProvider | null;
  status: string;
  totalSelected: number;
  queued: number;
  sent: number;
  failed: number;
  skippedNoEmail: number;
  skippedInvalidEmail: number;
  replied: number;
  bounced: number;
  startedAt: string;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SmtpSettings = {
  configured: boolean;
  id?: string;
  host?: string;
  port?: number;
  secure?: boolean;
  username?: string | null;
  hasPassword?: boolean;
  fromEmail?: string;
  fromName?: string | null;
  replyToEmail?: string | null;
  isActive?: boolean;
  lastVerifiedAt?: string | null;
  lastVerifyError?: string | null;
  updatedAt?: string;
  envFallbackAvailable?: boolean;
};

export type SmtpSettingsPayload = {
  host: string;
  port: number;
  secure: boolean;
  username?: string;
  password?: string;
  fromEmail: string;
  fromName?: string;
  replyToEmail?: string;
  isActive?: boolean;
};

export type MailboxSettings = {
  configured: boolean;
  id?: string;
  imapHost?: string;
  imapPort?: number;
  imapSecure?: boolean;
  imapUsername?: string;
  hasPassword?: boolean;
  inboxFolder?: string;
  sentFolder?: string;
  isActive?: boolean;
  lastSyncedAt?: string | null;
  lastSyncError?: string | null;
  lastVerifiedAt?: string | null;
  lastVerifyError?: string | null;
  updatedAt?: string;
  windowDays: number;
};

export type MailboxSettingsPayload = {
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  imapUsername: string;
  imapPassword?: string;
  inboxFolder?: string;
  sentFolder?: string;
  isActive?: boolean;
};

export type MailboxMessage = {
  id: string;
  leadId: string | null;
  folder: "INBOX" | "SENT";
  direction: "INBOUND" | "OUTBOUND";
  messageId: string | null;
  threadKey: string | null;
  fromEmail: string | null;
  fromName: string | null;
  toEmails: string[];
  ccEmails: string[];
  subject: string | null;
  preview: string | null;
  sentAt: string | null;
  receivedAt: string | null;
  isRead: boolean;
  updatedAt: string;
  bodyCachedAt: string | null;
  textBody?: string | null;
  htmlBody?: string | null;
};

export type MailboxMessagesResponse = {
  windowDays: number;
  messages: MailboxMessage[];
};

export type MailboxSyncResponse = {
  ok: boolean;
  windowDays: number;
  imported: number;
  updated: number;
  note: string;
};

export type EmailAiProvider = "OPENAI" | "MISTRAL";

export type EmailAiSettings = {
  configured: boolean;
  id?: string;
  provider?: EmailAiProvider;
  hasApiKey?: boolean;
  openaiModel?: string;
  mistralModel?: string;
  providerKeys?: Record<EmailAiProvider, boolean>;
  isActive?: boolean;
  lastTestedAt?: string | null;
  lastTestError?: string | null;
  updatedAt?: string;
  models?: {
    OPENAI: string;
    MISTRAL: string;
    options?: Record<EmailAiProvider, string[]>;
  };
  providers: Array<{ value: EmailAiProvider; label: string }>;
};

export type EmailAiSettingsPayload = {
  provider: EmailAiProvider;
  apiKey?: string;
  openaiModel?: string;
  mistralModel?: string;
  isActive?: boolean;
};

export async function fetchEmailBulkProgress(campaignId?: string | null) {
  const query = campaignId ? `?campaignId=${encodeURIComponent(campaignId)}` : "";
  return getJson<EmailBulkCampaignProgress>(`/email/bulk-progress${query}`);
}

export async function fetchEmailCampaigns() {
  return getJson<EmailCampaignHistoryItem[]>("/email/campaigns");
}

export async function stopEmailBulkCampaign(campaignId: string) {
  return postJson<{ campaignId: string; stopped: number; note: string }, { campaignId: string }>(
    "/email/bulk-stop",
    { campaignId },
  );
}

export async function pauseEmailBulkCampaign(campaignId: string) {
  return postJson<{ campaignId: string; paused: number; note: string }, { campaignId: string }>(
    "/email/bulk-pause",
    { campaignId },
  );
}

export async function resumeEmailBulkCampaign(campaignId: string) {
  return postJson<{ campaignId: string; resumed: number; note: string }, { campaignId: string }>(
    "/email/bulk-resume",
    { campaignId },
  );
}

export async function retryFailedEmailBulkCampaign(campaignId: string) {
  return postJson<{ campaignId: string; retried: number; note: string }, { campaignId: string }>(
    "/email/bulk-retry-failed",
    { campaignId },
  );
}

export async function fetchMailboxMessages(folder?: "INBOX" | "SENT" | "ALL") {
  const query = folder && folder !== "ALL" ? `?folder=${encodeURIComponent(folder)}` : "";
  return getJson<MailboxMessagesResponse>(`/email/mailbox/messages${query}`);
}

export async function fetchWaMeLink(leadId: string, text = "Hi") {
  return getJson<WaMeLinkResponse>(
    `/leads/${encodeURIComponent(leadId)}/wa-me-link?text=${encodeURIComponent(text)}`,
  );
}

export async function enrichDecisionMakers(leadIds: string[]) {
  return postJson<DecisionMakerEnrichmentResponse, { leadIds: string[] }>(
    "/leads/decision-makers/enrich",
    { leadIds },
  );
}

export async function markWaMeLinkSent(leadId: string) {
  return postJson<{ warmUpStatus: string }, Record<string, never>>(
    `/leads/${encodeURIComponent(leadId)}/wa-me-link/sent`,
    {},
  );
}

export type TemplateRecord = {
  id: string;
  userId: string;
  whatsappAccountId?: string | null;
  channel?: "WHATSAPP" | "EMAIL";
  name: string;
  subject?: string | null;
  content: string;
  language: string;
  category: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export type ConversationRecord = {
  id: string;
  userId: string;
  phone: string;
  status: string;
  lastIncomingAt?: string | null;
  lastOutgoingAt?: string | null;
  lastMessageAt?: string | null;
  createdAt: string;
  updatedAt: string;
  lead?: {
    id: string;
    name?: string | null;
  } | null;
  _count?: {
    messages: number;
  };
};

export type MessageRecord = {
  id: string;
  conversationId: string;
  phone: string;
  content: string;
  direction: "INCOMING" | "OUTGOING";
  status: string;
  createdAt: string;
};

export type UserRecord = AuthUser;

async function parseResponse<T>(response: Response): Promise<T> {
  const raw = await response.text();
  let data: T | { message?: string } = {} as T;

  if (raw) {
    try {
      data = JSON.parse(raw) as T | { message?: string };
    } catch {
      throw new Error(
        response.ok
          ? "The backend returned a non-JSON response."
          : `The backend returned an unreadable response (status ${response.status}).`,
      );
    }
  }

  if (!response.ok) {
    if (response.status === 401 && typeof window !== "undefined") {
      clearAuthSession();
      window.location.href = "/login";
    }

    const message =
      typeof data === "object" && data && "message" in data
        ? String(data.message)
        : `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return data as T;
}

function buildHeaders(extraHeaders?: HeadersInit) {
  const headers = new Headers(extraHeaders);
  const token = getAuthToken();

  if (token) {
    headers.set("authorization", `Bearer ${token}`);
  }

  return headers;
}

export async function getJson<T>(path: string) {
  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      cache: "no-store",
      headers: buildHeaders(),
    });
  } catch {
    throw new Error(
      "Could not reach the backend. Start the NestJS server and verify the frontend proxy configuration.",
    );
  }

  return parseResponse<T>(response);
}

export async function postJson<TResponse, TPayload>(
  path: string,
  payload: TPayload,
) {
  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: "POST",
      headers: buildHeaders({
        "Content-Type": "application/json",
      }),
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error(
      "Could not reach the backend. Start the NestJS server and verify the frontend proxy configuration.",
    );
  }

  return parseResponse<TResponse>(response);
}

export async function deleteJson<T>(path: string) {
  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: "DELETE",
      headers: buildHeaders(),
    });
  } catch {
    throw new Error(
      "Could not reach the backend. Start the NestJS server and verify the frontend proxy configuration.",
    );
  }

  return parseResponse<T>(response);
}

export async function patchJson<TResponse, TPayload>(
  path: string,
  payload: TPayload,
) {
  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: "PATCH",
      headers: buildHeaders({
        "Content-Type": "application/json",
      }),
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error(
      "Could not reach the backend. Start the NestJS server and verify the frontend proxy configuration.",
    );
  }

  return parseResponse<TResponse>(response);
}
