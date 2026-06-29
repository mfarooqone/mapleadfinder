import { ConfigService } from '@nestjs/config';

export type OutreachMode = 'warm_up_only' | 'safeguarded_cold';

export type OutreachConfig = {
  mode: OutreachMode;
  maxColdPerDay: number;
  minDelaySeconds: number;
  maxFirstMessageChars: number;
  requireIncoming: boolean;
  blockUrlsInFirstMessage: boolean;
  packageSize: number;
  packagePauseSeconds: number;
  recooldownDays: number;
};

export function resolveOutreachConfig(
  configService: ConfigService,
): OutreachConfig {
  const mode =
    (configService.get<string>('OUTREACH_MODE') as OutreachMode | undefined) ??
    'safeguarded_cold';
  const requireIncomingEnv = configService.get<string>(
    'OUTREACH_REQUIRE_INCOMING',
  );
  const requireIncoming =
    requireIncomingEnv !== undefined
      ? requireIncomingEnv !== 'false'
      : false;

  return {
    mode,
    maxColdPerDay: readPositiveInt(configService, 'OUTREACH_MAX_COLD_PER_DAY', 500),
    minDelaySeconds: readPositiveInt(
      configService,
      'OUTREACH_MIN_DELAY_SECONDS',
      90,
    ),
    maxFirstMessageChars: readPositiveInt(
      configService,
      'OUTREACH_MAX_FIRST_MESSAGE_CHARS',
      1000,
    ),
    requireIncoming,
    blockUrlsInFirstMessage:
      configService.get<string>('OUTREACH_BLOCK_URLS_FIRST') === 'true',
    packageSize: readPositiveInt(configService, 'OUTREACH_PACKAGE_SIZE', 4),
    packagePauseSeconds: readPositiveInt(
      configService,
      'OUTREACH_PACKAGE_PAUSE_SECONDS',
      3600,
    ),
    recooldownDays: readPositiveInt(configService, 'OUTREACH_RECOOLDOWN_DAYS', 7),
  };
}

function readPositiveInt(
  configService: ConfigService,
  key: string,
  fallback: number,
): number {
  const raw = Number(configService.get(key));
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : fallback;
}
