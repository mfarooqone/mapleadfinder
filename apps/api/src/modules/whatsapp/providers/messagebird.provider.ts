import { Injectable } from '@nestjs/common';
import { ProviderType } from '@prisma/client';
import {
  AccountReference,
  ProviderSendResult,
  ProviderWebhookEvent,
  SendTemplatePayload,
  SendTextPayload,
  WhatsAppProviderAdapter,
} from './types';

@Injectable()
export class MessageBirdProvider implements WhatsAppProviderAdapter {
  supports(provider: ProviderType): boolean {
    return provider === ProviderType.MESSAGEBIRD;
  }

  async sendTextMessage(_: SendTextPayload): Promise<ProviderSendResult> {
    throw new Error(
      'MessageBird adapter is not implemented yet. Start with Meta Cloud API for the lowest-cost official integration.',
    );
  }

  async sendTemplateMessage(
    _: SendTemplatePayload,
  ): Promise<ProviderSendResult> {
    throw new Error(
      'MessageBird template sending is not implemented yet. Start with Meta Cloud API for the lowest-cost official integration.',
    );
  }

  extractAccountReference(_: unknown): AccountReference | null {
    return null;
  }

  parseWebhookEvents(_: unknown): ProviderWebhookEvent[] {
    return [];
  }
}
