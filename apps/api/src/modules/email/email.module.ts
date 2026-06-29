import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { JobsModule } from '../jobs/jobs.module';
import { SecurityModule } from '../security/security.module';
import { EmailController } from './email.controller';
import { EmailAiService } from './email-ai.service';
import { EmailMailboxService } from './email-mailbox.service';
import { EmailService } from './email.service';

@Module({
  imports: [PrismaModule, JobsModule, SecurityModule],
  controllers: [EmailController],
  providers: [EmailService, EmailMailboxService, EmailAiService],
  exports: [EmailAiService],
})
export class EmailModule {}
