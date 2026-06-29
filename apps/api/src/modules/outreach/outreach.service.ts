import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WhatsAppAccount } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  OutreachConfig,
  resolveOutreachConfig,
} from './outreach.config';

export type OutreachEligibilityInput = {
  hasIncoming: boolean;
  hasOutgoing: boolean;
  optIn: boolean;
  warmUpStatus: string;
  lastOutgoingAt?: Date | null;
  messageBody?: string;
  isFirstOutgoing: boolean;
};

export type OutreachSkipReason =
  | 'no_incoming'
  | 'daily_cap'
  | 'recently_contacted'
  | 'message_too_long'
  | 'url_in_first_message'
  | 'blocked';

@Injectable()
export class OutreachService {
  private readonly config: OutreachConfig;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.config = resolveOutreachConfig(configService);
  }

  getConfig() {
    return this.config;
  }

  getMaxDailyColdForAccount(account: WhatsAppAccount): number {
    void account;
    return this.config.maxColdPerDay;
  }

  async getDailyStats(accountId: string, userId: string) {
    const today = this.startOfUtcDay(new Date());
    const row = await this.prisma.outreachDailyStats.findUnique({
      where: {
        whatsappAccountId_date: {
          whatsappAccountId: accountId,
          date: today,
        },
      },
    });

    const account = await this.prisma.whatsAppAccount.findFirst({
      where: { id: accountId, userId },
    });

    const maxDaily = account
      ? this.getMaxDailyColdForAccount(account)
      : this.config.maxColdPerDay;

    return {
      date: today.toISOString().slice(0, 10),
      coldSendCount: row?.coldSendCount ?? 0,
      newContactCount: row?.newContactCount ?? 0,
      maxDailyCold: maxDaily,
      remainingCold: Math.max(0, maxDaily - (row?.coldSendCount ?? 0)),
      mode: this.config.mode,
      requireIncoming: this.config.requireIncoming,
      minDelaySeconds: this.config.minDelaySeconds,
      maxFirstMessageChars: this.config.maxFirstMessageChars,
      packageSize: this.config.packageSize,
      packagePauseSeconds: this.config.packagePauseSeconds,
    };
  }

  assertMinBulkDelay(minDelaySeconds: number, maxDelaySeconds: number) {
    if (minDelaySeconds < this.config.minDelaySeconds) {
      throw new BadRequestException(
        `minDelaySeconds must be at least ${this.config.minDelaySeconds} for anti-blocking compliance.`,
      );
    }

    if (maxDelaySeconds < minDelaySeconds) {
      throw new BadRequestException(
        'maxDelaySeconds must be greater than or equal to minDelaySeconds.',
      );
    }
  }

  evaluateEligibility(
    input: OutreachEligibilityInput,
    remainingDailyCold: number,
  ): { allowed: boolean; reason?: OutreachSkipReason } {
    if (input.warmUpStatus === 'BLOCKED') {
      return { allowed: false, reason: 'blocked' };
    }

    if (this.config.requireIncoming && !input.hasIncoming) {
      return { allowed: false, reason: 'no_incoming' };
    }

    if (
      input.lastOutgoingAt &&
      Date.now() - input.lastOutgoingAt.getTime() <
        this.config.recooldownDays * 24 * 60 * 60 * 1000
    ) {
      return { allowed: false, reason: 'recently_contacted' };
    }

    void remainingDailyCold;

    if (input.messageBody && input.isFirstOutgoing && !input.hasIncoming) {
      const validation = this.validateFirstColdMessage(input.messageBody);
      if (!validation.allowed) {
        return validation;
      }
    }

    return { allowed: true };
  }

  validateFirstColdMessage(messageBody: string): {
    allowed: boolean;
    reason?: OutreachSkipReason;
  } {
    const trimmed = messageBody.trim();

    if (trimmed.length > this.config.maxFirstMessageChars) {
      return { allowed: false, reason: 'message_too_long' };
    }

    if (
      this.config.blockUrlsInFirstMessage &&
      /https?:\/\/|www\./i.test(trimmed)
    ) {
      return { allowed: false, reason: 'url_in_first_message' };
    }

    return { allowed: true };
  }

  validateOutgoingMessage(messageBody: string, isFirstCold: boolean) {
    if (!isFirstCold) {
      return;
    }

    const result = this.validateFirstColdMessage(messageBody);
    if (!result.allowed) {
      if (result.reason === 'message_too_long') {
        throw new BadRequestException(
          `First cold message must be ${this.config.maxFirstMessageChars} characters or fewer.`,
        );
      }
      if (result.reason === 'url_in_first_message') {
        throw new BadRequestException(
          'Links are blocked in the first cold message. Send a short opener without URLs.',
        );
      }
    }
  }

  async reserveColdSendSlot(
    account: WhatsAppAccount,
    userId: string,
    isNewContact: boolean,
  ) {
    const today = this.startOfUtcDay(new Date());
    const maxDaily = this.getMaxDailyColdForAccount(account);

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.outreachDailyStats.findUnique({
        where: {
          whatsappAccountId_date: {
            whatsappAccountId: account.id,
            date: today,
          },
        },
      });

      const currentCount = existing?.coldSendCount ?? 0;

      await tx.outreachDailyStats.upsert({
        where: {
          whatsappAccountId_date: {
            whatsappAccountId: account.id,
            date: today,
          },
        },
        create: {
          userId,
          whatsappAccountId: account.id,
          date: today,
          coldSendCount: 1,
          newContactCount: isNewContact ? 1 : 0,
        },
        update: {
          coldSendCount: { increment: 1 },
          ...(isNewContact ? { newContactCount: { increment: 1 } } : {}),
        },
      });

      return {
        reserved: true as const,
        remaining: Math.max(0, maxDaily - currentCount - 1),
      };
    });
  }

  applyPackageDelay(
    scheduledCount: number,
    nextRunAt: Date,
    randomDelaySeconds: number,
  ): Date {
    if (
      scheduledCount > 0 &&
      scheduledCount % this.config.packageSize === 0
    ) {
      return new Date(
        nextRunAt.getTime() + this.config.packagePauseSeconds * 1000,
      );
    }

    return new Date(nextRunAt.getTime() + randomDelaySeconds * 1000);
  }

  private startOfUtcDay(date: Date) {
    return new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
    );
  }
}
