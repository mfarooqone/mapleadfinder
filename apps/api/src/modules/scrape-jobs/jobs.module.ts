import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LeadsModule } from '../leads/leads.module';
import { ScraperModule } from '../scraper/scraper.module';
import { JobsController } from './jobs.controller';
import { SCRAPE_QUEUE } from './jobs.constants';
import { ScrapeProcessor } from './scrape.processor';
import { ScrapeJobsService } from './jobs.service';

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>('REDIS_HOST', 'localhost'),
          port: Number(configService.get<string>('REDIS_PORT', '6379')),
        },
      }),
    }),
    BullModule.registerQueue({
      name: SCRAPE_QUEUE,
    }),
    LeadsModule,
    ScraperModule,
  ],
  controllers: [JobsController],
  providers: [ScrapeJobsService, ScrapeProcessor],
})
export class ScrapeJobsModule {}
