import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

type FindOrCreateConversationInput = {
  userId: string;
  whatsappAccountId?: string;
  phone: string;
  leadId?: string | null;
  lastMessageAt?: Date;
};

@Injectable()
export class ConversationsService {
  constructor(private readonly prisma: PrismaService) {}

  async findOrCreate({
    userId,
    whatsappAccountId,
    phone,
    leadId,
    lastMessageAt = new Date(),
  }: FindOrCreateConversationInput) {
    if (whatsappAccountId) {
      return this.prisma.conversation.upsert({
        where: {
          userId_whatsappAccountId_phone: {
            userId,
            whatsappAccountId,
            phone,
          },
        },
        update: {
          ...(leadId ? { leadId } : {}),
          whatsappAccountId,
          lastMessageAt,
        },
        create: {
          userId,
          whatsappAccountId,
          phone,
          leadId,
          lastMessageAt,
        },
      });
    }

    return this.prisma.conversation.upsert({
      where: {
        userId_phone: {
          userId,
          phone,
        },
      },
      update: {
        ...(leadId ? { leadId } : {}),
        lastMessageAt,
      },
      create: {
        userId,
        phone,
        leadId,
        lastMessageAt,
      },
    });
  }

  async findAll(userId: string, whatsappAccountId?: string) {
    let resolvedAccountId = whatsappAccountId;

    if (!resolvedAccountId) {
      const account = await this.prisma.whatsAppAccount.findUnique({
        where: { userId },
        select: { id: true },
      });
      resolvedAccountId = account?.id;
    }

    return this.prisma.conversation.findMany({
      where: {
        userId,
        ...(resolvedAccountId ? { whatsappAccountId: resolvedAccountId } : {}),
      },
      include: {
        lead: true,
        _count: {
          select: {
            messages: true,
          },
        },
      },
      orderBy: [{ lastMessageAt: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async findById(userId: string, id: string) {
    const conversation = await this.prisma.conversation.findFirst({
      where: {
        id,
        userId,
      },
      include: {
        lead: true,
        messages: {
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    if (!conversation) {
      throw new NotFoundException(`Conversation ${id} not found.`);
    }

    return conversation;
  }

  async touchIncoming(conversationId: string, timestamp = new Date()) {
    return this.prisma.conversation.update({
      where: { id: conversationId },
      data: {
        lastIncomingAt: timestamp,
        lastMessageAt: timestamp,
      },
    });
  }

  async touchOutgoing(conversationId: string, timestamp = new Date()) {
    return this.prisma.conversation.update({
      where: { id: conversationId },
      data: {
        lastOutgoingAt: timestamp,
        lastMessageAt: timestamp,
      },
    });
  }
}
