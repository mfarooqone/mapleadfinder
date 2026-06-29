import { Injectable } from '@nestjs/common';
import { MessageStatus, ProviderType } from '@prisma/client';
import {
  normalizePhoneNumber,
  toTwilioWhatsappAddress,
} from '../../../common/utils/phone.util';
import {
  AccountReference,
  ProviderSendResult,
  ProviderWebhookEvent,
  SendTemplatePayload,
  SendTextPayload,
  WhatsAppProviderAdapter,
} from './types';

@Injectable()
export class TwilioProvider implements WhatsAppProviderAdapter {
  supports(provider: ProviderType): boolean {
    return provider === ProviderType.TWILIO;
  }

  async sendTextMessage(payload: SendTextPayload): Promise<ProviderSendResult> {
    if (!payload.account.businessAccountId) {
      throw new Error('Twilio account requires businessAccountId = Account SID.');
    }

    const metadata =
      payload.account.metadata && typeof payload.account.metadata === 'object'
        ? (payload.account.metadata as Record<string, unknown>)
        : {};
    const from =
      typeof metadata.fromPhoneNumber === 'string'
        ? normalizePhoneNumber(metadata.fromPhoneNumber)
        : payload.account.phoneNumber;

    const form = new URLSearchParams({
      To: toTwilioWhatsappAddress(payload.to),
      From: toTwilioWhatsappAddress(from),
      Body: payload.body,
    });

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${payload.account.businessAccountId}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(
            `${payload.account.businessAccountId}:${payload.credentials.apiKey}`,
          ).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: form.toString(),
      },
    );

    const json = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(`Twilio send failed: ${JSON.stringify(json)}`);
    }

    return {
      externalMessageId: json?.sid ?? null,
      status: MessageStatus.SENT,
      raw: json,
    };
  }

  async sendTemplateMessage(
    payload: SendTemplatePayload,
  ): Promise<ProviderSendResult> {
    const body = [payload.templateName, ...Object.values(payload.variables ?? {})].join(
      ' | ',
    );
    return this.sendTextMessage({
      account: payload.account,
      credentials: payload.credentials,
      to: payload.to,
      body,
    });
  }

  extractAccountReference(payload: unknown): AccountReference | null {
    const body = payload as Record<string, unknown>;
    if (typeof body.To !== 'string') {
      return null;
    }

    return {
      phoneNumber: normalizePhoneNumber(body.To),
    };
  }

  parseWebhookEvents(payload: unknown): ProviderWebhookEvent[] {
    const body = payload as Record<string, unknown>;
    const events: ProviderWebhookEvent[] = [];

    if (typeof body.From === 'string' && typeof body.Body === 'string') {
      events.push({
        kind: 'message',
        phone: normalizePhoneNumber(body.From),
        content: body.Body,
        providerMessageId: typeof body.MessageSid === 'string' ? body.MessageSid : undefined,
      });
    }

    if (typeof body.MessageSid === 'string' && typeof body.MessageStatus === 'string') {
      events.push({
        kind: 'status',
        providerMessageId: body.MessageSid,
        status: this.mapStatus(body.MessageStatus),
        phone: typeof body.To === 'string' ? normalizePhoneNumber(body.To) : undefined,
      });
    }

    return events;
  }

  private mapStatus(status: string): MessageStatus {
    switch (status.toLowerCase()) {
      case 'delivered':
        return MessageStatus.DELIVERED;
      case 'read':
        return MessageStatus.READ;
      case 'failed':
      case 'undelivered':
        return MessageStatus.FAILED;
      default:
        return MessageStatus.SENT;
    }
  }
}
