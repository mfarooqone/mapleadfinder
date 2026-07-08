export type OutgoingMessageType = 'text' | 'voice';

export type VoiceFileInput = {
  url?: string;
  data?: string;
  filename?: string;
  mimetype?: string;
  convert?: boolean;
};

export type VoiceFilePayload = {
  url?: string;
  data?: string;
  filename?: string;
  mimetype?: string;
  convert?: boolean;
};

export type VoiceMessageMetadata = {
  type: 'voice';
  voice: VoiceFilePayload;
  source?: string;
};

export function resolveOutgoingMessageType(
  value?: string,
): OutgoingMessageType {
  return value === 'voice' ? 'voice' : 'text';
}

export function resolveVoiceFile(input: VoiceFileInput): VoiceFilePayload {
  const url = input.url?.trim();
  const data = input.data?.trim();

  if (!url && !data) {
    throw new Error(
      'Provide either "url" (voice file URL) or "data" (base64-encoded file).',
    );
  }

  if (url && data) {
    throw new Error('Provide only one of "url" or "data", not both.');
  }

  return {
    url,
    data,
    filename: input.filename?.trim() || undefined,
    mimetype: input.mimetype?.trim() || undefined,
    convert: input.convert,
  };
}

export function buildVoiceContentLabel(voice: VoiceFilePayload): string {
  return voice.url
    ? `[voice] ${voice.url}`
    : `[voice] ${voice.filename ?? 'base64'}`;
}

export function buildVoiceMessageMetadata(
  voice: VoiceFilePayload,
  source?: string,
): VoiceMessageMetadata {
  return {
    type: 'voice',
    voice,
    ...(source ? { source } : {}),
  };
}

export function readVoiceFromMessageMetadata(
  metadata: unknown,
): VoiceFilePayload | null {
  if (!metadata || typeof metadata !== 'object') {
    return null;
  }

  const record = metadata as Record<string, unknown>;

  if (record.type !== 'voice') {
    return null;
  }

  const voice = record.voice;

  if (!voice || typeof voice !== 'object') {
    return null;
  }

  const voiceRecord = voice as Record<string, unknown>;

  return {
    url: typeof voiceRecord.url === 'string' ? voiceRecord.url : undefined,
    data: typeof voiceRecord.data === 'string' ? voiceRecord.data : undefined,
    filename:
      typeof voiceRecord.filename === 'string'
        ? voiceRecord.filename
        : undefined,
    mimetype:
      typeof voiceRecord.mimetype === 'string'
        ? voiceRecord.mimetype
        : undefined,
    convert:
      typeof voiceRecord.convert === 'boolean'
        ? voiceRecord.convert
        : undefined,
  };
}
