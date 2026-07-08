import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { randomUUID } from 'crypto';
import { ImapFlow, type ListResponse } from 'imapflow';
import nodemailer from 'nodemailer';
import {
  Job,
  JobType,
  MessageStatus,
  Prisma,
  ProviderType,
  TemplateStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { ConversationsService } from '../conversations/conversations.service';
import { MessagesService } from '../messages/messages.service';
import { SecretVaultService } from '../security/secret-vault.service';
import { EmailAiService } from '../email/email-ai.service';
import { readVoiceFromMessageMetadata } from '../../common/utils/voice-message.util';
import { WhatsAppProviderRegistryService } from '../whatsapp/providers/whatsapp-provider-registry.service';
import {
  AiReplyJobPayload,
  FollowUpJobPayload,
  JobsService,
  SendEmailJobPayload,
  SendWhatsAppJobPayload,
} from './jobs.service';

@Injectable()
export class JobsProcessor {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly jobsService: JobsService,
    private readonly messagesService: MessagesService,
    private readonly conversationsService: ConversationsService,
    private readonly aiService: AiService,
    private readonly secretVaultService: SecretVaultService,
    private readonly providerRegistry: WhatsAppProviderRegistryService,
    private readonly emailAiService: EmailAiService,
  ) {}

  @Cron('* * * * * *')
  async processDueJobs() {
    await this.jobsService.recoverStaleJobs();

    const limit = Number(this.configService.get('JOB_BATCH_SIZE') ?? 10);
    const delayMs = Number(this.configService.get('JOB_RATE_DELAY_MS') ?? 250);
    const jobs = await this.jobsService.acquireDueJobs(limit);

    for (const job of jobs) {
      try {
        await this.processJob(job);
        await this.jobsService.complete(job.id);
        await this.afterEmailJobSettled(job, true);
      } catch (error) {
        const failedJob = await this.jobsService.fail(job, error);
        await this.afterEmailJobSettled(job, false, failedJob.status, error);

        const payload = job.payload as Record<string, unknown>;
        if (typeof payload.messageId === 'string') {
          await this.messagesService.markFailed(
            payload.messageId,
            this.formatJobError(error),
            {
              userId:
                typeof payload.userId === 'string' ? payload.userId : undefined,
              whatsappAccountId:
                typeof payload.whatsappAccountId === 'string'
                  ? payload.whatsappAccountId
                  : undefined,
            },
          );
        }
      }

      await this.sleep(delayMs);
    }
  }

  private async processJob(job: Job) {
    switch (job.type) {
      case JobType.SEND_WHATSAPP:
        await this.handleSendWhatsApp(job);
        return;
      case JobType.SEND_EMAIL:
        await this.handleSendEmail(job);
        return;
      case JobType.AI_REPLY:
        await this.handleAiReply(job);
        return;
      case JobType.FOLLOW_UP:
        await this.handleFollowUp(job);
        return;
      default:
        return;
    }
  }

  private async handleSendWhatsApp(job: Job) {
    const payload = job.payload as unknown as SendWhatsAppJobPayload;
    const message = await this.prisma.message.findUnique({
      where: { id: payload.messageId },
      include: {
        conversation: true,
        template: true,
      },
    });

    if (!message) {
      throw new Error(`Message ${payload.messageId} not found.`);
    }

    if (
      message.conversation.userId !== payload.userId ||
      message.whatsappAccountId !== payload.whatsappAccountId ||
      message.conversationId !== payload.conversationId
    ) {
      throw new Error(
        'Queued WhatsApp message does not belong to this account.',
      );
    }

    const account = await this.prisma.whatsAppAccount.findUnique({
      where: { id: payload.whatsappAccountId },
    });

    if (!account || !account.isActive || account.userId !== payload.userId) {
      throw new Error('WhatsApp account is missing or inactive.');
    }

    const credentials = {
      apiKey: this.secretVaultService.decrypt(account.apiKey) ?? '',
      apiSecret: this.secretVaultService.decrypt(account.apiSecret),
    };

    if (this.requiresApiKey(account.provider) && !credentials.apiKey) {
      throw new Error('Provider API key is missing.');
    }

    const provider = this.providerRegistry.get(account.provider);
    const outside24Hours = this.isOutside24HourWindow(
      message.conversation.lastIncomingAt,
    );
    const requiresTemplates = this.requiresOfficialTemplateWindow(
      account.provider,
    );

    let result: {
      externalMessageId?: string | null;
      status: MessageStatus;
      raw?: unknown;
    };

    if (requiresTemplates && outside24Hours) {
      if (
        !message.template ||
        message.template.status !== TemplateStatus.APPROVED
      ) {
        throw new Error(
          'Outside the 24-hour window. Only approved template messages are allowed.',
        );
      }

      result = await provider.sendTemplateMessage({
        account,
        credentials,
        to: message.phone,
        templateName: message.template.name,
        language: message.template.language,
        variables: payload.templateVariables,
      });
    } else if (
      requiresTemplates &&
      message.template &&
      message.template.status === TemplateStatus.APPROVED
    ) {
      result = await provider.sendTemplateMessage({
        account,
        credentials,
        to: message.phone,
        templateName: message.template.name,
        language: message.template.language,
        variables: payload.templateVariables,
      });
    } else {
      const voice = readVoiceFromMessageMetadata(message.metadata);

      if (voice) {
        if (!provider.sendVoiceMessage) {
          throw new Error(
            `Voice messages are not supported for provider ${account.provider}.`,
          );
        }

        result = await provider.sendVoiceMessage({
          account,
          credentials,
          to: message.phone,
          url: voice.url,
          data: voice.data,
          filename: voice.filename,
          mimetype: voice.mimetype,
          convert: voice.convert,
        });
      } else {
        const markSeenMessageIds = this.resolveMarkSeenMessageIds(
          message.metadata,
        );

        result = await provider.sendTextMessage({
          account,
          credentials,
          to: message.phone,
          body: message.content,
          markSeenMessageIds,
        });
      }
    }

    await this.messagesService.markSent({
      messageId: message.id,
      userId: payload.userId,
      whatsappAccountId: payload.whatsappAccountId,
      provider: account.provider,
      providerMessageId: result.externalMessageId,
      rawResponse: (result.raw ?? null) as Prisma.InputJsonValue,
    });
    await this.conversationsService.touchOutgoing(message.conversationId);
    if (payload.leadId) {
      await this.prisma.lead.updateMany({
        where: {
          id: payload.leadId,
          userId: payload.userId,
          isDeleted: false,
        },
        data: {
          lastOutgoingAt: new Date(),
        },
      });
    }
  }

  private async afterEmailJobSettled(
    job: Job,
    succeeded: boolean,
    finalStatus?: string,
    error?: unknown,
  ) {
    if (job.type !== JobType.SEND_EMAIL) {
      return;
    }

    const payload = job.payload as Partial<SendEmailJobPayload>;
    const campaignId = payload.campaignId;
    const userId = payload.userId;

    if (!userId) {
      return;
    }

    if (payload.leadId) {
      if (succeeded) {
        await this.prisma.lead.updateMany({
          where: {
            id: payload.leadId,
            userId,
            isDeleted: false,
          },
          data: {
            lastOutgoingAt: new Date(),
            emailLastSentAt: new Date(),
            emailDeliveryStatus: 'SENT',
            emailLastError: null,
          },
        });
      } else if (finalStatus === 'FAILED') {
        await this.prisma.lead.updateMany({
          where: {
            id: payload.leadId,
            userId,
            isDeleted: false,
          },
          data: {
            emailDeliveryStatus: 'BOUNCED',
            emailLastBounceAt: new Date(),
            emailLastError: this.formatJobError(error),
          },
        });
      }
    }

    if (campaignId) {
      await this.refreshEmailCampaignStats(userId, campaignId);
    }
  }

  private async refreshEmailCampaignStats(userId: string, campaignId: string) {
    const campaign = await this.prisma.emailCampaign.findFirst({
      where: { id: campaignId, userId },
    });
    if (!campaign) return;

    const [jobs, replied, bounced] = await Promise.all([
      this.prisma.job.findMany({
        where: {
          userId,
          type: JobType.SEND_EMAIL,
          payload: {
            path: ['campaignId'],
            equals: campaignId,
          },
        },
        select: { status: true },
      }),
      this.prisma.lead.count({
        where: {
          userId,
          isDeleted: false,
          emailLastReplyAt: { not: null },
          jobs: {
            some: {
              type: JobType.SEND_EMAIL,
              payload: {
                path: ['campaignId'],
                equals: campaignId,
              },
            },
          },
        },
      }),
      this.prisma.lead.count({
        where: {
          userId,
          isDeleted: false,
          emailLastBounceAt: { not: null },
          jobs: {
            some: {
              type: JobType.SEND_EMAIL,
              payload: {
                path: ['campaignId'],
                equals: campaignId,
              },
            },
          },
        },
      }),
    ]);
    const sent = jobs.filter((item) => item.status === 'DONE').length;
    const failed = jobs.filter((item) => item.status === 'FAILED').length;
    const paused = jobs.filter((item) => item.status === 'PAUSED').length;
    const pending = jobs.filter(
      (item) => item.status === 'PENDING' || item.status === 'PROCESSING',
    ).length;

    await this.prisma.emailCampaign.update({
      where: { id: campaign.id },
      data: {
        queued: jobs.length,
        sent,
        failed,
        replied,
        bounced,
        status:
          paused > 0 && pending === 0
            ? 'PAUSED'
            : pending > 0
              ? 'RUNNING'
              : failed > 0 && sent === 0
                ? 'FAILED'
                : 'COMPLETED',
        completedAt: pending > 0 || paused > 0 ? null : new Date(),
      },
    });
  }

  private formatJobError(error: unknown) {
    const message = error instanceof Error ? error.message : String(error);

    if (/no LID found/i.test(message)) {
      return 'Not a WhatsApp number.';
    }

    return message;
  }

  private async handleSendEmail(job: Job) {
    const payload = job.payload as unknown as SendEmailJobPayload;
    const settings = await this.prisma.emailSmtpSettings.findUnique({
      where: { userId: payload.userId },
    });
    if (!settings?.isActive) {
      throw new Error(
        'SMTP is not configured for this login account. Save SMTP settings before sending email.',
      );
    }
    const smtpHost = settings.host;
    const smtpPort = settings.port;
    const smtpSecure = settings.secure;
    const smtpUser = settings.username;
    const smtpPass = this.secretVaultService.decrypt(settings.password);
    const smtpFromEmail = payload.from || settings.fromEmail || smtpUser;
    const smtpFromName = settings.fromName;
    const replyTo = settings.replyToEmail ?? undefined;
    let subject = payload.subject;
    let body = payload.body;

    if (payload.aiPersonalizationEnabled) {
      if (!payload.leadId) {
        throw new Error('AI personalization requires a lead.');
      }

      const lead = await this.prisma.lead.findFirst({
        where: {
          id: payload.leadId,
          userId: payload.userId,
          isDeleted: false,
        },
      });
      if (!lead) {
        throw new Error('Lead not found for AI personalization.');
      }

      const personalized = await this.emailAiService.personalizeEmail({
        userId: payload.userId,
        lead,
        subject,
        body,
      });
      subject = personalized.subject;
      body = personalized.body;

      await this.prisma.job.update({
        where: { id: job.id },
        data: {
          payload: {
            ...((job.payload as Record<string, unknown>) ?? {}),
            subject,
            body,
            aiPersonalized: true,
          },
        },
      });
    }

    if (!smtpHost || !smtpFromEmail) {
      throw new Error(
        'SMTP host and from email are required for this account.',
      );
    }

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: Number.isFinite(smtpPort) ? smtpPort : 587,
      secure: smtpSecure,
      connectionTimeout: 60_000,
      greetingTimeout: 60_000,
      socketTimeout: 90_000,
      auth:
        smtpUser && smtpPass
          ? {
              user: smtpUser,
              pass: smtpPass,
            }
          : undefined,
    });

    const result = await transporter.sendMail({
      from: smtpFromName
        ? `"${smtpFromName}" <${smtpFromEmail}>`
        : smtpFromEmail,
      to: payload.to,
      subject,
      text: body,
      replyTo,
    });
    const accepted = Array.isArray(result.accepted) ? result.accepted : [];
    const rejected = Array.isArray(result.rejected) ? result.rejected : [];

    if (rejected.includes(payload.to) || !accepted.includes(payload.to)) {
      throw new Error(`SMTP did not accept ${payload.to}.`);
    }

    try {
      await this.appendSentEmailCopy({
        userId: payload.userId,
        fromEmail: smtpFromEmail,
        fromName: smtpFromName,
        to: payload.to,
        subject,
        body,
        replyTo,
      });
    } catch (error) {
      await this.prisma.job.update({
        where: { id: job.id },
        data: {
          lastError:
            `SMTP accepted, but Sent copy failed: ${this.formatJobError(error)}`.slice(
              0,
              500,
            ),
        },
      });
    }
  }

  private async appendSentEmailCopy(input: {
    userId: string;
    fromEmail: string;
    fromName?: string | null;
    to: string;
    subject: string;
    body: string;
    replyTo?: string;
  }) {
    const settings = await this.prisma.emailMailboxSettings.findUnique({
      where: { userId: input.userId },
    });

    if (!settings?.isActive || !settings.imapPassword) {
      throw new Error('IMAP mailbox settings are not configured.');
    }

    const client = new ImapFlow({
      host: settings.imapHost,
      port: settings.imapPort,
      secure: settings.imapSecure,
      auth: {
        user: settings.imapUsername,
        pass: this.secretVaultService.decrypt(settings.imapPassword) ?? '',
      },
      logger: false,
      connectionTimeout: 30_000,
      greetingTimeout: 30_000,
      socketTimeout: 60_000,
    });

    try {
      await client.connect();
      const mailboxes = await client.list();
      const sentFolder = this.resolveSentFolder(mailboxes, settings.sentFolder);
      const sentAt = new Date();
      const response = await client.append(
        sentFolder,
        this.buildSentMime({
          ...input,
          date: sentAt,
          messageId: `<${randomUUID()}@lead-outreach.local>`,
        }),
        ['\\Seen'],
        sentAt,
      );

      if (!response) {
        throw new Error('IMAP server did not confirm APPEND.');
      }
    } finally {
      client.close();
    }
  }

  private resolveSentFolder(mailboxes: ListResponse[], configured: string) {
    if (mailboxes.some((mailbox) => mailbox.path === configured)) {
      return configured;
    }

    return (
      mailboxes.find((mailbox) => mailbox.specialUse === '\\Sent')?.path ||
      mailboxes.find((mailbox) => /sent/i.test(mailbox.name))?.path ||
      configured
    );
  }

  private buildSentMime(input: {
    fromEmail: string;
    fromName?: string | null;
    to: string;
    subject: string;
    body: string;
    replyTo?: string;
    date: Date;
    messageId: string;
  }) {
    const from = input.fromName
      ? `${this.quoteHeaderName(input.fromName)} <${input.fromEmail}>`
      : input.fromEmail;
    const headers = [
      `From: ${from}`,
      `To: ${input.to}`,
      input.replyTo ? `Reply-To: ${input.replyTo}` : null,
      `Subject: ${this.encodeHeader(input.subject)}`,
      `Date: ${input.date.toUTCString()}`,
      `Message-ID: ${input.messageId}`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=utf-8',
      'Content-Transfer-Encoding: 8bit',
    ].filter((header): header is string => Boolean(header));

    return `${headers.join('\r\n')}\r\n\r\n${input.body.replace(/\r?\n/g, '\r\n')}`;
  }

  private quoteHeaderName(value: string) {
    const safe = value.replace(/[\r\n"]/g, '');
    return `"${safe}"`;
  }

  private encodeHeader(value: string) {
    const safe = value.replace(/[\r\n]/g, ' ');
    return /[^\x20-\x7E]/.test(safe)
      ? `=?UTF-8?B?${Buffer.from(safe, 'utf8').toString('base64')}?=`
      : safe;
  }

  private async handleAiReply(job: Job) {
    const payload = job.payload as unknown as AiReplyJobPayload;
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: payload.conversationId },
    });

    if (!conversation) {
      throw new Error(`Conversation ${payload.conversationId} not found.`);
    }

    if (
      conversation.userId !== payload.userId ||
      conversation.whatsappAccountId !== payload.whatsappAccountId
    ) {
      throw new Error('AI reply conversation does not belong to this account.');
    }

    const recentMessages =
      await this.messagesService.findRecentConversationMessages(
        payload.conversationId,
        8,
        payload.userId,
      );
    const incomingMessage = recentMessages.find(
      (message) => message.id === payload.incomingMessageId,
    );

    if (!incomingMessage) {
      throw new Error(
        `Incoming message ${payload.incomingMessageId} not found.`,
      );
    }

    const reply = await this.aiService.generateReply({
      customerPhone: payload.phone,
      lastMessage: incomingMessage.content,
      recentMessages: recentMessages.map((message) => ({
        direction: message.direction,
        content: message.content,
      })),
    });

    const queued = await this.messagesService.createQueuedOutgoing({
      conversationId: payload.conversationId,
      whatsappAccountId: payload.whatsappAccountId,
      phone: payload.phone,
      content: reply,
      metadata: {
        source: 'ai-reply',
        incomingMessageId: payload.incomingMessageId,
      },
    });

    await this.jobsService.enqueueSendWhatsApp({
      userId: payload.userId,
      whatsappAccountId: payload.whatsappAccountId,
      conversationId: payload.conversationId,
      leadId: payload.leadId,
      messageId: queued.id,
      phone: payload.phone,
    });
  }

  private async handleFollowUp(job: Job) {
    const payload = job.payload as unknown as FollowUpJobPayload;
    const queued = await this.messagesService.createQueuedOutgoing({
      conversationId: payload.conversationId,
      whatsappAccountId: payload.whatsappAccountId,
      phone: payload.phone,
      content: payload.content,
      templateId: payload.templateId,
      metadata: {
        source: 'follow-up',
      },
    });

    await this.jobsService.enqueueSendWhatsApp({
      userId: payload.userId,
      whatsappAccountId: payload.whatsappAccountId,
      conversationId: payload.conversationId,
      leadId: payload.leadId,
      messageId: queued.id,
      phone: payload.phone,
      templateId: payload.templateId,
      templateVariables: payload.templateVariables,
    });
  }

  private isOutside24HourWindow(lastIncomingAt?: Date | null) {
    if (!lastIncomingAt) {
      return true;
    }

    return Date.now() - lastIncomingAt.getTime() > 24 * 60 * 60 * 1000;
  }

  private resolveMarkSeenMessageIds(metadata: unknown): string[] | undefined {
    if (!metadata || typeof metadata !== 'object') {
      return undefined;
    }

    const record = metadata as Record<string, unknown>;
    const source = record.source;

    if (source !== 'ai-reply') {
      return undefined;
    }

    const incomingMessageId = record.incomingMessageId;

    if (typeof incomingMessageId === 'string' && incomingMessageId.trim()) {
      return [incomingMessageId.trim()];
    }

    return undefined;
  }

  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private requiresOfficialTemplateWindow(provider: ProviderType) {
    return provider !== ProviderType.WAHA && provider !== ProviderType.BAILEYS;
  }

  private requiresApiKey(provider: ProviderType) {
    return provider !== ProviderType.WAHA && provider !== ProviderType.BAILEYS;
  }
}
