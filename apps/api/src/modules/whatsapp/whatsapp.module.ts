import { Module } from '@nestjs/common';
import { ConversationsModule } from '../conversations/conversations.module';
import { JobsModule } from '../jobs/jobs.module';
import { LeadsModule } from '../leads/leads.module';
import { OutreachModule } from '../outreach/outreach.module';
import { MessagesModule } from '../messages/messages.module';
import { SecurityModule } from '../security/security.module';
import { TemplatesModule } from '../templates/templates.module';
import { WhatsAppGatewayModule } from './whatsapp-gateway.module';
import { WhatsappController } from './whatsapp.controller';
import { WhatsappService } from './whatsapp.service';

@Module({
  imports: [
    ConversationsModule,
    LeadsModule,
    MessagesModule,
    TemplatesModule,
    JobsModule,
    OutreachModule,
    SecurityModule,
    WhatsAppGatewayModule,
  ],
  controllers: [WhatsappController],
  providers: [WhatsappService],
  exports: [WhatsappService],
})
export class WhatsappModule {}
