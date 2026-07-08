import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { BulkDeleteLeadsDto } from './dto/bulk-delete-leads.dto';
import { BulkUpdateOptInDto } from './dto/bulk-update-opt-in.dto';
import { CreateLeadDto } from './dto/create-lead.dto';
import { EnrichDecisionMakersDto } from './dto/enrich-decision-makers.dto';
import { ListLeadsQueryDto } from './dto/list-leads-query.dto';
import { UpdateLeadStatusDto } from './dto/update-lead-status.dto';
import { UploadLeadsDto } from './dto/upload-leads.dto';
import { DecisionMakerService } from './decision-maker.service';
import { LeadsService } from './leads.service';

@Controller('leads')
export class LeadsController {
  constructor(
    private readonly leadsService: LeadsService,
    private readonly decisionMakerService: DecisionMakerService,
  ) {}

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateLeadDto) {
    return this.leadsService.create({
      ...dto,
      userId: user.id,
    });
  }

  @Post('upload')
  upload(@CurrentUser() user: AuthenticatedUser, @Body() dto: UploadLeadsDto) {
    return this.leadsService.uploadCsv({
      ...dto,
      userId: user.id,
    });
  }

  @Get()
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListLeadsQueryDto,
  ) {
    return this.leadsService.findAll(user.id, query);
  }

  @Patch('bulk/delete')
  removeMany(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: BulkDeleteLeadsDto,
  ) {
    return this.leadsService.removeMany(dto.ids, user.id);
  }

  @Patch('bulk/opt-in')
  updateManyOptIn(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: BulkUpdateOptInDto,
  ) {
    return this.leadsService.updateManyOptIn(dto.ids, user.id, dto.optIn);
  }

  @Post('decision-makers/enrich')
  enrichDecisionMakers(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: EnrichDecisionMakersDto,
  ) {
    return this.decisionMakerService.enrichLeads(user.id, dto.leadIds);
  }

  @Get(':id/decision-makers')
  listDecisionMakers(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.decisionMakerService.listForLead(user.id, id);
  }

  @Delete()
  removeAll(@CurrentUser() user: AuthenticatedUser) {
    return this.leadsService.removeAll(user.id);
  }

  @Get(':id/wa-me-link')
  getWaMeLink(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Query('text') text?: string,
  ) {
    return this.leadsService.getWaMeLink(user.id, id, text);
  }

  @Post(':id/wa-me-link/sent')
  markLinkSent(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.leadsService.markLinkSent(user.id, id);
  }

  @Patch(':id/status')
  updateStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateLeadStatusDto,
  ) {
    return this.leadsService.updateStatus(user.id, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.leadsService.remove(id, user.id);
  }
}
