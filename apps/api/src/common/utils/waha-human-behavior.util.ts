export type TypingDelayConfig = {
  minMs: number;
  maxMs: number;
  msPerChar: number;
  jitterMs: number;
};

const DEFAULT_TYPING_DELAY: TypingDelayConfig = {
  minMs: 1500,
  maxMs: 12000,
  msPerChar: 55,
  jitterMs: 400,
};

export function resolveTypingDelayConfig(input?: Partial<TypingDelayConfig>): TypingDelayConfig {
  return {
    minMs: input?.minMs ?? DEFAULT_TYPING_DELAY.minMs,
    maxMs: input?.maxMs ?? DEFAULT_TYPING_DELAY.maxMs,
    msPerChar: input?.msPerChar ?? DEFAULT_TYPING_DELAY.msPerChar,
    jitterMs: input?.jitterMs ?? DEFAULT_TYPING_DELAY.jitterMs,
  };
}

export function calculateTypingDelayMs(
  text: string,
  config: TypingDelayConfig = DEFAULT_TYPING_DELAY,
): number {
  const length = Math.max(text.trim().length, 8);
  const jitter = Math.floor(Math.random() * (config.jitterMs * 2 + 1)) - config.jitterMs;
  const estimated = Math.round(length * config.msPerChar + jitter);

  return Math.min(config.maxMs, Math.max(config.minMs, estimated));
}

export function calculateVoiceTypingDelayMs(
  config: TypingDelayConfig = DEFAULT_TYPING_DELAY,
): number {
  return Math.min(config.maxMs, Math.max(config.minMs, Math.round(config.minMs * 1.2)));
}
