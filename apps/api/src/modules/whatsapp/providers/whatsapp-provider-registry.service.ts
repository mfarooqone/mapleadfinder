import { Injectable } from '@nestjs/common';
import { ProviderType } from '@prisma/client';
import { BaileysProvider } from './baileys.provider';
import { Dialog360Provider } from './dialog360.provider';
import { MessageBirdProvider } from './messagebird.provider';
import { MetaCloudProvider } from './meta-cloud.provider';
import { WhatsAppProviderAdapter } from './types';
import { TwilioProvider } from './twilio.provider';
import { WahaProvider } from './waha.provider';

@Injectable()
export class WhatsAppProviderRegistryService {
  private readonly providers: WhatsAppProviderAdapter[];

  constructor(
    baileysProvider: BaileysProvider,
    wahaProvider: WahaProvider,
    metaCloudProvider: MetaCloudProvider,
    twilioProvider: TwilioProvider,
    dialog360Provider: Dialog360Provider,
    messageBirdProvider: MessageBirdProvider,
  ) {
    this.providers = [
      baileysProvider,
      wahaProvider,
      metaCloudProvider,
      twilioProvider,
      dialog360Provider,
      messageBirdProvider,
    ];
  }

  get(provider: ProviderType): WhatsAppProviderAdapter {
    const adapter = this.providers.find((candidate) =>
      candidate.supports(provider),
    );

    if (!adapter) {
      throw new Error(`Provider adapter missing for ${provider}.`);
    }

    return adapter;
  }
}
