import { Injectable } from '@nestjs/common';
import { MessageStatus, ProviderType } from '@prisma/client';
import {
  AccountReference,
  ProviderSendResult,
  ProviderWebhookEvent,
  SendTemplatePayload,
  SendTextPayload,
  SendVoicePayload,
  WhatsAppProviderAdapter,
} from './types';
import { BaileysSessionService } from './baileys-session.service';

@Injectable()
export class BaileysProvider implements WhatsAppProviderAdapter {
  constructor(private readonly sessions: BaileysSessionService) {}

  supports(provider: ProviderType): boolean {
    return provider === ProviderType.BAILEYS;
  }

  async sendTextMessage(payload: SendTextPayload): Promise<ProviderSendResult> {
    const sessionName = this.getSessionName(payload.account);
    const result = await this.sessions.sendText({
      sessionName,
      to: payload.to,
      body: payload.body,
    });

    return {
      externalMessageId: result.externalMessageId,
      status: MessageStatus.SENT,
      raw: result.raw,
    };
  }

  async sendVoiceMessage(
    payload: SendVoicePayload,
  ): Promise<ProviderSendResult> {
    const result = await this.sessions.sendVoice({
      sessionName: this.getSessionName(payload.account),
      to: payload.to,
      url: payload.url,
      data: payload.data,
      mimetype: payload.mimetype,
    });

    return {
      externalMessageId: result.externalMessageId,
      status: MessageStatus.SENT,
      raw: result.raw,
    };
  }

  async sendTemplateMessage(
    payload: SendTemplatePayload,
  ): Promise<ProviderSendResult> {
    return this.sendTextMessage({
      account: payload.account,
      credentials: payload.credentials,
      to: payload.to,
      body: [
        payload.templateName,
        ...Object.values(payload.variables ?? {}),
      ].join(' | '),
    });
  }

  extractAccountReference(): AccountReference | null {
    return null;
  }

  parseWebhookEvents(): ProviderWebhookEvent[] {
    return [];
  }

  private getSessionName(account: {
    businessAccountId?: string | null;
    metadata?: unknown;
  }) {
    if (account.businessAccountId) {
      return account.businessAccountId;
    }

    const metadata =
      account.metadata && typeof account.metadata === 'object'
        ? (account.metadata as Record<string, unknown>)
        : null;
    const sessionName = metadata?.sessionName;

    return typeof sessionName === 'string' && sessionName.trim()
      ? sessionName.trim()
      : 'default';
  }
}
