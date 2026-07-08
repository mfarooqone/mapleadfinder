import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  EmailDirection,
  EmailFolder,
  JobStatus,
  JobType,
  Prisma,
} from '@prisma/client';
import { ImapFlow, type FetchMessageObject, type ListResponse } from 'imapflow';
import { simpleParser } from 'mailparser';
import { PrismaService } from '../../prisma/prisma.service';
import { SecretVaultService } from '../security/secret-vault.service';
import { ListMailboxMessagesQueryDto } from './dto/list-mailbox-messages-query.dto';
import { UpsertMailboxSettingsDto } from './dto/upsert-mailbox-settings.dto';

const MAILBOX_WINDOW_DAYS = 3;
const MAX_OPEN_MESSAGE_BYTES = 1_000_000;
const MAX_CACHED_BODY_CHARS = 100_000;

@Injectable()
export class EmailMailboxService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly secretVaultService: SecretVaultService,
  ) {}

  async getSettings(userId: string) {
    const settings = await this.prisma.emailMailboxSettings.findUnique({
      where: { userId },
    });

    if (!settings) {
      return {
        configured: false,
        windowDays: MAILBOX_WINDOW_DAYS,
      };
    }

    return {
      configured: true,
      id: settings.id,
      imapHost: settings.imapHost,
      imapPort: settings.imapPort,
      imapSecure: settings.imapSecure,
      imapUsername: settings.imapUsername,
      hasPassword: Boolean(settings.imapPassword),
      inboxFolder: settings.inboxFolder,
      sentFolder: settings.sentFolder,
      isActive: settings.isActive,
      lastSyncedAt: settings.lastSyncedAt?.toISOString() ?? null,
      lastSyncError: settings.lastSyncError,
      lastVerifiedAt: settings.lastVerifiedAt?.toISOString() ?? null,
      lastVerifyError: settings.lastVerifyError,
      updatedAt: settings.updatedAt.toISOString(),
      windowDays: MAILBOX_WINDOW_DAYS,
    };
  }

  async upsertSettings(userId: string, dto: UpsertMailboxSettingsDto) {
    const existing = await this.prisma.emailMailboxSettings.findUnique({
      where: { userId },
    });
    const encryptedPassword =
      dto.imapPassword && dto.imapPassword.trim()
        ? this.secretVaultService.encrypt(dto.imapPassword.trim())
        : existing?.imapPassword;

    const settings = await this.prisma.emailMailboxSettings.upsert({
      where: { userId },
      create: {
        userId,
        imapHost: dto.imapHost.trim(),
        imapPort: dto.imapPort,
        imapSecure: dto.imapSecure,
        imapUsername: dto.imapUsername.trim(),
        imapPassword: encryptedPassword,
        inboxFolder: dto.inboxFolder?.trim() || 'INBOX',
        sentFolder: dto.sentFolder?.trim() || 'Sent',
        isActive: dto.isActive ?? true,
        lastSyncError: null,
        lastVerifyError: null,
      },
      update: {
        imapHost: dto.imapHost.trim(),
        imapPort: dto.imapPort,
        imapSecure: dto.imapSecure,
        imapUsername: dto.imapUsername.trim(),
        imapPassword: encryptedPassword,
        inboxFolder:
          dto.inboxFolder?.trim() || existing?.inboxFolder || 'INBOX',
        sentFolder: dto.sentFolder?.trim() || existing?.sentFolder || 'Sent',
        isActive: dto.isActive ?? true,
        lastSyncError: null,
        lastVerifyError: null,
      },
    });

    return {
      saved: true,
      settings: await this.getSettings(settings.userId),
    };
  }

  async testSettings(userId: string) {
    const settings = await this.requireSettings(userId);
    const client = this.createClient(settings);

    try {
      await client.connect();
      const mailboxes = await client.list();
      const sentFolder = this.resolveSentFolder(mailboxes, settings.sentFolder);
      await this.prisma.emailMailboxSettings.update({
        where: { userId },
        data: {
          sentFolder,
          lastVerifiedAt: new Date(),
          lastVerifyError: null,
        },
      });

      return {
        ok: true,
        sentFolder,
        note: 'IMAP mailbox connection verified.',
      };
    } catch (error) {
      const message = this.errorMessage(error);
      await this.prisma.emailMailboxSettings.update({
        where: { userId },
        data: { lastVerifyError: message.slice(0, 500) },
      });
      throw new BadRequestException(`IMAP test failed: ${message}`);
    } finally {
      client.close();
    }
  }

  async syncRecentMailbox(userId: string) {
    const settings = await this.requireSettings(userId);
    if (!settings.isActive) {
      throw new BadRequestException(
        'Mailbox sync is inactive for this account.',
      );
    }

    const client = this.createClient(settings);
    const cutoff = this.cutoffDate();
    let imported = 0;
    let updated = 0;

    try {
      await client.connect();
      const mailboxes = await client.list();
      const folders = [
        {
          folder: EmailFolder.INBOX,
          direction: EmailDirection.INBOUND,
          path: settings.inboxFolder,
        },
        {
          folder: EmailFolder.SENT,
          direction: EmailDirection.OUTBOUND,
          path: this.resolveSentFolder(mailboxes, settings.sentFolder),
        },
      ];

      for (const target of folders) {
        const result = await this.syncFolder({
          client,
          userId,
          path: target.path,
          folder: target.folder,
          direction: target.direction,
          cutoff,
        });
        imported += result.imported;
        updated += result.updated;
      }

      await this.prisma.emailMessage.deleteMany({
        where: {
          userId,
          OR: [{ receivedAt: { lt: cutoff } }, { sentAt: { lt: cutoff } }],
        },
      });
      await this.prisma.emailMessage.updateMany({
        where: {
          userId,
          bodyCachedAt: { lt: new Date(Date.now() - 24 * 60 * 60_000) },
        },
        data: {
          textBody: null,
          htmlBody: null,
          bodyCachedAt: null,
        },
      });
      await this.prisma.emailMailboxSettings.update({
        where: { userId },
        data: {
          lastSyncedAt: new Date(),
          lastSyncError: null,
        },
      });

      return {
        ok: true,
        windowDays: MAILBOX_WINDOW_DAYS,
        imported,
        updated,
        note: `Synced recent mailbox messages from the last ${MAILBOX_WINDOW_DAYS} days.`,
      };
    } catch (error) {
      const message = this.errorMessage(error);
      await this.prisma.emailMailboxSettings.update({
        where: { userId },
        data: { lastSyncError: message.slice(0, 500) },
      });
      throw new BadRequestException(`Mailbox sync failed: ${message}`);
    } finally {
      client.close();
    }
  }

  async listMessages(userId: string, query: ListMailboxMessagesQueryDto) {
    const cutoff = this.cutoffDate();
    const limit = query.limit ?? 100;
    const unreadOnly = query.unreadOnly === 'true';
    const messages = await this.prisma.emailMessage.findMany({
      where: {
        userId,
        ...(query.folder ? { folder: query.folder } : {}),
        ...(unreadOnly ? { isRead: false } : {}),
        OR: [{ receivedAt: { gte: cutoff } }, { sentAt: { gte: cutoff } }],
      },
      orderBy: [
        { receivedAt: 'desc' },
        { sentAt: 'desc' },
        { updatedAt: 'desc' },
      ],
      take: limit,
    });

    return {
      windowDays: MAILBOX_WINDOW_DAYS,
      messages: messages.map((message) =>
        this.serializeMessage(message, false),
      ),
    };
  }

  async getMessage(userId: string, id: string) {
    const existing = await this.prisma.emailMessage.findFirst({
      where: { id, userId },
    });
    if (!existing) {
      throw new NotFoundException('Email message was not found.');
    }

    if (existing.bodyCachedAt && (existing.textBody || existing.htmlBody)) {
      return this.serializeMessage(existing, true);
    }

    const settings = await this.requireSettings(userId);
    const client = this.createClient(settings);

    try {
      await client.connect();
      await client.mailboxOpen(existing.imapFolder, { readOnly: true });
      const message = await client.fetchOne(
        String(existing.imapUid),
        { source: { maxLength: MAX_OPEN_MESSAGE_BYTES }, flags: true },
        { uid: true },
      );
      if (!message || !message.source) {
        return this.serializeMessage(existing, true);
      }

      const parsed = await simpleParser(message.source);
      const updated = await this.prisma.emailMessage.update({
        where: { id: existing.id },
        data: {
          textBody:
            this.truncate(parsed.text ?? '', MAX_CACHED_BODY_CHARS) || null,
          htmlBody:
            this.truncate(
              typeof parsed.html === 'string' ? parsed.html : '',
              MAX_CACHED_BODY_CHARS,
            ) || null,
          bodyCachedAt: new Date(),
          isRead: message.flags ? message.flags.has('\\Seen') : existing.isRead,
        },
      });

      return this.serializeMessage(updated, true);
    } finally {
      client.close();
    }
  }

  async markRead(userId: string, id: string, isRead = true) {
    const existing = await this.prisma.emailMessage.findFirst({
      where: { id, userId },
    });
    if (!existing) {
      throw new NotFoundException('Email message was not found.');
    }

    const settings = await this.requireSettings(userId);
    const client = this.createClient(settings);

    try {
      await client.connect();
      await client.mailboxOpen(existing.imapFolder);
      if (isRead) {
        await client.messageFlagsAdd([existing.imapUid], ['\\Seen'], {
          uid: true,
        });
      } else {
        await client.messageFlagsRemove([existing.imapUid], ['\\Seen'], {
          uid: true,
        });
      }
      const updated = await this.prisma.emailMessage.update({
        where: { id: existing.id },
        data: { isRead },
      });

      return this.serializeMessage(updated, true);
    } finally {
      client.close();
    }
  }

  private async syncFolder(input: {
    client: ImapFlow;
    userId: string;
    path: string;
    folder: EmailFolder;
    direction: EmailDirection;
    cutoff: Date;
  }) {
    let imported = 0;
    let updated = 0;
    await input.client.mailboxOpen(input.path, { readOnly: true });
    const uids = await input.client.search(
      { since: input.cutoff },
      { uid: true },
    );
    if (!uids || uids.length === 0) {
      return { imported, updated };
    }

    for await (const message of input.client.fetch(
      uids,
      {
        uid: true,
        envelope: true,
        flags: true,
        internalDate: true,
        headers: ['message-id', 'in-reply-to', 'references'],
      },
      { uid: true },
    )) {
      const messageDate = this.resolveMessageDate(message, input.direction);
      if (messageDate && messageDate < input.cutoff) {
        continue;
      }
      const result = await this.upsertMessageMetadata({
        userId: input.userId,
        imapFolder: input.path,
        folder: input.folder,
        direction: input.direction,
        message,
        messageDate,
      });
      if (result.created) {
        imported += 1;
      } else {
        updated += 1;
      }
    }

    return { imported, updated };
  }

  private async upsertMessageMetadata(input: {
    userId: string;
    imapFolder: string;
    folder: EmailFolder;
    direction: EmailDirection;
    message: FetchMessageObject;
    messageDate?: Date | null;
  }) {
    const from = input.message.envelope?.from?.[0];
    const toEmails = this.addresses(input.message.envelope?.to);
    const ccEmails = this.addresses(input.message.envelope?.cc);
    const fromEmail = from?.address?.toLowerCase() ?? null;
    const leadEmail =
      input.direction === EmailDirection.INBOUND
        ? fromEmail
        : toEmails[0]?.toLowerCase();
    const lead = leadEmail
      ? await this.prisma.lead.findFirst({
          where: {
            userId: input.userId,
            email: { equals: leadEmail, mode: 'insensitive' },
            isDeleted: false,
          },
          select: { id: true, tags: true },
        })
      : null;
    const messageId = input.message.envelope?.messageId ?? null;
    const threadKey =
      this.headerValue(input.message.headers, 'in-reply-to') ||
      this.headerValue(input.message.headers, 'references') ||
      messageId;
    const existing = await this.prisma.emailMessage.findUnique({
      where: {
        userId_imapFolder_imapUid: {
          userId: input.userId,
          imapFolder: input.imapFolder,
          imapUid: input.message.uid,
        },
      },
      select: { id: true },
    });

    const data = {
      leadId: lead?.id ?? null,
      folder: input.folder,
      direction: input.direction,
      messageId,
      threadKey,
      fromEmail,
      fromName: from?.name ?? null,
      toEmails,
      ccEmails,
      subject: input.message.envelope?.subject ?? null,
      sentAt:
        input.direction === EmailDirection.OUTBOUND
          ? (input.messageDate ?? null)
          : (input.message.envelope?.date ?? null),
      receivedAt:
        input.direction === EmailDirection.INBOUND
          ? (input.messageDate ?? null)
          : null,
      isRead: input.message.flags ? input.message.flags.has('\\Seen') : false,
      rawHeaders: input.message.headers
        ? ({
            value: input.message.headers.toString('utf8'),
          } as Prisma.InputJsonValue)
        : undefined,
    };

    await this.prisma.emailMessage.upsert({
      where: {
        userId_imapFolder_imapUid: {
          userId: input.userId,
          imapFolder: input.imapFolder,
          imapUid: input.message.uid,
        },
      },
      create: {
        userId: input.userId,
        imapFolder: input.imapFolder,
        imapUid: input.message.uid,
        ...data,
      },
      update: data,
    });

    if (lead && input.direction === EmailDirection.INBOUND) {
      await this.markLeadEmailResponse({
        userId: input.userId,
        leadId: lead.id,
        tags: lead.tags,
        subject: data.subject,
        fromEmail,
        receivedAt: data.receivedAt ?? new Date(),
      });
    }

    return { created: !existing };
  }

  private async markLeadEmailResponse(input: {
    userId: string;
    leadId: string;
    tags: string[];
    subject?: string | null;
    fromEmail?: string | null;
    receivedAt: Date;
  }) {
    const bounced = this.looksLikeBounce(input.subject, input.fromEmail);
    const nextTag = bounced ? 'email-bounced' : 'email-replied';
    const tags = Array.from(new Set([...(input.tags ?? []), nextTag]));

    await this.prisma.lead.updateMany({
      where: {
        id: input.leadId,
        userId: input.userId,
        isDeleted: false,
      },
      data: bounced
        ? {
            emailDeliveryStatus: 'BOUNCED',
            emailLastBounceAt: input.receivedAt,
            emailLastError:
              input.subject ?? 'Delivery failure notice received.',
            tags,
          }
        : {
            emailDeliveryStatus: 'REPLIED',
            emailLastReplyAt: input.receivedAt,
            tags,
          },
    });

    const recentCampaign = await this.prisma.job.findFirst({
      where: {
        userId: input.userId,
        leadId: input.leadId,
        type: JobType.SEND_EMAIL,
        status: JobStatus.DONE,
      },
      orderBy: { updatedAt: 'desc' },
      select: { payload: true },
    });
    const campaignId = (
      recentCampaign?.payload as Record<string, unknown> | undefined
    )?.campaignId;
    if (typeof campaignId === 'string') {
      await this.refreshCampaignStats(input.userId, campaignId);
    }
  }

  private looksLikeBounce(subject?: string | null, fromEmail?: string | null) {
    const text = `${subject ?? ''} ${fromEmail ?? ''}`.toLowerCase();
    return [
      'mail delivery',
      'delivery status notification',
      'undeliverable',
      'returned mail',
      'failure notice',
      'mailer-daemon',
      'postmaster',
    ].some((phrase) => text.includes(phrase));
  }

  private async refreshCampaignStats(userId: string, campaignId: string) {
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
    const sent = jobs.filter((item) => item.status === JobStatus.DONE).length;
    const failed = jobs.filter(
      (item) => item.status === JobStatus.FAILED,
    ).length;
    const paused = jobs.filter(
      (item) => item.status === JobStatus.PAUSED,
    ).length;
    const pending = jobs.filter(
      (item) =>
        item.status === JobStatus.PENDING ||
        item.status === JobStatus.PROCESSING,
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

  private serializeMessage(
    message: {
      id: string;
      leadId: string | null;
      folder: EmailFolder;
      direction: EmailDirection;
      imapFolder: string;
      imapUid: number;
      messageId: string | null;
      threadKey: string | null;
      fromEmail: string | null;
      fromName: string | null;
      toEmails: string[];
      ccEmails: string[];
      subject: string | null;
      preview: string | null;
      textBody: string | null;
      htmlBody: string | null;
      bodyCachedAt: Date | null;
      sentAt: Date | null;
      receivedAt: Date | null;
      isRead: boolean;
      updatedAt: Date;
    },
    includeBody: boolean,
  ) {
    return {
      id: message.id,
      leadId: message.leadId,
      folder: message.folder,
      direction: message.direction,
      messageId: message.messageId,
      threadKey: message.threadKey,
      fromEmail: message.fromEmail,
      fromName: message.fromName,
      toEmails: message.toEmails,
      ccEmails: message.ccEmails,
      subject: message.subject,
      preview: message.preview,
      sentAt: message.sentAt?.toISOString() ?? null,
      receivedAt: message.receivedAt?.toISOString() ?? null,
      isRead: message.isRead,
      updatedAt: message.updatedAt.toISOString(),
      bodyCachedAt: message.bodyCachedAt?.toISOString() ?? null,
      ...(includeBody
        ? {
            textBody: message.textBody,
            htmlBody: message.htmlBody,
          }
        : {}),
    };
  }

  private async requireSettings(userId: string) {
    const settings = await this.prisma.emailMailboxSettings.findUnique({
      where: { userId },
    });
    if (!settings) {
      throw new NotFoundException('IMAP mailbox settings are not configured.');
    }

    return settings;
  }

  private createClient(settings: {
    imapHost: string;
    imapPort: number;
    imapSecure: boolean;
    imapUsername: string;
    imapPassword: string | null;
  }) {
    return new ImapFlow({
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

  private resolveMessageDate(
    message: FetchMessageObject,
    direction: EmailDirection,
  ) {
    const envelopeDate = message.envelope?.date;
    const internalDate =
      message.internalDate instanceof Date
        ? message.internalDate
        : message.internalDate
          ? new Date(message.internalDate)
          : null;

    if (direction === EmailDirection.OUTBOUND && envelopeDate) {
      return envelopeDate;
    }

    return internalDate ?? envelopeDate ?? null;
  }

  private addresses(addresses?: Array<{ address?: string }>) {
    return (addresses ?? [])
      .map((address) => address.address?.toLowerCase())
      .filter((address): address is string => Boolean(address));
  }

  private headerValue(headers: FetchMessageObject['headers'], key: string) {
    if (!headers) {
      return null;
    }

    const pattern = new RegExp(`^${key}:\\s*(.+)$`, 'im');
    return headers.toString('utf8').match(pattern)?.[1]?.trim() || null;
  }

  private cutoffDate() {
    return new Date(Date.now() - MAILBOX_WINDOW_DAYS * 24 * 60 * 60_000);
  }

  private truncate(value: string, maxLength: number) {
    return value.length > maxLength ? value.slice(0, maxLength) : value;
  }

  private errorMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error);
  }
}
