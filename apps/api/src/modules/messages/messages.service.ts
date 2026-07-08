import { Injectable, NotFoundException } from '@nestjs/common';
import {
  MessageDirection,
  MessageStatus,
  Prisma,
  ProviderType,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

type CreateIncomingMessageInput = {
  conversationId: string;
  phone: string;
  content: string;
  whatsappAccountId?: string;
  provider?: ProviderType;
  providerMessageId?: string;
  metadata?: Prisma.InputJsonValue;
};

type CreateQueuedOutgoingMessageInput = {
  conversationId: string;
  phone: string;
  content: string;
  whatsappAccountId?: string;
  templateId?: string;
  metadata?: Prisma.InputJsonValue;
};

type MarkMessageSentInput = {
  messageId: string;
  userId?: string;
  whatsappAccountId?: string;
  provider?: ProviderType;
  providerMessageId?: unknown;
  rawResponse?: Prisma.InputJsonValue;
};

type MessageScope = {
  userId?: string;
  whatsappAccountId?: string;
};

@Injectable()
export class MessagesService {
  constructor(private readonly prisma: PrismaService) {}

  async createIncoming(input: CreateIncomingMessageInput) {
    return this.prisma.message.create({
      data: {
        conversationId: input.conversationId,
        whatsappAccountId: input.whatsappAccountId,
        phone: input.phone,
        content: input.content,
        direction: MessageDirection.INCOMING,
        status: MessageStatus.RECEIVED,
        provider: input.provider,
        providerMessageId: input.providerMessageId,
        metadata: input.metadata,
      },
    });
  }

  async createQueuedOutgoing(input: CreateQueuedOutgoingMessageInput) {
    return this.prisma.message.create({
      data: {
        conversationId: input.conversationId,
        whatsappAccountId: input.whatsappAccountId,
        templateId: input.templateId,
        phone: input.phone,
        content: input.content,
        direction: MessageDirection.OUTGOING,
        status: MessageStatus.QUEUED,
        metadata: input.metadata,
      },
    });
  }

  async markSent(input: MarkMessageSentInput) {
    const providerMessageId = this.normalizeProviderMessageId(
      input.providerMessageId,
    );

    return this.prisma.message.updateMany({
      where: {
        id: input.messageId,
        ...(input.whatsappAccountId
          ? { whatsappAccountId: input.whatsappAccountId }
          : {}),
        ...(input.userId
          ? {
              conversation: {
                userId: input.userId,
              },
            }
          : {}),
      },
      data: {
        status: MessageStatus.SENT,
        provider: input.provider,
        providerMessageId: providerMessageId ?? undefined,
        metadata: input.rawResponse
          ? {
              providerResponse: input.rawResponse,
            }
          : undefined,
      },
    });
  }

  async markFailed(messageId: string, error: string, scope: MessageScope = {}) {
    return this.prisma.message.updateMany({
      where: {
        id: messageId,
        ...(scope.whatsappAccountId
          ? { whatsappAccountId: scope.whatsappAccountId }
          : {}),
        ...(scope.userId
          ? {
              conversation: {
                userId: scope.userId,
              },
            }
          : {}),
      },
      data: {
        status: MessageStatus.FAILED,
        metadata: {
          lastError: error,
        },
      },
    });
  }

  async updateStatusByProviderMessageId(
    providerMessageId: string,
    status: MessageStatus,
    scope: MessageScope = {},
  ) {
    return this.prisma.message.updateMany({
      where: {
        providerMessageId,
        ...(scope.whatsappAccountId
          ? { whatsappAccountId: scope.whatsappAccountId }
          : {}),
        ...(scope.userId
          ? {
              conversation: {
                userId: scope.userId,
              },
            }
          : {}),
      },
      data: { status },
    });
  }

  async findByConversation(
    userId: string,
    conversationId: string,
    limit = 100,
  ) {
    const messages = await this.prisma.message.findMany({
      where: {
        conversationId,
        conversation: {
          userId,
        },
      },
      take: limit,
      orderBy: {
        createdAt: 'asc',
      },
    });

    if (messages.length === 0) {
      const conversation = await this.prisma.conversation.findFirst({
        where: {
          id: conversationId,
          userId,
        },
        select: { id: true },
      });

      if (!conversation) {
        throw new NotFoundException(
          `Conversation ${conversationId} not found.`,
        );
      }
    }

    return messages;
  }

  async findRecentConversationMessages(
    conversationId: string,
    limit = 10,
    userId?: string,
  ) {
    return this.prisma.message.findMany({
      where: {
        conversationId,
        ...(userId
          ? {
              conversation: {
                userId,
              },
            }
          : {}),
      },
      take: limit,
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  private normalizeProviderMessageId(value: unknown): string | null {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : null;
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value);
    }

    if (!value || typeof value !== 'object') {
      return null;
    }

    const record = value as Record<string, unknown>;
    const candidates = [
      record.id,
      record._serialized,
      record.serialized,
      record.messageId,
      record.key,
    ];

    for (const candidate of candidates) {
      const normalized = this.normalizeProviderMessageId(candidate);
      if (normalized) {
        return normalized;
      }
    }

    return null;
  }
}
