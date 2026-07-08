import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { Public } from '../auth/decorators/public.decorator';
import { WebhookService } from './webhook.service';

@Controller('webhooks/whatsapp')
export class WebhookController {
  constructor(private readonly webhookService: WebhookService) {}

  @Public()
  @Get(':provider')
  verify(
    @Param('provider') provider: string,
    @Query() query: Record<string, string | undefined>,
  ) {
    return this.webhookService.verifyChallenge(provider, query);
  }

  @Public()
  @Post(':provider')
  receive(
    @Param('provider') provider: string,
    @Query('userId') userId: string | undefined,
    @Query('secret') secret: string | undefined,
    @Body() payload: unknown,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Req() request: Request & { rawBody?: Buffer },
  ) {
    return this.webhookService.handleIncoming(
      provider,
      payload,
      headers,
      request.rawBody,
      userId,
      secret,
    );
  }
}
