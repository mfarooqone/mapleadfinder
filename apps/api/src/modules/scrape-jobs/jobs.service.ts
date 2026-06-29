import { InjectQueue } from '@nestjs/bullmq';
import { BadRequestException, Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { ListLeadsQueryDto } from '../leads/dto/list-leads-query.dto';
import { LeadsService } from '../leads/leads.service';
import { SCRAPE_GOOGLE_MAPS_JOB, SCRAPE_QUEUE } from './jobs.constants';

interface ScrapeJobData {
  userId: string;
  keyword: string;
  maxRecords?: number;
  findDecisionMakers?: boolean;
  cancelRequested?: boolean;
}

export interface ScrapeJobStatus {
  jobId: string | undefined;
  keyword?: string;
  maxRecords?: number;
  findDecisionMakers?: boolean;
  progress?: unknown;
  status: string;
  failedReason?: string;
  result?: unknown;
}

export interface ScrapeQueueResponse {
  jobs: ScrapeJobStatus[];
  keyword: string;
  maxRecords?: number;
  findDecisionMakers?: boolean;
  status: string;
  totalJobs: number;
}

@Injectable()
export class ScrapeJobsService {
  constructor(
    @InjectQueue(SCRAPE_QUEUE)
    private readonly scrapeQueue: Queue<ScrapeJobData>,
    private readonly leadsService: LeadsService,
  ) {}

  async enqueueScrape(
    userId: string,
    keyword: string,
    maxRecords?: number,
    findDecisionMakers = false,
  ): Promise<ScrapeQueueResponse> {
    const keywords = this.parseKeywords(keyword);
    const jobs: ScrapeJobStatus[] = [];

    if (!keywords.length) {
      throw new BadRequestException('Enter at least one search keyword.');
    }

    for (const searchKeyword of keywords) {
      const job = await this.scrapeQueue.add(
        SCRAPE_GOOGLE_MAPS_JOB,
        { userId, keyword: searchKeyword, maxRecords, findDecisionMakers },
        {
          attempts: 2,
          backoff: {
            type: 'exponential',
            delay: 5000,
          },
          removeOnComplete: {
            count: 50,
          },
          removeOnFail: {
            count: 100,
          },
        },
      );

      jobs.push({
        jobId: job.id,
        keyword: searchKeyword,
        maxRecords,
        findDecisionMakers,
        status: 'queued',
      });
    }

    return {
      jobs,
      keyword: keywords.join(', '),
      maxRecords,
      findDecisionMakers,
      status: 'queued',
      totalJobs: jobs.length,
    };
  }

  async stopScrape(
    userId: string,
    jobId: string,
  ): Promise<{ success: boolean }> {
    const job = await this.scrapeQueue.getJob(jobId);

    if (job && job.data.userId === userId) {
      const state = await job.getState();
      if (state === 'active') {
        await job.updateData({
          ...job.data,
          cancelRequested: true,
        });
      } else {
        await job.remove();
      }
    }

    return { success: true };
  }

  async getScrapeStatus(
    userId: string,
    jobId: string,
  ): Promise<ScrapeJobStatus> {
    const job = await this.scrapeQueue.getJob(jobId);

    if (!job || job.data.userId !== userId) {
      return {
        jobId,
        status: 'not_found',
      };
    }

    const state = await job.getState();
    const failedReason: string | undefined = job.failedReason;
    const result: unknown = job.returnvalue;

    return {
      jobId: job.id,
      keyword: job.data.keyword,
      maxRecords: job.data.maxRecords,
      findDecisionMakers: job.data.findDecisionMakers,
      progress: job.progress,
      status: state,
      failedReason,
      result,
    };
  }

  listScrapeBatches(userId: string) {
    return this.leadsService.listScrapeBatches(userId);
  }

  getScrapeBatchLeads(
    userId: string,
    batchId: string,
    query: ListLeadsQueryDto,
  ) {
    return this.leadsService.findByScrapeBatch(userId, batchId, query);
  }

  removeScrapeBatch(
    userId: string,
    batchId: string,
    deleteContacts = false,
  ) {
    return this.leadsService.removeScrapeBatch(
      userId,
      batchId,
      deleteContacts,
    );
  }

  removeLeadFromScrapeBatch(
    userId: string,
    batchId: string,
    leadId: string,
  ) {
    return this.leadsService.removeLeadFromScrapeBatch(userId, batchId, leadId);
  }

  private parseKeywords(keyword: string) {
    const keywords = keyword
      .split(',')
      .map((part) => part.trim())
      .filter((part) => part.length >= 2);

    return Array.from(new Set(keywords)).slice(0, 20);
  }
}
