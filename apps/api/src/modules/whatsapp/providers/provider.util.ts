import { BadRequestException } from '@nestjs/common';
import { ProviderType } from '@prisma/client';

export function parseProviderParam(value: string): ProviderType {
  const normalized = value.trim().toLowerCase();

  switch (normalized) {
    case 'baileys':
      return ProviderType.BAILEYS;
    case 'waha':
      return ProviderType.WAHA;
    case 'meta':
    case 'meta-cloud':
    case 'meta_cloud':
      return ProviderType.META_CLOUD;
    case 'twilio':
      return ProviderType.TWILIO;
    case '360dialog':
    case 'dialog360':
    case 'd360':
      return ProviderType.DIALOG360;
    case 'messagebird':
      return ProviderType.MESSAGEBIRD;
    default:
      throw new BadRequestException(`Unsupported provider "${value}".`);
  }
}
