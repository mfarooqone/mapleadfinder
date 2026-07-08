import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { ListLeadsQueryDto } from '../leads/dto/list-leads-query.dto';
import { StartScrapeDto } from './dto/start-scrape.dto';
import { ScrapeJobsService } from './jobs.service';

@Controller('scrape')
export class JobsController {
  constructor(private readonly jobsService: ScrapeJobsService) {}

  @Post()
  startScrape(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: StartScrapeDto,
  ) {
    return this.jobsService.enqueueScrape(
      user.id,
      body.keyword,
      body.maxRecords,
      body.findDecisionMakers,
    );
  }

  @Delete(':jobId')
  stopScrape(
    @CurrentUser() user: AuthenticatedUser,
    @Param('jobId') jobId: string,
  ) {
    return this.jobsService.stopScrape(user.id, jobId);
  }

  @Get('batches')
  listScrapeBatches(@CurrentUser() user: AuthenticatedUser) {
    return this.jobsService.listScrapeBatches(user.id);
  }

  @Get('batches/:batchId/leads')
  getScrapeBatchLeads(
    @CurrentUser() user: AuthenticatedUser,
    @Param('batchId') batchId: string,
    @Query() query: ListLeadsQueryDto,
  ) {
    return this.jobsService.getScrapeBatchLeads(user.id, batchId, query);
  }

  @Delete('batches/:batchId')
  removeScrapeBatch(
    @CurrentUser() user: AuthenticatedUser,
    @Param('batchId') batchId: string,
    @Query('deleteContacts') deleteContacts?: string,
  ) {
    return this.jobsService.removeScrapeBatch(
      user.id,
      batchId,
      deleteContacts === 'true',
    );
  }

  @Delete('batches/:batchId/leads/:leadId')
  removeLeadFromScrapeBatch(
    @CurrentUser() user: AuthenticatedUser,
    @Param('batchId') batchId: string,
    @Param('leadId') leadId: string,
  ) {
    return this.jobsService.removeLeadFromScrapeBatch(user.id, batchId, leadId);
  }

  @Get(':jobId')
  getScrapeStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('jobId') jobId: string,
  ) {
    return this.jobsService.getScrapeStatus(user.id, jobId);
  }
}
