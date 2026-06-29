import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getOverview() {
    return {
      name: 'whatsapp-agent-backend',
      stack: {
        framework: 'NestJS',
        database: 'PostgreSQL + Prisma',
        jobEngine: 'Database jobs + @nestjs/schedule',
        providerStrategy: 'Official APIs via provider adapters',
        redis: false,
      },
      recommendedProvider: 'WAHA',
      voiceApi: {
        info: 'GET /whatsapp/voice',
        send: 'POST /whatsapp/voice/send',
        queue: 'POST /whatsapp/voice/queue',
        testingSend: 'POST /whatsapp/testing/waha/send-voice',
        requiresWahaPlus: true,
      },
      modules: [
        'whatsapp',
        'webhook',
        'leads',
        'templates',
        'conversations',
        'messages',
        'jobs',
        'ai',
      ],
      notes: [
        'Use approved templates outside the 24-hour reply window.',
        'Only send to opted-in leads.',
        'WAHA is the easiest free self-hosted path when you want QR-based testing with your own WhatsApp number.',
      ],
    };
  }
}
