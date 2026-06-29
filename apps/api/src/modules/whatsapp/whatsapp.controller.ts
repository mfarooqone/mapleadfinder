import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { BootstrapBaileysTestingDto } from './dto/bootstrap-baileys-testing.dto';
import { BootstrapMetaTestingDto } from './dto/bootstrap-meta-testing.dto';
import { BootstrapTwilioTestingDto } from './dto/bootstrap-twilio-testing.dto';
import { BootstrapWahaTestingDto } from './dto/bootstrap-waha-testing.dto';
import { ConnectWhatsAppAccountDto } from './dto/connect-whatsapp-account.dto';
import { RegisterMetaPhoneDto } from './dto/register-meta-phone.dto';
import { RequestMetaVerificationCodeDto } from './dto/request-meta-verification-code.dto';
import { SendMetaTestMessageDto } from './dto/send-meta-test-message.dto';
import { SendWahaBulkMessageDto } from './dto/send-waha-bulk-message.dto';
import { SendTwilioTestMessageDto } from './dto/send-twilio-test-message.dto';
import { SendWahaTestMessageDto } from './dto/send-waha-test-message.dto';
import { QueueVoiceMessageDto } from './dto/send-voice-message.dto';
import {
  SendBaileysScriptVoiceMessageDto,
  SendWahaVoiceMessageDto,
} from './dto/send-waha-voice-message.dto';
import { SendWhatsAppMessageDto } from './dto/send-whatsapp-message.dto';
import { VerifyMetaCodeDto } from './dto/verify-meta-code.dto';
import { WhatsappService } from './whatsapp.service';

@Controller('whatsapp')
export class WhatsappController {
  constructor(private readonly whatsappService: WhatsappService) {}

  @Post('accounts/connect')
  connectAccount(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ConnectWhatsAppAccountDto,
  ) {
    return this.whatsappService.connectAccount({
      ...dto,
      userId: user.id,
    });
  }

  @Get('accounts')
  findAccounts(@CurrentUser() user: AuthenticatedUser) {
    return this.whatsappService.findAccounts(user.id);
  }

  @Get('outreach/stats')
  getOutreachStats(
    @CurrentUser() user: AuthenticatedUser,
    @Query('whatsappAccountId') whatsappAccountId?: string,
  ) {
    return this.whatsappService.getOutreachStats(user.id, whatsappAccountId);
  }

  @Get('testing/meta/status')
  getMetaTestingStatus(@CurrentUser() user: AuthenticatedUser) {
    return this.whatsappService.getMetaTestingStatus(user.id);
  }

  @Get('testing/waha/status')
  getWahaTestingStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Query('sessionName') sessionName?: string,
  ) {
    return this.whatsappService.getWahaTestingStatus(user.id, sessionName);
  }

  @Get('testing/baileys/status')
  getBaileysTestingStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Query('sessionName') sessionName?: string,
  ) {
    return this.whatsappService.getBaileysTestingStatus(user.id, sessionName);
  }

  @Get('testing/baileys/qr')
  getBaileysTestingQr(
    @CurrentUser() user: AuthenticatedUser,
    @Query('sessionName') sessionName?: string,
  ) {
    return this.whatsappService.getBaileysQr(user.id, sessionName);
  }

  @Get('testing/waha/qr')
  getWahaTestingQr(
    @CurrentUser() user: AuthenticatedUser,
    @Query('sessionName') sessionName?: string,
  ) {
    return this.whatsappService.getWahaQr(user.id, sessionName);
  }

  @Get('testing/twilio/status')
  getTwilioTestingStatus(@CurrentUser() user: AuthenticatedUser) {
    return this.whatsappService.getTwilioTestingStatus(user.id);
  }

  @Get('meta/status')
  getMetaStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Query('profile') profile?: string,
  ) {
    return this.whatsappService.getMetaTestingStatus(user.id, profile);
  }

  @Post('testing/meta/bootstrap')
  bootstrapMetaTesting(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: BootstrapMetaTestingDto,
  ) {
    return this.whatsappService.bootstrapMetaTesting({
      ...dto,
      userId: user.id,
    });
  }

  @Post('testing/waha/bootstrap')
  bootstrapWahaTesting(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: BootstrapWahaTestingDto,
  ) {
    return this.whatsappService.bootstrapWahaTesting({
      ...dto,
      userId: user.id,
    });
  }

  @Post('testing/waha/disconnect')
  disconnectWahaTesting(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: BootstrapWahaTestingDto,
  ) {
    return this.whatsappService.disconnectWahaTesting({
      ...dto,
      userId: user.id,
    });
  }

  @Post('testing/baileys/bootstrap')
  bootstrapBaileysTesting(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: BootstrapBaileysTestingDto,
  ) {
    return this.whatsappService.bootstrapBaileysTesting({
      ...dto,
      userId: user.id,
    });
  }

  @Post('testing/twilio/bootstrap')
  bootstrapTwilioTesting(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: BootstrapTwilioTestingDto,
  ) {
    return this.whatsappService.bootstrapTwilioTesting({
      ...dto,
      userId: user.id,
    });
  }

  @Post('meta/registration/request-code')
  requestMetaVerificationCode(@Body() dto: RequestMetaVerificationCodeDto) {
    return this.whatsappService.requestMetaVerificationCode(dto);
  }

  @Post('meta/registration/verify-code')
  verifyMetaCode(@Body() dto: VerifyMetaCodeDto) {
    return this.whatsappService.verifyMetaCode(dto);
  }

  @Post('meta/registration/register')
  registerMetaPhone(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RegisterMetaPhoneDto,
  ) {
    return this.whatsappService.registerMetaPhone({
      ...dto,
      userId: user.id,
    });
  }

  @Post('testing/meta/send')
  sendMetaTestMessage(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SendMetaTestMessageDto,
  ) {
    return this.whatsappService.sendMetaTestMessage({
      ...dto,
      userId: user.id,
    });
  }

  @Post('testing/waha/send')
  sendWahaTestMessage(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SendWahaTestMessageDto,
  ) {
    return this.whatsappService.sendWahaTestMessage({
      ...dto,
      userId: user.id,
    });
  }

  @Get('voice')
  getVoiceApiInfo() {
    return this.whatsappService.getVoiceApiInfo();
  }

  @Post('voice/send')
  sendVoiceMessage(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SendWahaVoiceMessageDto,
  ) {
    return this.whatsappService.sendVoiceMessage({
      ...dto,
      userId: user.id,
      metadataSource: 'api',
    });
  }

  @Post('voice/queue')
  queueVoiceMessage(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: QueueVoiceMessageDto,
  ) {
    return this.whatsappService.queueVoiceMessage({
      ...dto,
      userId: user.id,
    });
  }

  @Post('testing/waha/send-voice')
  sendWahaVoiceMessage(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SendWahaVoiceMessageDto,
  ) {
    return this.whatsappService.sendWahaVoiceMessage({
      ...dto,
      userId: user.id,
      metadataSource: 'waha-testing',
    });
  }

  @Post('testing/baileys/send-voice')
  sendBaileysVoiceMessage(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SendWahaVoiceMessageDto,
  ) {
    return this.whatsappService.sendBaileysVoiceMessage({
      ...dto,
      userId: user.id,
      metadataSource: 'baileys-testing',
    });
  }

  @Post('testing/baileys/send-script-voice')
  sendBaileysScriptVoiceMessage(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SendBaileysScriptVoiceMessageDto,
  ) {
    return this.whatsappService.sendBaileysScriptVoiceMessage({
      ...dto,
      userId: user.id,
      metadataSource: 'baileys-script-voice',
    });
  }

  @Post('testing/waha/bulk-send')
  sendWahaBulkMessage(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SendWahaBulkMessageDto,
  ) {
    return this.whatsappService.sendWahaBulkMessage({
      ...dto,
      userId: user.id,
    });
  }

  @Get('testing/waha/bulk-progress')
  getWahaBulkProgress(
    @CurrentUser() user: AuthenticatedUser,
    @Query('campaignId') campaignId?: string,
  ) {
    return this.whatsappService.getBulkCampaignProgress(user.id, campaignId);
  }

  @Post('testing/waha/bulk-stop')
  stopWahaBulkCampaign(
    @CurrentUser() user: AuthenticatedUser,
    @Body('campaignId') campaignId?: string,
  ) {
    return this.whatsappService.stopBulkCampaign(user.id, campaignId);
  }

  @Post('testing/twilio/send')
  sendTwilioTestMessage(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SendTwilioTestMessageDto,
  ) {
    return this.whatsappService.sendTwilioTestMessage({
      ...dto,
      userId: user.id,
    });
  }

  @Post('send')
  send(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SendWhatsAppMessageDto,
  ) {
    return this.whatsappService.queueMessage({
      ...dto,
      userId: user.id,
    });
  }
}
