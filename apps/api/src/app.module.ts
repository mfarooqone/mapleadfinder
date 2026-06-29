import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './modules/auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { SecurityModule } from './modules/security/security.module';
import { LeadsModule } from './modules/leads/leads.module';
import { TemplatesModule } from './modules/templates/templates.module';
import { ConversationsModule } from './modules/conversations/conversations.module';
import { MessagesModule } from './modules/messages/messages.module';
import { AiModule } from './modules/ai/ai.module';
import { WhatsAppGatewayModule } from './modules/whatsapp/whatsapp-gateway.module';
import { JobsModule } from './modules/jobs/jobs.module';
import { WhatsappModule } from './modules/whatsapp/whatsapp.module';
import { WebhookModule } from './modules/webhook/webhook.module';
import { ScraperModule } from './modules/scraper/scraper.module';
import { ScrapeJobsModule } from './modules/scrape-jobs/jobs.module';
import { EmailModule } from './modules/email/email.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    SecurityModule,
    AuthModule,
    LeadsModule,
    TemplatesModule,
    ConversationsModule,
    MessagesModule,
    AiModule,
    WhatsAppGatewayModule,
    JobsModule,
    ScraperModule,
    ScrapeJobsModule,
    EmailModule,
    WhatsappModule,
    WebhookModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
