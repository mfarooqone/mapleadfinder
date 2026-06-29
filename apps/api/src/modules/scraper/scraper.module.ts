import { Module } from '@nestjs/common';
import { LeadsModule } from '../leads/leads.module';
import { ScraperService } from './scraper.service';

@Module({
  imports: [LeadsModule],
  providers: [ScraperService],
  exports: [ScraperService],
})
export class ScraperModule {}
