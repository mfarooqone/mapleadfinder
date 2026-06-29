import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { ConversationsModule } from '../conversations/conversations.module';
import { MessagesModule } from '../messages/messages.module';
import { SecurityModule } from '../security/security.module';
import { TemplatesModule } from '../templates/templates.module';
import { WhatsAppGatewayModule } from '../whatsapp/whatsapp-gateway.module';
import { EmailAiService } from '../email/email-ai.service';
import { JobsProcessor } from './jobs.processor';
import { JobsService } from './jobs.service';

@Module({
  imports: [
    MessagesModule,
    ConversationsModule,
    TemplatesModule,
    AiModule,
    SecurityModule,
    WhatsAppGatewayModule,
  ],
  providers: [JobsService, JobsProcessor, EmailAiService],
  exports: [JobsService],
})
export class JobsModule {}
