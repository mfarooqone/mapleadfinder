import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ProviderType } from '@prisma/client';
import { normalizePhoneNumber } from '../../common/utils/phone.util';
import { PrismaService } from '../../prisma/prisma.service';
import { ConversationsService } from '../conversations/conversations.service';
import { JobsService } from '../jobs/jobs.service';
import { LeadsService } from '../leads/leads.service';
import { MessagesService } from '../messages/messages.service';
import { SecretVaultService } from '../security/secret-vault.service';
import { parseProviderParam } from '../whatsapp/providers/provider.util';
import { WhatsAppProviderRegistryService } from '../whatsapp/providers/whatsapp-provider-registry.service';

@Injectable()
export class WebhookService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly conversationsService: ConversationsService,
    private readonly messagesService: MessagesService,
    private readonly leadsService: LeadsService,
    private readonly jobsService: JobsService,
    private readonly secretVaultService: SecretVaultService,
    private readonly providerRegistry: WhatsAppProviderRegistryService,
    private readonly configService: ConfigService,
  ) {}

  async verifyChallenge(
    providerParam: string,
    query: Record<string, string | undefined>,
  ) {
    const provider = parseProviderParam(providerParam);
    if (provider !== ProviderType.META_CLOUD) {
      return {
        verified: true,
        provider,
        message:
          'This provider does not require GET verification in this starter backend.',
      };
    }

    const verifyToken = query['hub.verify_token'];
    const account = await this.prisma.whatsAppAccount.findFirst({
      where: {
        provider,
        webhookVerifyToken: verifyToken,
      },
    });

    if (!account) {
      throw new UnauthorizedException('Invalid webhook verify token.');
    }

    const providerAdapter = this.providerRegistry.get(provider);
    const challenge = providerAdapter.verifyWebhookChallenge?.(query, account);

    if (!challenge) {
      throw new UnauthorizedException('Webhook challenge validation failed.');
    }

    return challenge;
  }

  async handleIncoming(
    providerParam: string,
    payload: unknown,
    headers: Record<string, string | string[] | undefined>,
    rawBody?: Buffer,
    userId?: string,
    webhookSecret?: string,
  ) {
    const provider = parseProviderParam(providerParam);
    this.validateWahaWebhookSecret(provider, webhookSecret);

    const providerAdapter = this.providerRegistry.get(provider);
    const events = providerAdapter.parseWebhookEvents(payload);
    const processed: Array<Record<string, string>> = [];

    if (events.length === 0) {
      return {
        ok: true,
        provider,
        processedCount: 0,
        processed,
      };
    }

    const reference = providerAdapter.extractAccountReference(payload);
    const account = await this.resolveAccount(provider, reference, userId);

    if (!account) {
      throw new NotFoundException(
        `No connected account found for provider ${provider}.`,
      );
    }

    const credentials = {
      apiKey: this.secretVaultService.decrypt(account.apiKey) ?? '',
      apiSecret: this.secretVaultService.decrypt(account.apiSecret),
    };

    const signatureValid =
      providerAdapter.validateSignature?.({
        account,
        credentials,
        headers,
        rawBody,
      }) ?? true;

    if (!signatureValid) {
      throw new UnauthorizedException('Webhook signature validation failed.');
    }

    for (const event of events) {
      if (event.kind === 'message') {
        const phone = normalizePhoneNumber(event.phone);
        const lead = await this.leadsService.findByPhone(account.userId, phone);
        const conversation = await this.conversationsService.findOrCreate({
          userId: account.userId,
          whatsappAccountId: account.id,
          phone,
          leadId: lead?.id,
          lastMessageAt: event.timestamp ?? new Date(),
        });

        const message = await this.messagesService.createIncoming({
          conversationId: conversation.id,
          whatsappAccountId: account.id,
          phone,
          content: event.content,
          provider,
          providerMessageId: event.providerMessageId,
          metadata: {
            source: 'webhook',
          },
        });

        const incomingAt = event.timestamp ?? new Date();

        await this.conversationsService.touchIncoming(
          conversation.id,
          incomingAt,
        );

        await this.leadsService.markEngagedOnIncoming(
          account.userId,
          phone,
          incomingAt,
        );

        const normalizedContent = event.content.trim().toLowerCase();
        if (
          ['stop', 'unsubscribe', 'cancel', 'end', 'quit'].some((word) =>
            normalizedContent.includes(word),
          )
        ) {
          await this.leadsService.updateOptInByPhone(
            account.userId,
            phone,
            false,
          );
        }

        await this.jobsService.enqueueAiReply({
          userId: account.userId,
          whatsappAccountId: account.id,
          conversationId: conversation.id,
          leadId: lead?.id,
          incomingMessageId: message.id,
          phone,
        });

        processed.push({
          type: 'message',
          phone,
          conversationId: conversation.id,
          messageId: message.id,
        });
        continue;
      }

      await this.messagesService.updateStatusByProviderMessageId(
        event.providerMessageId,
        event.status,
        {
          userId: account.userId,
          whatsappAccountId: account.id,
        },
      );
      processed.push({
        type: 'status',
        providerMessageId: event.providerMessageId,
        status: event.status,
      });
    }

    return {
      ok: true,
      provider,
      processedCount: processed.length,
      processed,
    };
  }

  private validateWahaWebhookSecret(
    provider: ProviderType,
    webhookSecret?: string,
  ) {
    if (provider !== ProviderType.WAHA) {
      return;
    }

    const expectedSecret =
      this.configService.get<string>('WAHA_WEBHOOK_SECRET')?.trim() || '';

    if (expectedSecret && webhookSecret !== expectedSecret) {
      throw new UnauthorizedException('Invalid WAHA webhook secret.');
    }
  }

  private async resolveAccount(
    provider: ProviderType,
    reference: { externalId?: string; phoneNumber?: string } | null,
    userId?: string,
  ) {
    if (!reference) {
      return null;
    }

    if (reference.externalId) {
      return this.prisma.whatsAppAccount.findFirst({
        where: {
          ...(userId ? { userId } : {}),
          provider,
          OR: [
            { businessAccountId: reference.externalId },
            {
              metadata: {
                path: ['phoneNumberId'],
                equals: reference.externalId,
              },
            },
            {
              metadata: {
                path: ['sessionName'],
                equals: reference.externalId,
              },
            },
          ],
        },
      });
    }

    if (reference.phoneNumber) {
      return this.prisma.whatsAppAccount.findFirst({
        where: {
          ...(userId ? { userId } : {}),
          provider,
          phoneNumber: normalizePhoneNumber(reference.phoneNumber),
        },
      });
    }

    return null;
  }
}
