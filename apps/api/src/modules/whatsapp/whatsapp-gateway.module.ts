import { Module } from '@nestjs/common';
import { BaileysProvider } from './providers/baileys.provider';
import { BaileysSessionService } from './providers/baileys-session.service';
import { Dialog360Provider } from './providers/dialog360.provider';
import { MessageBirdProvider } from './providers/messagebird.provider';
import { MetaCloudProvider } from './providers/meta-cloud.provider';
import { TwilioProvider } from './providers/twilio.provider';
import { WahaProvider } from './providers/waha.provider';
import { WhatsAppProviderRegistryService } from './providers/whatsapp-provider-registry.service';

@Module({
  providers: [
    BaileysSessionService,
    BaileysProvider,
    WahaProvider,
    MetaCloudProvider,
    TwilioProvider,
    Dialog360Provider,
    MessageBirdProvider,
    WhatsAppProviderRegistryService,
  ],
  exports: [BaileysSessionService, WhatsAppProviderRegistryService],
})
export class WhatsAppGatewayModule {}
