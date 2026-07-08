import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { JobStatus, JobType, Lead } from '@prisma/client';
import { randomUUID } from 'crypto';
import { promises as dns } from 'dns';
import nodemailer from 'nodemailer';
import { JobsService } from '../jobs/jobs.service';
import { PrismaService } from '../../prisma/prisma.service';
import { SecretVaultService } from '../security/secret-vault.service';
import { SendBulkEmailDto } from './dto/send-bulk-email.dto';
import { UpsertSmtpSettingsDto } from './dto/upsert-smtp-settings.dto';

@Injectable()
export class EmailService {
  private static readonly EMAIL_SEND_DELAY_SECONDS = 15;
  private static readonly DISPOSABLE_EMAIL_DOMAINS = new Set([
    '10minutemail.com',
    'guerrillamail.com',
    'mailinator.com',
    'tempmail.com',
    'temp-mail.org',
    'throwawaymail.com',
    'yopmail.com',
  ]);
  private static readonly PLACEHOLDER_EMAIL_DOMAINS = new Set([
    'domain.com',
    'example.com',
    'example.net',
    'example.org',
    'invalid.com',
    'test.com',
  ]);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jobsService: JobsService,
    private readonly secretVaultService: SecretVaultService,
  ) {}

  async getSmtpSettings(userId: string) {
    const settings = await this.prisma.emailSmtpSettings.findUnique({
      where: { userId },
    });

    if (!settings) {
      return {
        configured: false,
        envFallbackAvailable: false,
      };
    }

    return {
      configured: true,
      id: settings.id,
      host: settings.host,
      port: settings.port,
      secure: settings.secure,
      username: settings.username,
      hasPassword: Boolean(settings.password),
      fromEmail: settings.fromEmail,
      fromName: settings.fromName,
      replyToEmail: settings.replyToEmail,
      isActive: settings.isActive,
      lastVerifiedAt: settings.lastVerifiedAt?.toISOString() ?? null,
      lastVerifyError: settings.lastVerifyError,
      updatedAt: settings.updatedAt.toISOString(),
      envFallbackAvailable: false,
    };
  }

  async upsertSmtpSettings(userId: string, dto: UpsertSmtpSettingsDto) {
    const existing = await this.prisma.emailSmtpSettings.findUnique({
      where: { userId },
    });
    const encryptedPassword =
      dto.password && dto.password.trim()
        ? this.secretVaultService.encrypt(dto.password.trim())
        : existing?.password;

    const settings = await this.prisma.emailSmtpSettings.upsert({
      where: { userId },
      create: {
        userId,
        host: dto.host.trim(),
        port: dto.port,
        secure: dto.secure,
        username: dto.username?.trim() || null,
        password: encryptedPassword,
        fromEmail: dto.fromEmail.trim(),
        fromName: dto.fromName?.trim() || null,
        replyToEmail: dto.replyToEmail?.trim() || null,
        isActive: dto.isActive ?? true,
        lastVerifyError: null,
      },
      update: {
        host: dto.host.trim(),
        port: dto.port,
        secure: dto.secure,
        username: dto.username?.trim() || null,
        password: encryptedPassword,
        fromEmail: dto.fromEmail.trim(),
        fromName: dto.fromName?.trim() || null,
        replyToEmail: dto.replyToEmail?.trim() || null,
        isActive: dto.isActive ?? true,
        lastVerifyError: null,
      },
    });

    return {
      saved: true,
      settings: await this.getSmtpSettings(settings.userId),
    };
  }

  async testSmtpSettings(userId: string) {
    const settings = await this.prisma.emailSmtpSettings.findUnique({
      where: { userId },
    });

    if (!settings || !settings.isActive) {
      throw new NotFoundException('SMTP settings are not configured.');
    }

    const transporter = nodemailer.createTransport({
      host: settings.host,
      port: settings.port,
      secure: settings.secure,
      auth:
        settings.username && settings.password
          ? {
              user: settings.username,
              pass: this.secretVaultService.decrypt(settings.password) ?? '',
            }
          : undefined,
    });

    try {
      await transporter.verify();
      const verifiedAt = new Date();
      await this.prisma.emailSmtpSettings.update({
        where: { userId },
        data: {
          lastVerifiedAt: verifiedAt,
          lastVerifyError: null,
        },
      });

      return {
        ok: true,
        verifiedAt: verifiedAt.toISOString(),
        note: 'SMTP connection verified.',
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.prisma.emailSmtpSettings.update({
        where: { userId },
        data: { lastVerifyError: message.slice(0, 500) },
      });
      throw new BadRequestException(`SMTP test failed: ${message}`);
    }
  }

  async sendBulkEmail(dto: SendBulkEmailDto & { userId: string }) {
    const delaySeconds = EmailService.EMAIL_SEND_DELAY_SECONDS;

    const uniqueLeadIds = [
      ...new Set(dto.leadIds.map((id) => id.trim())),
    ].filter(Boolean);
    const leads = await this.prisma.lead.findMany({
      where: {
        userId: dto.userId,
        id: { in: uniqueLeadIds },
        isDeleted: false,
      },
      orderBy: { createdAt: 'asc' },
    });

    if (leads.length === 0) {
      throw new NotFoundException('No matching contacts were found.');
    }

    const leadById = new Map(leads.map((lead) => [lead.id, lead]));
    const orderedLeads = uniqueLeadIds
      .map((leadId) => leadById.get(leadId))
      .filter((lead): lead is Lead => Boolean(lead));
    const campaignId = randomUUID();
    const campaign = await this.prisma.emailCampaign.create({
      data: {
        id: campaignId,
        userId: dto.userId,
        name: dto.campaignName?.trim() || null,
        subjectTemplate: dto.subjectTemplate.trim(),
        bodyTemplatePreview: this.truncate(dto.bodyTemplate.trim(), 500),
        aiPersonalizationEnabled: dto.aiPersonalizationEnabled ?? false,
        provider: dto.aiPersonalizationEnabled
          ? (
              await this.prisma.emailAiSettings.findUnique({
                where: { userId: dto.userId },
                select: { provider: true },
              })
            )?.provider
          : null,
        totalSelected: orderedLeads.length,
      },
    });
    const contacts: Array<{
      leadId: string;
      name: string | null;
      email: string;
      scheduledFor: string;
      delaySeconds: number;
      jobId: string;
      subject: string;
      bodyPreview: string;
    }> = [];
    const skippedNoEmail: Array<{
      leadId: string;
      name: string | null;
      email: string | null;
    }> = [];
    const skippedInvalidEmail: Array<{
      leadId: string;
      name: string | null;
      email: string;
      reason: string;
    }> = [];
    const domainValidationCache = new Map<
      string,
      { valid: boolean; reason?: string }
    >();
    let nextRunAt = new Date();
    const decisionMakerByLeadId = await this.findBestDecisionMakerEmails(
      dto.userId,
      orderedLeads.map((lead) => lead.id),
    );

    for (const lead of orderedLeads) {
      const decisionMaker = decisionMakerByLeadId.get(lead.id);
      const email = (decisionMaker?.email ?? lead.email)?.trim();
      if (!email) {
        skippedNoEmail.push({
          leadId: lead.id,
          name: lead.name ?? null,
          email: null,
        });
        continue;
      }

      const emailValidation = await this.validateDeliverableEmail(
        email,
        domainValidationCache,
      );
      if (!emailValidation.valid) {
        skippedInvalidEmail.push({
          leadId: lead.id,
          name: lead.name ?? null,
          email,
          reason: emailValidation.reason ?? 'Email address is not valid.',
        });
        continue;
      }

      const subject = this.renderTemplate(
        dto.subjectTemplate,
        lead,
        decisionMaker,
      ).trim();
      const body = this.renderTemplate(
        dto.bodyTemplate,
        lead,
        decisionMaker,
      ).trim();

      if (!subject || !body) {
        throw new BadRequestException('Email subject and body are required.');
      }

      nextRunAt = new Date(nextRunAt.getTime() + delaySeconds * 1000);
      const job = await this.jobsService.enqueueSendEmail(
        {
          userId: dto.userId,
          leadId: lead.id,
          campaignId,
          to: email,
          subject,
          body,
          from: dto.fromEmail,
          aiPersonalizationEnabled: dto.aiPersonalizationEnabled ?? false,
          decisionMakerId: decisionMaker?.id,
          decisionMakerName: decisionMaker?.name ?? undefined,
          decisionMakerTitle: decisionMaker?.title ?? undefined,
        },
        nextRunAt,
      );

      contacts.push({
        leadId: lead.id,
        name: decisionMaker?.name ?? lead.name ?? null,
        email,
        scheduledFor: nextRunAt.toISOString(),
        delaySeconds,
        jobId: job.id,
        subject,
        bodyPreview: this.truncate(body, 180),
      });
    }

    await this.prisma.emailCampaign.update({
      where: { id: campaign.id },
      data: {
        queued: contacts.length,
        skippedNoEmail: skippedNoEmail.length,
        skippedInvalidEmail: skippedInvalidEmail.length,
        status: contacts.length > 0 ? 'QUEUED' : 'COMPLETED',
        completedAt: contacts.length > 0 ? null : new Date(),
      },
    });

    return {
      queued: contacts.length,
      campaignId: campaign.id,
      minDelaySeconds: delaySeconds,
      maxDelaySeconds: delaySeconds,
      contacts,
      skippedNoEmail,
      skippedInvalidEmail,
      note:
        contacts.length > 0
          ? `Queued ${contacts.length} email(s). Skipped ${skippedNoEmail.length + skippedInvalidEmail.length} contact(s) without a usable email. Each email waits 15 seconds before sending.`
          : 'No emails were queued.',
    };
  }

  async listCampaigns(userId: string) {
    const campaigns = await this.prisma.emailCampaign.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return campaigns.map((campaign) => ({
      id: campaign.id,
      name: campaign.name,
      subjectTemplate: campaign.subjectTemplate,
      bodyTemplatePreview: campaign.bodyTemplatePreview,
      aiPersonalizationEnabled: campaign.aiPersonalizationEnabled,
      provider: campaign.provider,
      status: campaign.status,
      totalSelected: campaign.totalSelected,
      queued: campaign.queued,
      sent: campaign.sent,
      failed: campaign.failed,
      skippedNoEmail: campaign.skippedNoEmail,
      skippedInvalidEmail: campaign.skippedInvalidEmail,
      replied: campaign.replied,
      bounced: campaign.bounced,
      startedAt: campaign.startedAt.toISOString(),
      completedAt: campaign.completedAt?.toISOString() ?? null,
      createdAt: campaign.createdAt.toISOString(),
      updatedAt: campaign.updatedAt.toISOString(),
    }));
  }

  async refreshCampaignStats(userId: string, campaignId: string) {
    const [campaign, jobs, replied, bounced] = await Promise.all([
      this.prisma.emailCampaign.findFirst({
        where: { id: campaignId, userId },
      }),
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

    if (!campaign) {
      return null;
    }

    const sent = jobs.filter((job) => job.status === JobStatus.DONE).length;
    const failed = jobs.filter((job) => job.status === JobStatus.FAILED).length;
    const paused = jobs.filter((job) => job.status === JobStatus.PAUSED).length;
    const pending = jobs.filter(
      (job) =>
        job.status === JobStatus.PENDING || job.status === JobStatus.PROCESSING,
    ).length;
    const status =
      paused > 0 && pending === 0
        ? 'PAUSED'
        : pending > 0
          ? 'RUNNING'
          : failed > 0 && sent === 0
            ? 'FAILED'
            : 'COMPLETED';

    return this.prisma.emailCampaign.update({
      where: { id: campaign.id },
      data: {
        queued: jobs.length,
        sent,
        failed,
        replied,
        bounced,
        status,
        completedAt: pending > 0 || paused > 0 ? null : new Date(),
      },
    });
  }

  async getBulkProgress(userId: string, campaignId?: string) {
    const recentJobs = await this.prisma.job.findMany({
      where: {
        userId,
        type: JobType.SEND_EMAIL,
      },
      orderBy: { createdAt: 'desc' },
      take: 1000,
      include: { lead: true },
    });
    const jobsWithCampaign = recentJobs
      .map((job) => ({
        job,
        payload: job.payload as Record<string, unknown>,
      }))
      .filter(({ payload }) => typeof payload.campaignId === 'string');
    const resolvedCampaignId =
      campaignId?.trim() ||
      (jobsWithCampaign[0]?.payload.campaignId as string | undefined);

    if (!resolvedCampaignId) {
      return this.emptyProgress();
    }

    await this.refreshCampaignStats(userId, resolvedCampaignId);

    const contacts = jobsWithCampaign
      .filter(({ payload }) => payload.campaignId === resolvedCampaignId)
      .sort(
        (left, right) => left.job.runAt.getTime() - right.job.runAt.getTime(),
      )
      .map(({ job, payload }) => ({
        jobId: job.id,
        leadId: job.leadId,
        name: job.lead?.name ?? null,
        email:
          typeof payload.to === 'string' ? payload.to : (job.lead?.email ?? ''),
        subject: typeof payload.subject === 'string' ? payload.subject : '',
        scheduledFor: job.runAt.toISOString(),
        jobStatus: job.status,
        lastError: job.lastError,
        updatedAt: job.updatedAt.toISOString(),
      }));
    const sent = contacts.filter(
      (contact) => contact.jobStatus === JobStatus.DONE,
    ).length;
    const failed = contacts.filter(
      (contact) => contact.jobStatus === JobStatus.FAILED,
    ).length;
    const processing = contacts.filter(
      (contact) => contact.jobStatus === JobStatus.PROCESSING,
    ).length;
    const pending = contacts.filter(
      (contact) => contact.jobStatus === JobStatus.PENDING,
    ).length;
    const paused = contacts.filter(
      (contact) => contact.jobStatus === JobStatus.PAUSED,
    ).length;

    return {
      campaignId: resolvedCampaignId,
      total: contacts.length,
      queued: contacts.length,
      processing,
      sent,
      failed,
      pending,
      paused,
      contacts,
    };
  }

  async pauseBulkEmail(userId: string, campaignId?: string) {
    const resolvedCampaignId = campaignId?.trim();
    if (!resolvedCampaignId) {
      throw new BadRequestException('campaignId is required.');
    }

    const matchingJobs = await this.findEmailCampaignJobsByStatus(
      userId,
      resolvedCampaignId,
      JobStatus.PENDING,
    );

    if (matchingJobs.length > 0) {
      await this.prisma.job.updateMany({
        where: {
          id: { in: matchingJobs.map((job) => job.id) },
          userId,
          status: JobStatus.PENDING,
        },
        data: {
          status: JobStatus.PAUSED,
          lockedAt: null,
        },
      });
    }

    await this.prisma.emailCampaign.updateMany({
      where: { id: resolvedCampaignId, userId },
      data: { status: 'PAUSED' },
    });
    await this.refreshCampaignStats(userId, resolvedCampaignId);

    return {
      campaignId: resolvedCampaignId,
      paused: matchingJobs.length,
      note:
        matchingJobs.length > 0
          ? `Paused ${matchingJobs.length} pending email(s).`
          : 'No pending emails were available to pause.',
    };
  }

  async resumeBulkEmail(userId: string, campaignId?: string) {
    const resolvedCampaignId = campaignId?.trim();
    if (!resolvedCampaignId) {
      throw new BadRequestException('campaignId is required.');
    }

    const matchingJobs = await this.findEmailCampaignJobsByStatus(
      userId,
      resolvedCampaignId,
      JobStatus.PAUSED,
    );
    let nextRunAt = new Date();

    for (const job of matchingJobs.sort(
      (left, right) => left.runAt.getTime() - right.runAt.getTime(),
    )) {
      nextRunAt = new Date(
        nextRunAt.getTime() + EmailService.EMAIL_SEND_DELAY_SECONDS * 1000,
      );
      await this.prisma.job.update({
        where: { id: job.id },
        data: {
          status: JobStatus.PENDING,
          runAt: nextRunAt,
          lockedAt: null,
        },
      });
    }

    await this.prisma.emailCampaign.updateMany({
      where: { id: resolvedCampaignId, userId },
      data: { status: matchingJobs.length > 0 ? 'RUNNING' : undefined },
    });
    await this.refreshCampaignStats(userId, resolvedCampaignId);

    return {
      campaignId: resolvedCampaignId,
      resumed: matchingJobs.length,
      note:
        matchingJobs.length > 0
          ? `Resumed ${matchingJobs.length} paused email(s).`
          : 'No paused emails were available to resume.',
    };
  }

  async retryFailedBulkEmail(userId: string, campaignId?: string) {
    const resolvedCampaignId = campaignId?.trim();
    if (!resolvedCampaignId) {
      throw new BadRequestException('campaignId is required.');
    }

    const matchingJobs = await this.findEmailCampaignJobsByStatus(
      userId,
      resolvedCampaignId,
      JobStatus.FAILED,
    );
    let nextRunAt = new Date();

    for (const job of matchingJobs.sort(
      (left, right) => left.runAt.getTime() - right.runAt.getTime(),
    )) {
      nextRunAt = new Date(
        nextRunAt.getTime() + EmailService.EMAIL_SEND_DELAY_SECONDS * 1000,
      );
      await this.prisma.job.update({
        where: { id: job.id },
        data: {
          status: JobStatus.PENDING,
          attempts: 0,
          lastError: null,
          runAt: nextRunAt,
          lockedAt: null,
        },
      });
    }

    await this.prisma.emailCampaign.updateMany({
      where: { id: resolvedCampaignId, userId },
      data: { status: matchingJobs.length > 0 ? 'RUNNING' : undefined },
    });
    await this.refreshCampaignStats(userId, resolvedCampaignId);

    return {
      campaignId: resolvedCampaignId,
      retried: matchingJobs.length,
      note:
        matchingJobs.length > 0
          ? `Retrying ${matchingJobs.length} failed email(s).`
          : 'No failed emails were available to retry.',
    };
  }

  async stopBulkEmail(userId: string, campaignId?: string) {
    const resolvedCampaignId = campaignId?.trim();
    if (!resolvedCampaignId) {
      throw new BadRequestException('campaignId is required.');
    }

    const jobs = await this.prisma.job.findMany({
      where: {
        userId,
        type: JobType.SEND_EMAIL,
        status: { in: [JobStatus.PENDING, JobStatus.PAUSED] },
      },
      select: {
        id: true,
        payload: true,
      },
    });
    const matchingJobs = jobs.filter((job) => {
      const payload = job.payload as Record<string, unknown>;
      return payload.campaignId === resolvedCampaignId;
    });

    if (matchingJobs.length > 0) {
      await this.prisma.job.updateMany({
        where: {
          id: { in: matchingJobs.map((job) => job.id) },
          userId,
          status: { in: [JobStatus.PENDING, JobStatus.PAUSED] },
        },
        data: {
          status: JobStatus.FAILED,
          lastError: 'Campaign stopped by user.',
          lockedAt: null,
        },
      });
    }

    return {
      campaignId: resolvedCampaignId,
      stopped: matchingJobs.length,
      note:
        matchingJobs.length > 0
          ? `Stopped ${matchingJobs.length} pending email(s).`
          : 'No pending emails were left to stop.',
    };
  }

  private async findEmailCampaignJobsByStatus(
    userId: string,
    campaignId: string,
    status: JobStatus,
  ) {
    const jobs = await this.prisma.job.findMany({
      where: {
        userId,
        type: JobType.SEND_EMAIL,
        status,
      },
      select: {
        id: true,
        payload: true,
        runAt: true,
      },
    });

    return jobs.filter((job) => {
      const payload = job.payload as Record<string, unknown>;
      return payload.campaignId === campaignId;
    });
  }

  private async findBestDecisionMakerEmails(userId: string, leadIds: string[]) {
    const rows = await this.prisma.leadDecisionMaker.findMany({
      where: {
        userId,
        leadId: { in: [...new Set(leadIds)] },
        isBest: true,
        email: { not: null },
      },
      select: {
        id: true,
        leadId: true,
        name: true,
        title: true,
        email: true,
        emailType: true,
        confidence: true,
      },
    });

    return new Map(rows.map((row) => [row.leadId, row]));
  }

  private emptyProgress() {
    return {
      campaignId: null,
      total: 0,
      queued: 0,
      processing: 0,
      sent: 0,
      failed: 0,
      pending: 0,
      paused: 0,
      contacts: [],
    };
  }

  private renderTemplate(
    template: string,
    lead: Lead,
    decisionMaker?: {
      name: string | null;
      title: string | null;
      email: string | null;
    },
  ) {
    const displayName = decisionMaker?.name ?? lead.name;
    const firstName = displayName?.trim().split(/\s+/)[0] || 'there';
    const values: Record<string, string> = {
      firstName,
      name: displayName ?? firstName,
      company: lead.name ?? firstName,
      title: decisionMaker?.title ?? '',
      email: decisionMaker?.email ?? lead.email ?? '',
      phone: lead.phone ?? '',
      website: lead.website ?? '',
      category: lead.category ?? '',
      address: lead.address ?? '',
      sourceKeyword: lead.sourceKeyword ?? '',
    };

    return template.replace(/\{\{\s*([\w]+)\s*\}\}/g, (_, key: string) => {
      return values[key] ?? '';
    });
  }

  private randomIntInclusive(min: number, max: number) {
    const safeMin = Math.ceil(Math.min(min, max));
    const safeMax = Math.floor(Math.max(min, max));
    return Math.floor(Math.random() * (safeMax - safeMin + 1)) + safeMin;
  }

  private truncate(value: string, maxLength: number) {
    return value.length <= maxLength
      ? value
      : `${value.slice(0, maxLength - 1)}…`;
  }

  private async validateDeliverableEmail(
    email: string,
    domainValidationCache: Map<string, { valid: boolean; reason?: string }>,
  ) {
    const normalized = email.trim().toLowerCase();
    const basicEmailPattern =
      /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i;

    if (!basicEmailPattern.test(normalized)) {
      return { valid: false, reason: 'Invalid email format.' };
    }

    const [localPart, domain] = normalized.split('@');

    if (!localPart || localPart.length > 64 || !domain || domain.length > 253) {
      return { valid: false, reason: 'Invalid email length.' };
    }

    if (
      EmailService.DISPOSABLE_EMAIL_DOMAINS.has(domain) ||
      EmailService.PLACEHOLDER_EMAIL_DOMAINS.has(domain)
    ) {
      return {
        valid: false,
        reason: 'Disposable or placeholder email domain.',
      };
    }

    if (domainValidationCache.has(domain)) {
      return domainValidationCache.get(domain) ?? { valid: false };
    }

    try {
      const mxRecords = await dns.resolveMx(domain);
      const valid = mxRecords.some((record) => record.exchange);
      const result = valid
        ? { valid: true }
        : { valid: false, reason: 'Email domain has no mail server.' };
      domainValidationCache.set(domain, result);
      return result;
    } catch {
      const result = {
        valid: false,
        reason: 'Email domain has no mail server.',
      };
      domainValidationCache.set(domain, result);
      return result;
    }
  }
}
