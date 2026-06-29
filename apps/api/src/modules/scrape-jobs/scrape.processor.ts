import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job, Queue, Worker } from 'bullmq';
import { ScraperService } from '../scraper/scraper.service';
import { SCRAPE_GOOGLE_MAPS_JOB, SCRAPE_QUEUE } from './jobs.constants';

interface ScrapeJobData {
  userId: string;
  keyword: string;
  maxRecords?: number;
  findDecisionMakers?: boolean;
  cancelRequested?: boolean;
}

@Injectable()
export class ScrapeProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ScrapeProcessor.name);
  private worker?: Worker<ScrapeJobData>;

  constructor(
    private readonly configService: ConfigService,
    private readonly scraperService: ScraperService,
    @InjectQueue(SCRAPE_QUEUE)
    private readonly scrapeQueue: Queue<ScrapeJobData>,
  ) {}

  onModuleInit() {
    this.worker = new Worker<ScrapeJobData>(
      SCRAPE_QUEUE,
      (job) => this.process(job),
      {
        connection: {
          host: this.configService.get<string>('REDIS_HOST', 'localhost'),
          port: Number(this.configService.get<string>('REDIS_PORT', '6379')),
        },
        concurrency: 1,
      },
    );

    this.worker.on('ready', () => {
      this.logger.log(`Scrape worker is ready for queue "${SCRAPE_QUEUE}"`);
    });

    this.worker.on('active', (job) => {
      this.logger.log(`Started scrape job ${job.id} for "${job.data.keyword}"`);
    });

    this.worker.on('completed', (job) => {
      this.logger.log(`Completed scrape job ${job.id}`);
    });

    this.worker.on('failed', (job, error) => {
      this.logger.error(
        `Scrape job ${job?.id ?? 'unknown'} failed: ${error.message}`,
      );
    });

    this.worker.on('error', (error) => {
      this.logger.error(`Scrape worker error: ${error.message}`);
    });
  }

  async onModuleDestroy() {
    await this.worker?.close();
  }

  private async process(job: Job<ScrapeJobData>): Promise<unknown> {
    if (job.name !== SCRAPE_GOOGLE_MAPS_JOB) {
      this.logger.warn(`Unknown scrape job "${job.name}" was ignored`);
      return null;
    }

    await job.updateProgress(10);
    const batch = await this.scraperService.createScrapeBatch(
      job.data.userId,
      job.data.keyword,
      job.data.maxRecords,
    );

    const result = await this.scraperService.scrapeGoogleMaps(
      job.data.userId,
      job.data.keyword,
      job.data.maxRecords,
      (progress) => job.updateProgress(progress),
      batch.id,
      async () => {
        const freshJob = await this.scrapeQueue.getJob(job.id ?? '');
        return Boolean(freshJob?.data.cancelRequested);
      },
    );

    if (job.data.findDecisionMakers) {
      const decisionMakerResult =
        await this.scraperService.enrichDecisionMakersForBatch(
          job.data.userId,
          batch.id,
          (progress) => job.updateProgress(progress),
        );

      await job.updateProgress(100);

      return {
        ...result,
        decisionMakers: decisionMakerResult,
      };
    }

    await job.updateProgress(100);

    return result;
  }
}
