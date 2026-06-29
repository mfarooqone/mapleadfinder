import { Module } from '@nestjs/common';
import { ConversationsModule } from '../conversations/conversations.module';
import { JobsModule } from '../jobs/jobs.module';
import { LeadsModule } from '../leads/leads.module';
import { MessagesModule } from '../messages/messages.module';
import { SecurityModule } from '../security/security.module';
import { WhatsAppGatewayModule } from '../whatsapp/whatsapp-gateway.module';
import { WebhookController } from './webhook.controller';
import { WebhookService } from './webhook.service';

@Module({
  imports: [
    ConversationsModule,
    MessagesModule,
    LeadsModule,
    JobsModule,
    SecurityModule,
    WhatsAppGatewayModule,
  ],
  controllers: [WebhookController],
  providers: [WebhookService],
})
export class WebhookModule {}
