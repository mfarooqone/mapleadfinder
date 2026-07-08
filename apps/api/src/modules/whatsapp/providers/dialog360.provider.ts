import { Injectable } from '@nestjs/common';
import { MessageStatus, ProviderType } from '@prisma/client';
import {
  AccountReference,
  ProviderSendResult,
  ProviderWebhookEvent,
  SendTemplatePayload,
  SendTextPayload,
  WhatsAppProviderAdapter,
} from './types';

@Injectable()
export class Dialog360Provider implements WhatsAppProviderAdapter {
  supports(provider: ProviderType): boolean {
    return provider === ProviderType.DIALOG360;
  }

  async sendTextMessage(payload: SendTextPayload): Promise<ProviderSendResult> {
    const response = await fetch('https://waba-v2.360dialog.io/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'D360-API-KEY': payload.credentials.apiKey,
      },
      body: JSON.stringify({
        to: payload.to,
        type: 'text',
        text: {
          body: payload.body,
        },
      }),
    });

    const json = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(`360dialog send failed: ${JSON.stringify(json)}`);
    }

    return {
      externalMessageId: json?.messages?.[0]?.id ?? null,
      status: MessageStatus.SENT,
      raw: json,
    };
  }

  async sendTemplateMessage(
    payload: SendTemplatePayload,
  ): Promise<ProviderSendResult> {
    const response = await fetch('https://waba-v2.360dialog.io/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'D360-API-KEY': payload.credentials.apiKey,
      },
      body: JSON.stringify({
        to: payload.to,
        type: 'template',
        template: {
          name: payload.templateName,
          language: {
            code: payload.language ?? 'en_US',
          },
          ...(payload.variables
            ? {
                components: [
                  {
                    type: 'body',
                    parameters: Object.values(payload.variables).map(
                      (value) => ({
                        type: 'text',
                        text: value,
                      }),
                    ),
                  },
                ],
              }
            : {}),
        },
      }),
    });

    const json = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(
        `360dialog template send failed: ${JSON.stringify(json)}`,
      );
    }

    return {
      externalMessageId: json?.messages?.[0]?.id ?? null,
      status: MessageStatus.SENT,
      raw: json,
    };
  }

  extractAccountReference(payload: unknown): AccountReference | null {
    const externalId = (payload as any)?.entry?.[0]?.changes?.[0]?.value
      ?.metadata?.phone_number_id;
    return externalId ? { externalId } : null;
  }

  parseWebhookEvents(payload: unknown): ProviderWebhookEvent[] {
    const metaCompatible = payload as any;
    const changes =
      metaCompatible?.entry?.flatMap((entry) => entry.changes ?? []) ?? [];
    const events: ProviderWebhookEvent[] = [];

    for (const change of changes) {
      const externalAccountId = change?.value?.metadata?.phone_number_id;

      for (const message of change?.value?.messages ?? []) {
        if (!message?.from) {
          continue;
        }

        events.push({
          kind: 'message',
          phone: message.from,
          content: message?.text?.body ?? '',
          providerMessageId: message.id,
          externalAccountId,
        });
      }

      for (const status of change?.value?.statuses ?? []) {
        if (!status?.id || !status?.status) {
          continue;
        }

        events.push({
          kind: 'status',
          providerMessageId: status.id,
          status: this.mapStatus(status.status),
          phone: status.recipient_id,
          externalAccountId,
        });
      }
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
        return MessageStatus.FAILED;
      default:
        return MessageStatus.SENT;
    }
  }
}
