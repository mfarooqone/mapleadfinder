import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TemplateChannel, TemplateStatus } from '@prisma/client';
import { renderTemplateContent } from '../../common/utils/template.util';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';

@Injectable()
export class TemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateTemplateDto & { userId: string }) {
    await this.assertWhatsAppAccountBelongsToUser(
      dto.userId,
      dto.whatsappAccountId,
    );
    await this.assertTemplateNameAvailable(dto.userId, dto.name);

    try {
      return await this.prisma.template.create({
        data: {
          userId: dto.userId,
          whatsappAccountId: dto.whatsappAccountId,
          channel: dto.channel ?? TemplateChannel.WHATSAPP,
          name: dto.name,
          subject: dto.subject,
          content: dto.content,
          language: dto.language ?? 'en_US',
          category: dto.category ?? 'MARKETING',
          variables: dto.variables ?? [],
          metadata: dto.metadata,
          status: dto.submitForApproval
            ? TemplateStatus.PENDING_APPROVAL
            : TemplateStatus.DRAFT,
        },
      });
    } catch (error) {
      this.handleTemplateWriteError(error);
    }
  }

  async findAll(userId: string, channel?: TemplateChannel) {
    return this.prisma.template.findMany({
      where: { userId, ...(channel ? { channel } : {}) },
      include: {
        whatsappAccount: {
          select: {
            id: true,
            phoneNumber: true,
            provider: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findByIdForUser(userId: string, templateId: string) {
    const template = await this.prisma.template.findFirst({
      where: {
        id: templateId,
        userId,
      },
    });

    if (!template) {
      throw new NotFoundException(`Template ${templateId} not found.`);
    }

    return template;
  }

  async update(userId: string, id: string, dto: UpdateTemplateDto) {
    await this.assertWhatsAppAccountBelongsToUser(userId, dto.whatsappAccountId);

    if (dto.name !== undefined) {
      await this.assertTemplateNameAvailable(userId, dto.name, id);
    }

    let result;
    try {
      result = await this.prisma.template.updateMany({
        where: { id, userId },
        data: {
          ...(dto.whatsappAccountId !== undefined
            ? { whatsappAccountId: dto.whatsappAccountId || null }
            : {}),
          ...(dto.channel !== undefined ? { channel: dto.channel } : {}),
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.subject !== undefined ? { subject: dto.subject || null } : {}),
          ...(dto.content !== undefined ? { content: dto.content } : {}),
          ...(dto.language !== undefined ? { language: dto.language } : {}),
          ...(dto.category !== undefined ? { category: dto.category } : {}),
          ...(dto.variables !== undefined ? { variables: dto.variables } : {}),
          ...(dto.metadata !== undefined ? { metadata: dto.metadata } : {}),
          ...(dto.status !== undefined
            ? { status: dto.status }
            : dto.submitForApproval
              ? { status: TemplateStatus.PENDING_APPROVAL }
              : {}),
        },
      });
    } catch (error) {
      this.handleTemplateWriteError(error);
    }

    if (result.count === 0) {
      throw new NotFoundException(`Template ${id} not found.`);
    }

    return this.findByIdForUser(userId, id);
  }

  private async assertWhatsAppAccountBelongsToUser(
    userId: string,
    whatsappAccountId?: string | null,
  ) {
    if (!whatsappAccountId) {
      return;
    }

    const account = await this.prisma.whatsAppAccount.findFirst({
      where: {
        id: whatsappAccountId,
        userId,
      },
      select: { id: true },
    });

    if (!account) {
      throw new NotFoundException(
        `WhatsApp account ${whatsappAccountId} not found for this user.`,
      );
    }
  }

  private async assertTemplateNameAvailable(
    userId: string,
    name: string,
    currentTemplateId?: string,
  ) {
    const existing = await this.prisma.template.findFirst({
      where: {
        userId,
        name,
        ...(currentTemplateId ? { id: { not: currentTemplateId } } : {}),
      },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException(
        'A template with this name already exists. Use a different template name or edit the existing template.',
      );
    }
  }

  private handleTemplateWriteError(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException(
        'A template with this name already exists. Use a different template name or edit the existing template.',
      );
    }

    throw error;
  }

  async renderTemplateForMessage(
    userId: string,
    templateId: string,
    variables?: Record<string, string>,
  ) {
    const template = await this.findByIdForUser(userId, templateId);

    return {
      template,
      content: renderTemplateContent(template.content, variables),
    };
  }

  async updateStatus(userId: string, id: string, status: TemplateStatus) {
    const result = await this.prisma.template.updateMany({
      where: {
        id,
        userId,
      },
      data: { status },
    });

    if (result.count === 0) {
      throw new NotFoundException(`Template ${id} not found.`);
    }

    return this.findByIdForUser(userId, id);
  }
}
