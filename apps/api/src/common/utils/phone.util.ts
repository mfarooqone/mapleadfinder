import { BadRequestException } from '@nestjs/common';

export function normalizePhoneNumber(input: string): string {
  const withoutPrefix = input.trim().replace(/^whatsapp:/i, '');
  const digits = withoutPrefix.replace(/[^\d+]/g, '');
  const normalized = digits.startsWith('+') ? digits : `+${digits}`;

  if (!/^\+\d{8,15}$/.test(normalized)) {
    throw new BadRequestException(
      `Invalid phone number "${input}". Use E.164 format, for example +923001234567.`,
    );
  }

  return normalized;
}

export function toTwilioWhatsappAddress(phone: string): string {
  return phone.startsWith('whatsapp:') ? phone : `whatsapp:${phone}`;
}
