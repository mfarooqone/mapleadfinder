import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MessageStatus, ProviderType } from '@prisma/client';
import { normalizePhoneNumber } from '../../../common/utils/phone.util';
import {
  calculateTypingDelayMs,
  calculateVoiceTypingDelayMs,
  resolveTypingDelayConfig,
} from '../../../common/utils/waha-human-behavior.util';
import {
  AccountReference,
  ProviderSendResult,
  ProviderWebhookEvent,
  SendTemplatePayload,
  SendTextPayload,
  SendVoicePayload,
  WhatsAppProviderAdapter,
} from './types';

type WahaWebhookPayload = {
  event?: string;
  session?: string;
  payload?: {
    id?: string;
    timestamp?: number | string;
    from?: string;
    fromMe?: boolean;
    body?: string;
    ack?: number;
  };
};

@Injectable()
export class WahaProvider implements WhatsAppProviderAdapter {
  constructor(private readonly configService: ConfigService) {}

  supports(provider: ProviderType): boolean {
    return provider === ProviderType.WAHA;
  }

  async sendTextMessage(payload: SendTextPayload): Promise<ProviderSendResult> {
    const sessionName = this.getSessionName(payload.account);
    const baseUrl = this.getBaseUrl(payload.account);
    const apiKey = payload.credentials.apiKey;
    const chatId = this.toChatId(payload.to);

    await this.ensureSessionWorking(baseUrl, sessionName, apiKey);

    if (!payload.skipHumanBehavior) {
      if (payload.markSeenMessageIds?.length) {
        await this.sendSeen(
          baseUrl,
          sessionName,
          apiKey,
          chatId,
          payload.markSeenMessageIds,
        );
      }

      await this.simulateTypingBeforeSend(
        baseUrl,
        sessionName,
        apiKey,
        chatId,
        payload.body,
      );
    }

    const response = await fetch(`${baseUrl}/api/sendText`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(payload.credentials.apiKey
          ? { 'X-Api-Key': payload.credentials.apiKey }
          : {}),
      },
      body: JSON.stringify({
        session: sessionName,
        chatId,
        text: payload.body,
      }),
    });

    const json = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(
        this.formatWahaHttpError('sendText', response.status, json),
      );
    }

    return {
      externalMessageId: this.extractMessageId(json),
      status: MessageStatus.SENT,
      raw: json,
    };
  }

  async sendVoiceMessage(
    payload: SendVoicePayload,
  ): Promise<ProviderSendResult> {
    const sessionName = this.getSessionName(payload.account);
    const baseUrl = this.getBaseUrl(payload.account);
    await this.ensureSessionWorking(
      baseUrl,
      sessionName,
      payload.credentials.apiKey,
    );

    const apiKey = payload.credentials.apiKey;
    const chatId = this.toChatId(payload.to);
    const file = this.buildVoiceFile(payload);

    if (this.isTypingEnabled()) {
      await this.simulateTypingBeforeSend(
        baseUrl,
        sessionName,
        apiKey,
        chatId,
        '',
        calculateVoiceTypingDelayMs(this.getTypingDelayConfig()),
      );
    }

    const body: Record<string, unknown> = {
      session: sessionName,
      chatId,
      file,
    };

    if (payload.convert !== undefined) {
      body.convert = payload.convert;
    }

    const response = await fetch(`${baseUrl}/api/sendVoice`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(payload.credentials.apiKey
          ? { 'X-Api-Key': payload.credentials.apiKey }
          : {}),
      },
      body: JSON.stringify(body),
    });

    const json = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(
        this.formatWahaHttpError('sendVoice', response.status, json),
      );
    }

    return {
      externalMessageId: this.extractMessageId(json),
      status: MessageStatus.SENT,
      raw: json,
    };
  }

  async sendTemplateMessage(
    payload: SendTemplatePayload,
  ): Promise<ProviderSendResult> {
    const rendered = [
      payload.templateName,
      ...Object.values(payload.variables ?? {}),
    ]
      .filter(Boolean)
      .join(' | ');

    return this.sendTextMessage({
      account: payload.account,
      credentials: payload.credentials,
      to: payload.to,
      body: rendered || payload.templateName,
    });
  }

  extractAccountReference(payload: unknown): AccountReference | null {
    const session = (payload as WahaWebhookPayload | null)?.session;

    return typeof session === 'string' && session.length > 0
      ? { externalId: session }
      : null;
  }

  parseWebhookEvents(payload: unknown): ProviderWebhookEvent[] {
    const body = payload as WahaWebhookPayload;
    const event = body.event;
    const message = body.payload;

    if (!event || !message?.id) {
      return [];
    }

    if (event === 'message' && !message.fromMe && message.from) {
      return [
        {
          kind: 'message',
          phone: this.fromChatId(message.from),
          content: message.body ?? '',
          providerMessageId: message.id,
          externalAccountId: body.session,
          timestamp: this.parseTimestamp(message.timestamp),
        },
      ];
    }

    if (event === 'message.ack') {
      return [
        {
          kind: 'status',
          providerMessageId: message.id,
          status: this.mapAckStatus(message.ack),
          externalAccountId: body.session,
          timestamp: this.parseTimestamp(message.timestamp),
        },
      ];
    }

    return [];
  }

  private getSessionName(account: {
    businessAccountId?: string | null;
    metadata?: unknown;
  }): string {
    if (account.businessAccountId) {
      return account.businessAccountId;
    }

    const metadata =
      account.metadata && typeof account.metadata === 'object'
        ? (account.metadata as Record<string, unknown>)
        : null;
    const sessionName = metadata?.sessionName;

    if (typeof sessionName === 'string' && sessionName.length > 0) {
      return sessionName;
    }

    return 'default';
  }

  private getBaseUrl(account: { metadata?: unknown }): string {
    const metadata =
      account.metadata && typeof account.metadata === 'object'
        ? (account.metadata as Record<string, unknown>)
        : null;
    const baseUrl = metadata?.baseUrl;

    if (typeof baseUrl === 'string' && baseUrl.length > 0) {
      return baseUrl.replace(/\/$/, '');
    }

    throw new Error('WAHA account metadata.baseUrl is missing.');
  }

  private buildVoiceFile(payload: SendVoicePayload): Record<string, string> {
    const mimetype = payload.mimetype?.trim() || 'audio/ogg; codecs=opus';

    if (payload.url?.trim()) {
      return {
        mimetype,
        url: payload.url.trim(),
      };
    }

    if (payload.data?.trim()) {
      const file: Record<string, string> = {
        mimetype,
        data: payload.data.trim(),
      };

      if (payload.filename?.trim()) {
        file.filename = payload.filename.trim();
      }

      return file;
    }

    throw new Error(
      'Voice file is required. Provide either "url" or "data" (base64).',
    );
  }

  private toChatId(phone: string): string {
    return `${normalizePhoneNumber(phone).slice(1)}@c.us`;
  }

  private fromChatId(value: string): string {
    const normalized = value.replace(/@s\.whatsapp\.net$/i, '@c.us');
    const match = normalized.match(/^(\d+)@c\.us$/i);

    if (!match) {
      throw new Error(`Unsupported WAHA chat id "${value}".`);
    }

    return normalizePhoneNumber(`+${match[1]}`);
  }

  private parseTimestamp(value?: string | number): Date | undefined {
    if (typeof value === 'number') {
      return new Date(value * 1000);
    }

    if (typeof value === 'string' && value.trim()) {
      const numeric = Number(value);
      if (!Number.isNaN(numeric)) {
        return new Date(numeric * 1000);
      }
    }

    return undefined;
  }

  private mapAckStatus(ack?: number): MessageStatus {
    switch (ack) {
      case 2:
        return MessageStatus.DELIVERED;
      case 3:
      case 4:
        return MessageStatus.READ;
      case -1:
        return MessageStatus.FAILED;
      default:
        return MessageStatus.SENT;
    }
  }

  private extractMessageId(payload: unknown): string | null {
    if (typeof payload === 'string') {
      const trimmed = payload.trim();
      return trimmed.length > 0 ? trimmed : null;
    }

    if (typeof payload === 'number' && Number.isFinite(payload)) {
      return String(payload);
    }

    if (!payload || typeof payload !== 'object') {
      return null;
    }

    const record = payload as Record<string, unknown>;
    const candidates = [
      record.messageId,
      record.id,
      record._serialized,
      record.serialized,
      record.message,
      record.key,
    ];

    for (const candidate of candidates) {
      const normalized = this.extractMessageId(candidate);
      if (normalized) {
        return normalized;
      }
    }

    return null;
  }

  private async ensureSessionWorking(
    baseUrl: string,
    sessionName: string,
    apiKey: string,
  ) {
    const session = await this.fetchWahaJson(
      baseUrl,
      `/api/sessions/${encodeURIComponent(sessionName)}`,
      apiKey,
      {},
      'WAHA session status check failed',
    );
    const status = this.getSessionStatus(session);

    if (status === 'WORKING') {
      return session;
    }

    if (status === 'SCAN_QR_CODE') {
      throw new Error(
        'WAHA session needs QR re-linking. Open /whatsapp/setup and scan the QR again.',
      );
    }

    const action = status === 'FAILED' ? 'restart' : 'start';
    await this.fetchWahaJson(
      baseUrl,
      `/api/sessions/${encodeURIComponent(sessionName)}/${action}`,
      apiKey,
      {
        method: 'POST',
      },
      `WAHA session ${action} failed`,
    );

    const readySession = await this.waitForWorkingSession(
      baseUrl,
      sessionName,
      apiKey,
    );
    const readyStatus = this.getSessionStatus(readySession);

    if (readyStatus === 'WORKING') {
      return readySession;
    }

    if (readyStatus === 'SCAN_QR_CODE') {
      throw new Error(
        'WAHA session restarted but now needs QR re-linking. Open /whatsapp/setup and scan the QR again.',
      );
    }

    throw new Error(
      `WAHA session is still not ready for sending. Current status: ${readyStatus ?? 'unknown'}.`,
    );
  }

  private async waitForWorkingSession(
    baseUrl: string,
    sessionName: string,
    apiKey: string,
    attempts = 15,
    delayMs = 1000,
  ) {
    let latestSession: unknown = null;

    for (let attempt = 0; attempt < attempts; attempt += 1) {
      latestSession = await this.fetchWahaJson(
        baseUrl,
        `/api/sessions/${encodeURIComponent(sessionName)}`,
        apiKey,
        {},
        'WAHA session status poll failed',
      );
      const status = this.getSessionStatus(latestSession);

      if (status === 'WORKING' || status === 'SCAN_QR_CODE') {
        return latestSession;
      }

      if (attempt < attempts - 1) {
        await this.sleep(delayMs);
      }
    }

    return latestSession;
  }

  private getSessionStatus(payload: unknown) {
    const status = (payload as Record<string, unknown> | null)?.status;
    return typeof status === 'string' ? status : null;
  }

  private async fetchWahaJson(
    baseUrl: string,
    path: string,
    apiKey: string,
    init: RequestInit,
    errorPrefix: string,
  ) {
    const response = await fetch(`${baseUrl}${path}`, {
      method: init.method ?? 'GET',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(apiKey ? { 'X-Api-Key': apiKey } : {}),
        ...(init.headers ?? {}),
      },
      body: init.body,
    });
    const json = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(`${errorPrefix}: ${JSON.stringify(json)}`);
    }

    return json;
  }

  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private isTypingEnabled() {
    const raw = this.configService.get<string>('WAHA_TYPING_ENABLED');
    return raw === undefined || raw === '' || raw === 'true' || raw === '1';
  }

  private getTypingDelayConfig() {
    return resolveTypingDelayConfig({
      minMs: this.readPositiveInt('WAHA_TYPING_MIN_MS', 1500),
      maxMs: this.readPositiveInt('WAHA_TYPING_MAX_MS', 12000),
      msPerChar: this.readPositiveInt('WAHA_TYPING_MS_PER_CHAR', 55),
      jitterMs: this.readPositiveInt('WAHA_TYPING_JITTER_MS', 400),
    });
  }

  private readPositiveInt(key: string, fallback: number) {
    const value = Number(this.configService.get(key));
    return Number.isFinite(value) && value > 0 ? value : fallback;
  }

  private async simulateTypingBeforeSend(
    baseUrl: string,
    sessionName: string,
    apiKey: string,
    chatId: string,
    text: string,
    delayOverrideMs?: number,
  ) {
    if (!this.isTypingEnabled()) {
      return;
    }

    try {
      await this.startTyping(baseUrl, sessionName, apiKey, chatId);
      const delayMs =
        delayOverrideMs ??
        calculateTypingDelayMs(text, this.getTypingDelayConfig());
      await this.sleep(delayMs);
      await this.stopTyping(baseUrl, sessionName, apiKey, chatId);
    } catch {
      // Typing simulation is best-effort; still attempt the actual send.
    }
  }

  private async startTyping(
    baseUrl: string,
    sessionName: string,
    apiKey: string,
    chatId: string,
  ) {
    await this.postWahaAction(baseUrl, '/api/startTyping', apiKey, {
      session: sessionName,
      chatId,
    });
  }

  private async stopTyping(
    baseUrl: string,
    sessionName: string,
    apiKey: string,
    chatId: string,
  ) {
    await this.postWahaAction(baseUrl, '/api/stopTyping', apiKey, {
      session: sessionName,
      chatId,
    });
  }

  private async sendSeen(
    baseUrl: string,
    sessionName: string,
    apiKey: string,
    chatId: string,
    messageIds: string[],
  ) {
    const ids = messageIds.map((id) => id.trim()).filter(Boolean);

    if (ids.length === 0) {
      return;
    }

    try {
      await this.postWahaAction(baseUrl, '/api/sendSeen', apiKey, {
        session: sessionName,
        chatId,
        messageIds: ids,
      });
    } catch {
      // Best-effort for reply flows.
    }
  }

  private async postWahaAction(
    baseUrl: string,
    path: string,
    apiKey: string,
    body: Record<string, unknown>,
  ) {
    await this.fetchWahaJson(
      baseUrl,
      path,
      apiKey,
      {
        method: 'POST',
        body: JSON.stringify(body),
      },
      `WAHA ${path} failed`,
    );
  }

  private formatWahaHttpError(
    operation: string,
    status: number,
    payload: unknown,
  ): string {
    const serializedPayload = JSON.stringify(payload);
    if (/no LID found/i.test(serializedPayload)) {
      return 'Not a WhatsApp number.';
    }

    const record =
      payload && typeof payload === 'object'
        ? (payload as Record<string, unknown>)
        : null;
    const message = typeof record?.message === 'string' ? record.message : null;

    if (
      message &&
      (/plus version/i.test(message) ||
        (/plus/i.test(message) && /voice/i.test(message)))
    ) {
      return (
        'WAHA voice messages require WAHA Plus (not included in free WAHA Core with WEBJS). ' +
        'Use POST /api/sendText for personalized text outreach, or upgrade: https://waha.devlike.pro/docs/how-to/waha-plus/'
      );
    }

    if (message) {
      return `WAHA ${operation} failed (${status}): ${message}`;
    }

    return `WAHA ${operation} failed (${status}): ${JSON.stringify(payload)}`;
  }
}
