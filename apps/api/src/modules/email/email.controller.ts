import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { SendBulkEmailDto } from './dto/send-bulk-email.dto';
import { ListMailboxMessagesQueryDto } from './dto/list-mailbox-messages-query.dto';
import { UpsertEmailAiSettingsDto } from './dto/upsert-email-ai-settings.dto';
import { UpsertMailboxSettingsDto } from './dto/upsert-mailbox-settings.dto';
import { UpsertSmtpSettingsDto } from './dto/upsert-smtp-settings.dto';
import { EmailAiService } from './email-ai.service';
import { EmailMailboxService } from './email-mailbox.service';
import { EmailService } from './email.service';

@Controller('email')
export class EmailController {
  constructor(
    private readonly emailService: EmailService,
    private readonly emailMailboxService: EmailMailboxService,
    private readonly emailAiService: EmailAiService,
  ) {}

  @Get('smtp-settings')
  getSmtpSettings(@CurrentUser() user: AuthenticatedUser) {
    return this.emailService.getSmtpSettings(user.id);
  }

  @Post('smtp-settings')
  upsertSmtpSettings(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpsertSmtpSettingsDto,
  ) {
    return this.emailService.upsertSmtpSettings(user.id, dto);
  }

  @Post('smtp-settings/test')
  testSmtpSettings(@CurrentUser() user: AuthenticatedUser) {
    return this.emailService.testSmtpSettings(user.id);
  }

  @Post('bulk-send')
  sendBulkEmail(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SendBulkEmailDto,
  ) {
    return this.emailService.sendBulkEmail({ ...dto, userId: user.id });
  }

  @Get('campaigns')
  listCampaigns(@CurrentUser() user: AuthenticatedUser) {
    return this.emailService.listCampaigns(user.id);
  }

  @Get('bulk-progress')
  getBulkProgress(
    @CurrentUser() user: AuthenticatedUser,
    @Query('campaignId') campaignId?: string,
  ) {
    return this.emailService.getBulkProgress(user.id, campaignId);
  }

  @Post('bulk-stop')
  stopBulkEmail(
    @CurrentUser() user: AuthenticatedUser,
    @Body('campaignId') campaignId?: string,
  ) {
    return this.emailService.stopBulkEmail(user.id, campaignId);
  }

  @Post('bulk-pause')
  pauseBulkEmail(
    @CurrentUser() user: AuthenticatedUser,
    @Body('campaignId') campaignId?: string,
  ) {
    return this.emailService.pauseBulkEmail(user.id, campaignId);
  }

  @Post('bulk-resume')
  resumeBulkEmail(
    @CurrentUser() user: AuthenticatedUser,
    @Body('campaignId') campaignId?: string,
  ) {
    return this.emailService.resumeBulkEmail(user.id, campaignId);
  }

  @Post('bulk-retry-failed')
  retryFailedBulkEmail(
    @CurrentUser() user: AuthenticatedUser,
    @Body('campaignId') campaignId?: string,
  ) {
    return this.emailService.retryFailedBulkEmail(user.id, campaignId);
  }

  @Get('ai-settings')
  getAiSettings(@CurrentUser() user: AuthenticatedUser) {
    return this.emailAiService.getSettings(user.id);
  }

  @Post('ai-settings')
  upsertAiSettings(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpsertEmailAiSettingsDto,
  ) {
    return this.emailAiService.upsertSettings(user.id, dto);
  }

  @Post('ai-settings/test')
  testAiSettings(@CurrentUser() user: AuthenticatedUser) {
    return this.emailAiService.testSettings(user.id);
  }

  @Get('mailbox/settings')
  getMailboxSettings(@CurrentUser() user: AuthenticatedUser) {
    return this.emailMailboxService.getSettings(user.id);
  }

  @Post('mailbox/settings')
  upsertMailboxSettings(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpsertMailboxSettingsDto,
  ) {
    return this.emailMailboxService.upsertSettings(user.id, dto);
  }

  @Post('mailbox/settings/test')
  testMailboxSettings(@CurrentUser() user: AuthenticatedUser) {
    return this.emailMailboxService.testSettings(user.id);
  }

  @Post('mailbox/sync')
  syncMailbox(@CurrentUser() user: AuthenticatedUser) {
    return this.emailMailboxService.syncRecentMailbox(user.id);
  }

  @Get('mailbox/messages')
  listMailboxMessages(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListMailboxMessagesQueryDto,
  ) {
    return this.emailMailboxService.listMessages(user.id, query);
  }

  @Get('mailbox/messages/:id')
  getMailboxMessage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.emailMailboxService.getMessage(user.id, id);
  }

  @Post('mailbox/messages/:id/read')
  markMailboxMessageRead(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body('isRead') isRead?: boolean,
  ) {
    return this.emailMailboxService.markRead(user.id, id, isRead ?? true);
  }
}
