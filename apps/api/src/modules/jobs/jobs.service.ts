import { Injectable } from '@nestjs/common';
import { Job, JobStatus, JobType, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export type SendWhatsAppJobPayload = {
  userId: string;
  whatsappAccountId: string;
  conversationId: string;
  leadId?: string;
  messageId: string;
  phone: string;
  messageType?: 'text' | 'voice';
  campaignId?: string;
  templateId?: string;
  templateVariables?: Record<string, string>;
};

export type SendEmailJobPayload = {
  userId: string;
  leadId?: string;
  campaignId?: string;
  to: string;
  subject: string;
  body: string;
  from?: string;
  aiPersonalizationEnabled?: boolean;
  decisionMakerId?: string;
  decisionMakerName?: string;
  decisionMakerTitle?: string;
};

export type AiReplyJobPayload = {
  userId: string;
  whatsappAccountId: string;
  conversationId: string;
  leadId?: string;
  incomingMessageId: string;
  phone: string;
};

export type FollowUpJobPayload = {
  userId: string;
  whatsappAccountId: string;
  conversationId: string;
  leadId?: string;
  phone: string;
  content: string;
  templateId?: string;
  templateVariables?: Record<string, string>;
};

@Injectable()
export class JobsService {
  constructor(private readonly prisma: PrismaService) {}

  async enqueueSendWhatsApp(
    payload: SendWhatsAppJobPayload,
    runAt = new Date(),
  ) {
    return this.enqueue({
      userId: payload.userId,
      conversationId: payload.conversationId,
      leadId: payload.leadId,
      type: JobType.SEND_WHATSAPP,
      payload,
      runAt,
    });
  }

  async enqueueSendEmail(payload: SendEmailJobPayload, runAt = new Date()) {
    return this.enqueue({
      userId: payload.userId,
      leadId: payload.leadId,
      type: JobType.SEND_EMAIL,
      payload,
      runAt,
    });
  }

  async enqueueAiReply(payload: AiReplyJobPayload, runAt = new Date()) {
    return this.enqueue({
      userId: payload.userId,
      conversationId: payload.conversationId,
      leadId: payload.leadId,
      type: JobType.AI_REPLY,
      payload,
      runAt,
    });
  }

  async enqueueFollowUp(payload: FollowUpJobPayload, runAt: Date) {
    return this.enqueue({
      userId: payload.userId,
      conversationId: payload.conversationId,
      leadId: payload.leadId,
      type: JobType.FOLLOW_UP,
      payload,
      runAt,
    });
  }

  async findAll(userId?: string) {
    return this.prisma.job.findMany({
      where: userId ? { userId } : undefined,
      orderBy: [{ runAt: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async recoverStaleJobs(staleAfterMinutes = 10) {
    const staleBefore = new Date(Date.now() - staleAfterMinutes * 60_000);
    return this.prisma.job.updateMany({
      where: {
        status: JobStatus.PROCESSING,
        lockedAt: {
          lt: staleBefore,
        },
      },
      data: {
        status: JobStatus.PENDING,
        lockedAt: null,
      },
    });
  }

  async acquireDueJobs(limit: number): Promise<Job[]> {
    const candidates = await this.prisma.job.findMany({
      where: {
        status: JobStatus.PENDING,
        runAt: {
          lte: new Date(),
        },
      },
      orderBy: {
        runAt: 'asc',
      },
      take: limit,
    });

    const claimed: Job[] = [];

    for (const candidate of candidates) {
      const lockedAt = new Date();
      const result = await this.prisma.job.updateMany({
        where: {
          id: candidate.id,
          status: JobStatus.PENDING,
        },
        data: {
          status: JobStatus.PROCESSING,
          lockedAt,
        },
      });

      if (result.count === 1) {
        claimed.push({
          ...candidate,
          status: JobStatus.PROCESSING,
          lockedAt,
        });
      }
    }

    return claimed;
  }

  async complete(jobId: string) {
    return this.prisma.job.update({
      where: { id: jobId },
      data: {
        status: JobStatus.DONE,
        lockedAt: null,
      },
    });
  }

  async fail(job: Job, error: unknown) {
    const attempts = job.attempts + 1;
    const exhausted = attempts >= job.maxAttempts;

    return this.prisma.job.update({
      where: { id: job.id },
      data: {
        attempts,
        status: exhausted ? JobStatus.FAILED : JobStatus.PENDING,
        lockedAt: null,
        lastError:
          error instanceof Error ? error.message.slice(0, 500) : String(error),
        runAt: exhausted
          ? job.runAt
          : new Date(Date.now() + attempts * 60_000),
      },
    });
  }

  private enqueue(input: {
    userId: string;
    conversationId?: string;
    leadId?: string;
    type: JobType;
    payload: object;
    runAt: Date;
  }) {
    return this.prisma.job.create({
      data: {
        userId: input.userId,
        conversationId: input.conversationId,
        leadId: input.leadId,
        type: input.type,
        payload: input.payload as Prisma.InputJsonValue,
        runAt: input.runAt,
      },
    });
  }
}
