import { MessageStatus, ProviderType, WhatsAppAccount } from '@prisma/client';

export type ProviderCredentials = {
  apiKey: string;
  apiSecret?: string | null;
};

export type ProviderSendResult = {
  externalMessageId?: string | null;
  status: MessageStatus;
  raw?: unknown;
};

export type ProviderActionResult = {
  success: boolean;
  raw?: unknown;
};

export type SendTextPayload = {
  account: WhatsAppAccount;
  credentials: ProviderCredentials;
  to: string;
  body: string;
  /** WAHA: mark incoming message(s) read before typing (reply flow). */
  markSeenMessageIds?: string[];
  /** WAHA: skip startTyping/delay/stopTyping (testing only). */
  skipHumanBehavior?: boolean;
};

export type SendTemplatePayload = {
  account: WhatsAppAccount;
  credentials: ProviderCredentials;
  to: string;
  templateName: string;
  language?: string;
  variables?: Record<string, string>;
};

export type SendVoicePayload = {
  account: WhatsAppAccount;
  credentials: ProviderCredentials;
  to: string;
  url?: string;
  data?: string;
  filename?: string;
  mimetype?: string;
  convert?: boolean;
};

export type AccountReference = {
  externalId?: string;
  phoneNumber?: string;
};

export type ProviderMessageEvent = {
  kind: 'message';
  phone: string;
  content: string;
  externalAccountId?: string;
  providerMessageId?: string;
  timestamp?: Date;
};

export type ProviderStatusEvent = {
  kind: 'status';
  providerMessageId: string;
  status: MessageStatus;
  phone?: string;
  externalAccountId?: string;
  timestamp?: Date;
};

export type ProviderWebhookEvent = ProviderMessageEvent | ProviderStatusEvent;

export type SignatureValidationInput = {
  account: WhatsAppAccount;
  credentials: ProviderCredentials;
  headers: Record<string, string | string[] | undefined>;
  rawBody?: Buffer;
};

export type VerificationCodeMethod = 'SMS' | 'VOICE';

export type RequestVerificationCodePayload = {
  phoneNumberId: string;
  accessToken: string;
  codeMethod: VerificationCodeMethod;
  locale: string;
};

export type VerifyCodePayload = {
  phoneNumberId: string;
  accessToken: string;
  code: string;
};

export type RegisterPhonePayload = {
  phoneNumberId: string;
  accessToken: string;
  pin: string;
};

export interface WhatsAppProviderAdapter {
  supports(provider: ProviderType): boolean;
  sendTextMessage(payload: SendTextPayload): Promise<ProviderSendResult>;
  sendVoiceMessage?(payload: SendVoicePayload): Promise<ProviderSendResult>;
  sendTemplateMessage(
    payload: SendTemplatePayload,
  ): Promise<ProviderSendResult>;
  extractAccountReference(payload: unknown): AccountReference | null;
  parseWebhookEvents(payload: unknown): ProviderWebhookEvent[];
  requestVerificationCode?(
    payload: RequestVerificationCodePayload,
  ): Promise<ProviderActionResult>;
  verifyCode?(payload: VerifyCodePayload): Promise<ProviderActionResult>;
  registerPhone?(payload: RegisterPhonePayload): Promise<ProviderActionResult>;
  validateSignature?(input: SignatureValidationInput): boolean;
  verifyWebhookChallenge?(
    query: Record<string, string | undefined>,
    account: WhatsAppAccount,
  ): string | null;
}
