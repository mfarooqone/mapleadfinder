import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { OutreachService } from './outreach.service';

@Module({
  imports: [PrismaModule],
  providers: [OutreachService],
  exports: [OutreachService],
})
export class OutreachModule {}
