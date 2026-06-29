import { Injectable } from '@nestjs/common';
import { MessageStatus, ProviderType, WhatsAppAccount } from '@prisma/client';
import { createHmac } from 'crypto';
import {
  AccountReference,
  ProviderActionResult,
  ProviderSendResult,
  ProviderWebhookEvent,
  RegisterPhonePayload,
  RequestVerificationCodePayload,
  SendTemplatePayload,
  SendTextPayload,
  SignatureValidationInput,
  VerifyCodePayload,
  WhatsAppProviderAdapter,
} from './types';

type MetaWebhookChange = {
  value?: {
    metadata?: {
      phone_number_id?: string;
    };
    contacts?: Array<{
      wa_id?: string;
    }>;
    messages?: Array<{
      from?: string;
      id?: string;
      timestamp?: string;
      text?: {
        body?: string;
      };
    }>;
    statuses?: Array<{
      id?: string;
      status?: string;
      recipient_id?: string;
      timestamp?: string;
    }>;
  };
};

type MetaGraphErrorResponse = {
  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
    fbtrace_id?: string;
  };
};

@Injectable()
export class MetaCloudProvider implements WhatsAppProviderAdapter {
  private readonly apiVersion = 'v21.0';

  supports(provider: ProviderType): boolean {
    return provider === ProviderType.META_CLOUD;
  }

  async sendTextMessage(payload: SendTextPayload): Promise<ProviderSendResult> {
    const phoneNumberId = this.getPhoneNumberId(payload.account);
    const json = await this.postGraphCall(
      phoneNumberId,
      'messages',
      payload.credentials.apiKey,
      {
        messaging_product: 'whatsapp',
        to: payload.to,
        type: 'text',
        text: {
          body: payload.body,
        },
      },
      'Meta Cloud send failed',
    );

    return {
      externalMessageId: json?.messages?.[0]?.id ?? null,
      status: MessageStatus.SENT,
      raw: json,
    };
  }

  async sendTemplateMessage(
    payload: SendTemplatePayload,
  ): Promise<ProviderSendResult> {
    const phoneNumberId = this.getPhoneNumberId(payload.account);
    const parameters = Object.values(payload.variables ?? {}).map((value) => ({
      type: 'text',
      text: value,
    }));
    const json = await this.postGraphCall(
      phoneNumberId,
      'messages',
      payload.credentials.apiKey,
      {
        messaging_product: 'whatsapp',
        to: payload.to,
        type: 'template',
        template: {
          name: payload.templateName,
          language: {
            code: payload.language ?? 'en_US',
          },
          ...(parameters.length
            ? {
                components: [
                  {
                    type: 'body',
                    parameters,
                  },
                ],
              }
            : {}),
        },
      },
      'Meta Cloud template send failed',
    );

    return {
      externalMessageId: json?.messages?.[0]?.id ?? null,
      status: MessageStatus.SENT,
      raw: json,
    };
  }

  async requestVerificationCode(
    payload: RequestVerificationCodePayload,
  ): Promise<ProviderActionResult> {
    const json = await this.postGraphCall(
      payload.phoneNumberId,
      'request_code',
      payload.accessToken,
      {
        code_method: payload.codeMethod,
        locale: payload.locale,
      },
      'Meta Cloud request code failed',
    );

    return {
      success: Boolean(json?.success ?? true),
      raw: json,
    };
  }

  async verifyCode(payload: VerifyCodePayload): Promise<ProviderActionResult> {
    const json = await this.postGraphCall(
      payload.phoneNumberId,
      'verify_code',
      payload.accessToken,
      {
        code: payload.code,
      },
      'Meta Cloud verify code failed',
    );

    return {
      success: Boolean(json?.success ?? true),
      raw: json,
    };
  }

  async registerPhone(
    payload: RegisterPhonePayload,
  ): Promise<ProviderActionResult> {
    const json = await this.postGraphCall(
      payload.phoneNumberId,
      'register',
      payload.accessToken,
      {
        messaging_product: 'whatsapp',
        pin: payload.pin,
      },
      'Meta Cloud register phone failed',
    );

    return {
      success: Boolean(json?.success ?? true),
      raw: json,
    };
  }

  extractAccountReference(payload: unknown): AccountReference | null {
    const change = this.getFirstChange(payload);
    const externalId = change?.value?.metadata?.phone_number_id;
    return externalId ? { externalId } : null;
  }

  parseWebhookEvents(payload: unknown): ProviderWebhookEvent[] {
    const entries = Array.isArray((payload as { entry?: unknown[] })?.entry)
      ? ((payload as { entry: Array<{ changes?: MetaWebhookChange[] }> })
          .entry ?? [])
      : [];

    const events: ProviderWebhookEvent[] = [];

    for (const entry of entries) {
      for (const change of entry.changes ?? []) {
        const externalAccountId = change.value?.metadata?.phone_number_id;

        for (const message of change.value?.messages ?? []) {
          const phone = message.from ?? change.value?.contacts?.[0]?.wa_id;
          if (!phone) {
            continue;
          }

          events.push({
            kind: 'message',
            phone,
            content: message.text?.body ?? '',
            externalAccountId,
            providerMessageId: message.id,
            timestamp: this.parseTimestamp(message.timestamp),
          });
        }

        for (const status of change.value?.statuses ?? []) {
          if (!status.id || !status.status) {
            continue;
          }

          events.push({
            kind: 'status',
            providerMessageId: status.id,
            status: this.mapStatus(status.status),
            phone: status.recipient_id,
            externalAccountId,
            timestamp: this.parseTimestamp(status.timestamp),
          });
        }
      }
    }

    return events;
  }

  validateSignature(input: SignatureValidationInput): boolean {
    const signatureHeader = input.headers['x-hub-signature-256'];
    const signature = Array.isArray(signatureHeader)
      ? signatureHeader[0]
      : signatureHeader;

    if (!signature || !input.credentials.apiSecret || !input.rawBody) {
      return true;
    }

    const expected = `sha256=${createHmac('sha256', input.credentials.apiSecret)
      .update(input.rawBody)
      .digest('hex')}`;

    return signature === expected;
  }

  verifyWebhookChallenge(
    query: Record<string, string | undefined>,
    account: WhatsAppAccount,
  ): string | null {
    if (
      query['hub.mode'] !== 'subscribe' ||
      query['hub.verify_token'] !== account.webhookVerifyToken
    ) {
      return null;
    }

    return query['hub.challenge'] ?? null;
  }

  private getPhoneNumberId(account: WhatsAppAccount): string {
    if (account.businessAccountId) {
      return account.businessAccountId;
    }

    const metadata =
      account.metadata && typeof account.metadata === 'object'
        ? (account.metadata as Record<string, unknown>)
        : null;
    const phoneNumberId = metadata?.phoneNumberId;

    if (typeof phoneNumberId === 'string' && phoneNumberId.length > 0) {
      return phoneNumberId;
    }

    throw new Error(
      'Meta Cloud API requires businessAccountId or metadata.phoneNumberId.',
    );
  }

  private async postGraphCall(
    phoneNumberId: string,
    path: string,
    accessToken: string,
    body: Record<string, unknown>,
    errorPrefix: string,
  ): Promise<any> {
    const response = await fetch(
      `https://graph.facebook.com/${this.apiVersion}/${phoneNumberId}/${path}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      },
    );

    const json = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(this.formatGraphError(errorPrefix, json));
    }

    return json;
  }

  private formatGraphError(errorPrefix: string, payload: unknown): string {
    const graphError = (payload as MetaGraphErrorResponse | null)?.error;
    const message = graphError?.message?.trim();
    const code = graphError?.code;
    const subcode = graphError?.error_subcode;

    if (code === 190 && subcode === 463) {
      return `${errorPrefix}: Meta access token expired. Generate a fresh long-lived or system-user token, update the active Meta profile token in .env, then reconnect/bootstrap the account again.${message ? ` Meta says: ${message}` : ''}`;
    }

    if (code === 190) {
      return `${errorPrefix}: Meta access token is invalid. Update the active Meta profile token in .env and reconnect/bootstrap the account again.${message ? ` Meta says: ${message}` : ''}`;
    }

    return `${errorPrefix}: ${JSON.stringify(payload)}`;
  }

  private getFirstChange(payload: unknown): MetaWebhookChange | undefined {
    const entries = (
      payload as { entry?: Array<{ changes?: MetaWebhookChange[] }> }
    )?.entry;
    return entries?.[0]?.changes?.[0];
  }

  private parseTimestamp(value?: string): Date | undefined {
    if (!value) {
      return undefined;
    }

    const numeric = Number(value);
    if (Number.isNaN(numeric)) {
      return undefined;
    }

    return new Date(numeric * 1000);
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
